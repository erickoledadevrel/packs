import * as coda from "@codahq/packs-sdk";
import * as mime from "mime-types";
import JSZip from "jszip";
const parseDataUri = require("parse-data-uri");
const contentDisposition = require('content-disposition');
const urlParse = require('url-parse');

const HostedDomains = [
  "codahosted.io",
  "coda-us-west-2-prod-blobs-upload.s3.us-west-2.amazonaws.com",
];
const OneDaySecs = 24 * 60 * 60;
const FifteenMinutesSecs = 15 * 60;
const FileSizeLimit = "4MB";

export const pack = coda.newPack();

function defaultFilename(context: coda.ExecutionContext, ext: string): string {
  let date = new Date();
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone, // Use the doc's timezone (important!)
    hourCycle: "h24",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Format the date into individual parts.
  let parts = formatter.formatToParts(date);

  let day = parts.find(part => part.type === "day").value;
  let month = parts.find(part => part.type === "month").value;
  let year = parts.find(part => part.type === "year").value;
  let hour = parts.find(part => part.type === "hour").value;
  let minute = parts.find(part => part.type === "minute").value;
  let second = parts.find(part => part.type === "second").value;

  return `${year}${month}${day}_${hour}${minute}${second}.${ext}`;
}

pack.addFormula({
  name: "TemporaryFile",
  description: "Create a temporary file and return the URL. The file expires after ~15 minutes.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "content",
      description: "The content of the file, text only."
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "filename",
      description: "The name of the temporary file. Default: {timestamp}.txt",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Url,
  cacheTtlSecs: FifteenMinutesSecs,
  execute: async function ([content, filename], context) {
    let mimeType = mime.lookup(filename) || "text/plain";
    let extension  = mime.extension(mimeType);
    filename ||= defaultFilename(context, extension);

    let buffer = Buffer.from(content);
    let url = await context.temporaryBlobStorage.storeBlob(buffer, mimeType, {
      downloadFilename: filename,
      expiryMs: FifteenMinutesSecs * 1000,
    });
    return url;
  },
});

pack.addFormula({
  name: "TemporaryFileFromDataUri",
  description: "Create a temporary file from a data URI and return the URL. The file expires after ~15 minutes.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "dataUri",
      description: "A data URI to parse."
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "filename",
      description: "The name of the temporary file. Default: {timestamp}.png",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Url,
  cacheTtlSecs: FifteenMinutesSecs,
  execute: async function ([dataUri, filename], context) {
    let {mimeType, data} = parseDataUri(dataUri);
    if (filename) {
      mimeType = mime.lookup(filename);
    }
    if (!mimeType) {
      mimeType = "image/png";
    }
    let extension  = mime.extension(mimeType);
    filename ||= defaultFilename(context, extension);

    let url = await context.temporaryBlobStorage.storeBlob(data, mimeType, {
      downloadFilename: filename,
      expiryMs: FifteenMinutesSecs * 1000,
    });
    return url;
  },
});

pack.addFormula({
  name: "TemporaryZipFile",
  description: "Create a temporary zip file from a list of files and return the URL. The zip file expires after ~15 minutes.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseFileArray,
      name: "files",
      description: `The files to zip. The total size of all files must be under ${FileSizeLimit}.`,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "filename",
      description: "The name of the temporary zip file. Default: {timestamp}.zip",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Url,
  cacheTtlSecs: FifteenMinutesSecs,
  execute: async function ([files, filename], context) {
    filename ||= defaultFilename(context, "zip");

    files = files.filter(Boolean);
    if (!files.length) {
      throw new coda.UserVisibleError("Received an empty list of files. Are you missing a .ListCombine()?");
    }

    let jobs: Promise<File>[] = files.map(async fileUrl => {
      if (!isHostedUrl(fileUrl)) {
        throw new coda.UserVisibleError("Invalid file URL: " + fileUrl);
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url: fileUrl,
        isBinaryResponse: true,
        cacheTtlSecs: OneDaySecs,
      });
      return {
        name: getFilename(response.headers),
        content: response.body,
      };
    });
    let results = await Promise.allSettled(jobs);
    for (let [i, result] of results.entries()) {
      if (result.status == "rejected") {
        let message = result.reason.toString();
        if (message.includes("content size") && message.includes("over limit")) {
          throw new coda.UserVisibleError(`File #${i+1} is over the size limit (${FileSizeLimit}).`);
        }
        throw new coda.UserVisibleError(`Error fetching file #${i+1}.`);
      }
    }

    let zip = new JSZip();
    for (let result of results) {
      if (result.status == "fulfilled") {
        zip.file(result.value.name, result.value.content);
      }
    }
    let b64 = await zip.generateAsync({type:"base64"});
    let buffer = Buffer.from(b64, 'base64');

    try {
      let url = await context.temporaryBlobStorage.storeBlob(buffer, "application/zip", {
        downloadFilename: filename,
        expiryMs: FifteenMinutesSecs * 1000,
      });
      return url;
    } catch (error) {
      console.log(error);
      throw new coda.UserVisibleError("Error creating zip file.");
    }
  },
});

function getFilename(headers: Record<string, string | string[]>): string {
  if (headers["x-amz-meta-filename"]) {
    return headers["x-amz-meta-filename"] as string;
  }
  if (headers["content-disposition"]) {
    let filename = contentDisposition.parse(headers["content-disposition"]).parameters.filename;
    if (filename) {
      return decodeURIComponent(filename);
    }
  }
  let mimeType = headers["content-type"];
  let extension  = mime.extension(mimeType);
  let etag = (headers["etag"] as string)?.trim()?.slice(1, -1);
  let name = etag || Math.random().toString(36).slice(2);
  return `${name}.${extension}`;
}

interface File {
  name: string;
  content: Buffer;
}

function isHostedUrl(url: string): boolean {
  let parsed = urlParse(url);
  return HostedDomains.some(domain => parsed.host.endsWith(domain));
}
