import * as coda from "@codahq/packs-sdk";
import { Buffer } from "buffer";
import { TextEncoder } from "text-encoding";
global.TextEncoder = TextEncoder;
import ical, {ICalCalendarMethod} from "ical-generator";

export const pack = coda.newPack();

const OneHourSecs = 60 * 60;
const OneDaySecs = 24 * OneHourSecs;
const DefaultFilename = "event.ics";
const DefaultFilenameMultiple = "events.ics";


const SummaryParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "summary",
  description: "The summary (name) of the event.",
});

const StartParam = coda.makeParameter({
  type: coda.ParameterType.Date,
  name: "start",
  description: "The start of the event, as a date and time.",
});

const EndParam = coda.makeParameter({
  type: coda.ParameterType.Date,
  name: "end",
  description: "The end of the event, as a date and time.",
});

const GetFilenameParam = function(multiple = false) {
  return coda.makeParameter({
    type: coda.ParameterType.String,
    name: "filename",
    description: `The name of the output file. Default: ${multiple ? DefaultFilenameMultiple : DefaultFilename}`,
    optional: true,
  });
};

const LocationParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "location",
  description: "The location of the event.",
  optional: true,
});

const DescriptionParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "description",
  description: "The description of the event.",
  optional: true,
});

pack.addFormula({
  name: "ExportEvent",
  description: "Export an event in iCalendar format. Returns a temporary URL to the file.",
  parameters: [
    SummaryParam,
    StartParam,
    EndParam,
    GetFilenameParam(false),
    LocationParam,
    DescriptionParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneHourSecs,
  execute: async function (args, context) {
    let [summary, start, end,
      filename = DefaultFilename,
      location,
      description
    ] = args;
    let calendar = ical({});
    calendar.method(ICalCalendarMethod.PUBLISH);
    calendar.createEvent({
      start,
      end,
      summary,
      location,
      description,
    });
    let buffer = Buffer.from(calendar.toString());
    return context.temporaryBlobStorage.storeBlob(buffer, "text/calendar", {
      downloadFilename: filename,
      expiryMs: OneDaySecs * 1000,
    });
  },
});

pack.addFormula({
  name: "ExportCalendar",
  description: "Export a calendar/table of events in iCalendar format. Returns a temporary URL to the file.",
  parameters: [
    arrayOf(SummaryParam),
    arrayOf(StartParam),
    arrayOf(EndParam),
    GetFilenameParam(true),
    arrayOf(LocationParam),
    arrayOf(DescriptionParam),
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneHourSecs,
  execute: async function (args, context) {
    let [summaries, starts, ends,
      filename = DefaultFilenameMultiple,
      locations = [],
      descriptions = [],
    ] = args;
    let calendar = ical({});
    calendar.method(ICalCalendarMethod.PUBLISH);
    let lists: any[] = [summaries, starts, ends, locations, descriptions];
    console.log(descriptions);
    let length = lists.shift().length;
    for (let list of lists) {
      if (list.length != 0 && list.length != length) {
        throw new coda.UserVisibleError("All list parameters must be of the same length.");
      }
    }
    for (let i = 0; i < length; i++) {
      calendar.createEvent({
        summary: summaries[i],
        start: starts[i],
        end: ends[i],
        location: locations[i],
        description: descriptions[i],
      });
    }
    let buffer = Buffer.from(calendar.toString());
    return context.temporaryBlobStorage.storeBlob(buffer, "text/calendar", {
      downloadFilename: filename,
      expiryMs: OneDaySecs * 1000,
    });
  },
});

function arrayOf(param: coda.ParamDef<any>, sparse = false): coda.ParamDef<any> {
  let type: coda.ParameterType;
  switch (param.type) {
    case coda.Type.string:
      type = sparse ? coda.ParameterType.SparseStringArray : coda.ParameterType.StringArray;
      break;
    case coda.Type.date:
      type = sparse ? coda.ParameterType.SparseDateArray : coda.ParameterType.DateArray;
      break;
    default:
      throw new Error(`Unhandled parameter type: ${param.type}`);
  }
  return coda.makeParameter({
    ...param,
    type: type,
    name: param.name + "Column",
    description: `Column containing: ${param.description}`,
  });
}
