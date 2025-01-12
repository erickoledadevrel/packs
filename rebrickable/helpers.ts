import * as coda from "@codahq/packs-sdk";

export function getYear(context: coda.ExecutionContext, date: Date) {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone,
    year: "numeric",
  });
  let parts = formatter.formatToParts(date);
  return parts.find(part => part.type === "year").value;
}