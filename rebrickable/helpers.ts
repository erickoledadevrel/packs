import * as sdk from "@superhuman/plugins-sdk";

export function getYear(context: sdk.ExecutionContext, date: Date) {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone,
    year: "numeric",
  });
  let parts = formatter.formatToParts(date);
  return parts.find(part => part.type === "year").value;
}