import * as coda from "@codahq/packs-sdk";
import { error } from "console";

export const DetectFormat = "*detect*";
export const OneDaySecs = 24 * 60 * 60;
export const FormatUsageTypes = ["input", "output"];
const TaskOrder = ["import", "convert", "export"];

export async function getFormatCodes(context: coda.ExecutionContext, usage: string, otherFormat?: string): Promise<string[]> {
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

export async function getFormatOptions(context: coda.ExecutionContext, from: string, to: string) {
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

export function optionsToAutocomplete(options) {
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
}


function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

export function onError(error) {
  if (coda.StatusCodeError.isStatusCodeError(error) && error.statusCode != 401) {
    let message = error.body.message;
    if (message) {
      throw new coda.UserVisibleError(message);
    }
  }
  throw error;
}

export async function doExport(context: coda.ExecutionContext, importTask: any, fromFormat: string, toFormat: string, filename: string, options: string[]) {
  let conversion: Record<string, any> = {
    operation: "convert",
    input: "import",
    output_format: toFormat,
    filename: filename,
  };
  if (fromFormat != DetectFormat) {
    conversion.input_format = fromFormat;
  }
  while (options.length) {
    let [option, value, ...rest] = options;
    if (value === "true" || value === "false") {
      conversion[option] = Boolean(value);
    } else {
      conversion[option] = value;
    }
    options = rest;
  }
  let payload = {
    tasks: {
      import: importTask,
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
  return parseJob(job);
}

function parseJob(job: any): string {
  if (job.status == "error") {
    let tasks = job.tasks.sort((a, b) => TaskOrder.indexOf(a.name) - TaskOrder.indexOf(b.name));
    for (let task of tasks) {
      if (task.status == "error") {
        throw new coda.UserVisibleError(task.message);
      }
    }
    throw new coda.UserVisibleError("The conversion failed for an unknown reason.");
  }
  let exportTask = job.tasks.find(job => job.name == "export");
  return exportTask.result.files[0].url;
}
