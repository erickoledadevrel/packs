import * as coda from "@codahq/packs-sdk";
import * as mime from "mime-types";

export const pack = coda.newPack();

function defaultFilename(context: coda.ExecutionContext): string {
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

  return `${year}${month}${day}_${hour}${minute}${second}.txt`;
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
  cacheTtlSecs: 0,
  execute: async function ([content, filename], context) {
    filename ||= defaultFilename(context);

    let buffer = Buffer.from(content);
    let mimeType = mime.lookup(filename) || "text/plain";
    let url = await context.temporaryBlobStorage.storeBlob(buffer, mimeType, {
      downloadFilename: filename,
    });
    return url;
  },
});
