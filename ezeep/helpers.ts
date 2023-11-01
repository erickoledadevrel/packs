import * as coda from "@codahq/packs-sdk";
import * as ContentDisposition from "content-disposition";
import * as mime from "mime-types";

export const OneDaySecs = 24 * 60 * 60;

interface PrintOptions {
  orientation?: string,
  copies?: number,
  color?: boolean,
  duplex?: boolean,
  paperSize?: string,
  paperWidth?: number,
  paperLength?: number,
  resolution?: string,
}

export async function print(context: coda.ExecutionContext, printerId: string, fileUrl: string, options?: PrintOptions): Promise<string> {
  let [{name, format}, supportedFormats] =  await Promise.all([
    getFileInfo(context, fileUrl),
    getSupportedFileFormats(context),
  ]);
  if (format && !supportedFormats.includes(format)) {
    throw new coda.UserVisibleError(`Unsupported file format: ${format}`);
  }

  let {paperSize, paperLength, paperWidth, color, duplex, orientation, copies, resolution} = options ?? {};

  let payload = {
    alias: name,
    fileurl: fileUrl,
    printerId: printerId,
    properties: {
      paperid: getOptionId(paperSize),
      paperlength: paperLength,
      paperwidth: paperWidth,
      color,
      duplex,
      orientation: getOptionId(orientation),
      copies,
      resolution,
    },
    type: format,
  };
  let response = await context.fetcher.fetch({
    method: "POST",
    url: "https://printapi.ezeep.com/sfapi/Print/",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let data = response.body;
  let result = data.jobid;
  if (!result) {
    throw new coda.UserVisibleError("The print failed for an unknown reason.");
  }
  return result;
}

export async function getPrinters(context) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://printapi.ezeep.com/sfapi/GetPrinter/",
  });
  return response.body;
}

export async function getAllPrinterProperties(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://printapi.ezeep.com/sfapi/GetPrinterProperties/",
  });
  return response.body;
}

export async function getPrinterProperties(context: coda.ExecutionContext, printerId: string) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: coda.withQueryParams("https://printapi.ezeep.com/sfapi/GetPrinterProperties/", {
      id: printerId,
    }),
  });
  return response.body[0];
}

export async function getFileInfo(context: coda.ExecutionContext, fileUrl: string): Promise<{name: string, format:string}> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: fileUrl,
    headers: {
      "Range": "bytes=0-1",
    },
    disableAuthentication: true,
    cacheTtlSecs: OneDaySecs,
  });
  let filename = response.headers["x-amz-meta-filename"] as string;
  if (filename) {
    filename = decodeURIComponent(filename);
  } else {
    let contentDisposition = response.headers["content-disposition"] as string;
    if (contentDisposition) {
      let parsed = ContentDisposition.parse(contentDisposition);
      if (parsed.parameters.filename) {
        filename = parsed.parameters.filename;
      }
    }
  }
  let format = filename?.split(".").pop();
  let contentType = response.headers["content-type"] as string;
  if (!format && contentType) {
    format = mime.extension(contentType);
  }
  return {
    name: filename,
    format: format,
  };
}

export async function getSupportedFileFormats(context: coda.ExecutionContext): Promise<string[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://printapi.ezeep.com/sfapi/GetConfiguration/",
    cacheTtlSecs: OneDaySecs,
  });
  let data = response.body;
  return data.System?.FILEEXT?.trim().split(";") || [];
}

function getOptionId(label: string): number {
  if (!label) return undefined;
  if (!Number.isNaN(parseInt(label))) {
    return Number(label);
  }
  let match = label.match(/^.*\((\d+)\)$/);
  if (!match) {
    throw new coda.UserVisibleError(`Invalid option: ${label}`);
  }
  return Number(match[1]);
}

export function getOptionLabels(names: string[], ids: string[]): string[] {
  return names.map((name, i) => `${name} (${ids[i]})`);
}
