import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;
const DetectFormat = "*detect*";
const FormatUsageTypes = ["input", "output"];

pack.addNetworkDomain("cloudconvert.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://cloudconvert.com/oauth/authorize",
  tokenUrl: "https://cloudconvert.com/oauth/token",
  scopes: ["user.read", "task.read", "task.write"],
  getConnectionName: async function (context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://api.cloudconvert.com/v2/users/me",
    });
    let user = response.body.data;
    return user.username;
  },
});

pack.addFormula({
  name: "Convert",
  description: "Convert a file from one format to another.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseFileArray,
      name: "file",
      description: "The file to convert (from a File or Image column).",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "from",
      description: `The file format to convert from. Use the option "${DetectFormat}" to detect the format of the source file.`,
      autocomplete: async function (context, _, args) {
        return getFormatCodes(context, "input");
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "to",
      description: "The file format to convert to.",
      autocomplete: async function (context, _, args) {
        let { from } = args;
        return getFormatCodes(context, "input", from);
      },
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "option",
      description: `The name of ad additional conversion option to set. Not available if the source file format is set to "${DetectFormat}".`,
      autocomplete: async function (context, _, args) {
        let { from, to } = args;
        if (!from || !to || from == DetectFormat) {
          return [];
        }
        let options = await getFormatOptions(context, from, to);
        return options.map(option => {
          let display = option.name;
          if (option.type == "enum") {
            display += ` (${option.possible_values.join(", ")})`;
          } else if (option.type == "boolean") {
            display += ` (true, false)`;
          }
          return {
            display,
            value: option.name,
          };
        });
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value of the conversion option.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  onError: onError,
  execute: async function (args, context) {
    let [fileUrls, fromFormat, toFormat, ...options] = args;
    fileUrls = fileUrls.filter(Boolean);
    if (fileUrls.length == 0) {
      throw new coda.UserVisibleError("A file is required.");
    } else if (fileUrls.length > 1) {
      throw new coda.UserVisibleError("Only one file can be converted at a time.");
    }
    let fileUrl = fileUrls[0];
    let conversion: Record<string, string> = {
      operation: "convert",
      input: "import",
      output_format: toFormat,
    };
    if (fromFormat != DetectFormat) {
      conversion.input_format = fromFormat;
    }
    while (options.length) {
      let [option, value, ...rest] = options;
      conversion[option] = value;
      options = rest;
    }
    let payload = {
      tasks: {
        import: {
          operation: "import/url",
          url: fileUrl,
        },
        convert: conversion,
        export: {
          operation: "export/url",
          input: "convert",
        },
      },
      tag: context.invocationToken,
    };
    let response = await context.fetcher.fetch({
      method: "POST",
      url: "https://sync.api.cloudconvert.com/v2/jobs",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    let job = response.body.data;
    let result;
    for (let task of job.tasks.reverse()) {
      if (task.status == "error") {
        throw new coda.UserVisibleError(task.message);
      }
      if (task.operation == "export/url") {
        result = task.result.files[0].url;
      }
    }
    if (!result) {
      throw new Error("Export task result not present.");
    }
    return result;
  },
});

pack.addFormula({
  name: "FileFormats",
  description: "Lists the supported file formats for conversion.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "usage",
      description: "Whether to return the formats used for input or output.",
      autocomplete: FormatUsageTypes,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "otherFormat",
      description: "If specified, only return formats that can be converted to/from this other format.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Array,
  items: coda.makeSchema({
    type: coda.ValueType.String,
  }),
  onError: onError,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function (args, context) {
    let [usage, otherFormat] = args;
    if (!FormatUsageTypes.includes(usage)) {
      throw new coda.UserVisibleError(`Invalid usage: ${usage}`);
    }
    return getFormatCodes(context, usage, otherFormat);
  },
});

async function getFormatCodes(context: coda.ExecutionContext, usage: string, otherFormat?: string): Promise<string[]> {
  let formats = await getFormats(context);
  if (otherFormat && otherFormat != DetectFormat) {
    formats = formats.filter(format => usage == "input" ?
      format.output_format == otherFormat :
      format.input_format == otherFormat);
  }
  let result = formats.map(format => usage == "input" ?
    format.input_format :
    format.output_format).filter(onlyUnique).sort();
  if (usage == "input") {
    result.unshift(DetectFormat);
  }
  return result;
}

async function getFormats(context: coda.ExecutionContext) {
  let url = "https://api.cloudconvert.com/v2/convert/formats";
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.data;
}

async function getFormatOptions(context: coda.ExecutionContext, from: string, to: string) {
  let url = coda.withQueryParams("https://api.cloudconvert.com/v2/convert/formats", {
    "filter[input_format]": from,
    "filter[output_format]": to,
    include: "options",
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.data[0].options;
}

function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

function onError(error) {
  if (coda.StatusCodeError.isStatusCodeError(error)) {
    let message = error.body.message;
    if (message) {
      throw new coda.UserVisibleError(message);
    }
  }
  throw error;
}
