import * as sdk from "@superhuman/plugins-sdk";
import { DetectFormat, FormatUsageTypes, PageFormatOptions, doExport, getFormatCodes, getFormatOptions, onError, optionsToAutocomplete, parseOptions } from "./helpers";

export const pack = sdk.newPack();

pack.addNetworkDomain("cloudconvert.com");

pack.setUserAuthentication({
  type: sdk.AuthenticationType.OAuth2,
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
    sdk.makeParameter({
      type: sdk.ParameterType.SparseFileArray,
      name: "file",
      description: "The file to convert (from a File or Image column).",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "from",
      description: `The file format to convert from. Use the option "${DetectFormat}" to detect the format of the source file.`,
      autocomplete: async function (context, _, args) {
        return getFormatCodes(context, "input");
      },
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "to",
      description: "The file format to convert to.",
      autocomplete: async function (context, _, args) {
        let { from } = args;
        return getFormatCodes(context, "output", from);
      },
    }),
  ],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "option",
      description: `The name of ad additional conversion option to set. Not available if the source file format is set to "${DetectFormat}".`,
      autocomplete: async function (context, _, args) {
        let { from, to } = args;
        if (!from || !to || from == DetectFormat) {
          return [];
        }
        let options = await getFormatOptions(context, from, to);
        return optionsToAutocomplete(options);
      },
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "value",
      description: "The value of the conversion option.",
    }),
  ],
  resultType: sdk.ValueType.String,
  isAction: true,
  onError: onError,
  execute: async function (args, context) {
    let [fileUrls, fromFormat, toFormat, ...options] = args;
    fileUrls = fileUrls.filter(Boolean);
    if (fileUrls.length == 0) {
      throw new sdk.UserVisibleError("A file is required.");
    } else if (fileUrls.length > 1) {
      throw new sdk.UserVisibleError("Only one file can be converted at a time.");
    }
    let fileUrl = fileUrls[0];
    let importTask = {
      operation: "import/url",
      url: fileUrl,
    };
    return await doExport(context, importTask, fromFormat, toFormat, undefined, options);
  },
});

pack.addFormula({
  name: "ConvertPage",
  description: "Convert a page or other text content to a file.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.Html,
      name: "page",
      description: "The page to convert (or content from a Text or Canvas column).",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "to",
      description: "The file format to convert to.",
      autocomplete: async function (context, _, args) {
        return getFormatCodes(context, "output", "html");
      },
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "filename",
      description: "The desired name of the output file.",
    }),
  ],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "option",
      description: `The name of ad additional conversion option to set. Not available if the source file format is set to "${DetectFormat}".`,
      autocomplete: async function (context, _, args) {
        let { to } = args;
        if (!to) {
          return [];
        }
        let options = await getFormatOptions(context, "html", to);
        options = options.concat(PageFormatOptions);
        return optionsToAutocomplete(options);
      },
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "value",
      description: "The value of the conversion option.",
    }),
  ],
  resultType: sdk.ValueType.String,
  isAction: true,
  onError: onError,
  execute: async function (args, context) {
    let [pageHtml, toFormat, filename, ...options] = args;
    let settings = parseOptions(options);
    if (settings.page_break_at) {
      let find: string;
      switch (settings.page_break_at) {
        case "line_separator":
          find = "<hr>";
          break;
        case "placeholder":
          if (!settings.page_break_placeholder) {
            throw new sdk.UserVisibleError("Option page_break_placeholder must be set.");
          }
          find = settings.page_break_placeholder;
          break;
        default:
          throw new sdk.UserVisibleError(`Invalid value for page_break_at: ${settings.page_break_at}`)
      }
      pageHtml = pageHtml.replaceAll(find, `<div style="height: 0; page-break-after: always;"></div>`);
    }
    
    if (!pageHtml.includes("<html")) {
      pageHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>${settings.page_styles ?? ""}</style>
          </head>
        <body>${pageHtml}</body>
      </html>`
    }
    let importTask = {
      operation: "import/raw",
      file: pageHtml,
      filename: "page.html",
    };
    return await doExport(context, importTask, "html", toFormat, filename, options);
  },
});

pack.addFormula({
  name: "FileFormats",
  description: "Lists the supported file formats for conversion.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "usage",
      description: "Whether to return the formats used for input or output.",
      autocomplete: FormatUsageTypes,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "otherFormat",
      description: "If specified, only return formats that can be converted to/from this other format.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: sdk.makeSchema({
    type: sdk.ValueType.String,
  }),
  onError: onError,
  connectionRequirement: sdk.ConnectionRequirement.None,
  execute: async function (args, context) {
    let [usage, otherFormat] = args;
    if (!FormatUsageTypes.includes(usage)) {
      throw new sdk.UserVisibleError(`Invalid usage: ${usage}`);
    }
    return getFormatCodes(context, usage, otherFormat);
  },
});

