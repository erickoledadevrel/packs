import * as sdk from "@superhuman/plugins-sdk";
import { Buffer } from "buffer";
import { TextEncoder } from "text-encoding";
global.TextEncoder = TextEncoder;
import ical, {ICalCalendarMethod} from "ical-generator";

export const pack = sdk.newPack();

const OneHourSecs = 60 * 60;
const OneDaySecs = 24 * OneHourSecs;
const DefaultFilename = "event.ics";
const DefaultFilenameMultiple = "events.ics";


const SummaryParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "summary",
  description: "The summary (name) of the event.",
});

const StartParam = sdk.makeParameter({
  type: sdk.ParameterType.Date,
  name: "start",
  description: "The start of the event, as a date and time.",
});

const EndParam = sdk.makeParameter({
  type: sdk.ParameterType.Date,
  name: "end",
  description: "The end of the event, as a date and time.",
});

const GetFilenameParam = function(multiple = false) {
  return sdk.makeParameter({
    type: sdk.ParameterType.String,
    name: "filename",
    description: `The name of the output file. Default: ${multiple ? DefaultFilenameMultiple : DefaultFilename}`,
    optional: true,
  });
};

const LocationParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "location",
  description: "The location of the event.",
  optional: true,
});

const DescriptionParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "description",
  description: "The description of the event.",
  optional: true,
});

const IsAllDayParam = sdk.makeParameter({
  type: sdk.ParameterType.Boolean,
  name: "isAllDay",
  description: "True if the event is an all-day event.",
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
    IsAllDayParam,
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneHourSecs,
  execute: async function (args, context) {
    let [summary, start, end,
      filename = DefaultFilename,
      location,
      description,
      isAllDay,
    ] = args;
    let calendar = ical({});
    calendar.method(ICalCalendarMethod.PUBLISH);
    calendar.createEvent({
      start,
      end,
      summary,
      location,
      description,
      allDay: isAllDay,
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
    arrayOf(StartParam, true),
    arrayOf(EndParam, true),
    GetFilenameParam(true),
    arrayOf(LocationParam),
    arrayOf(DescriptionParam),
    arrayOf(IsAllDayParam),
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneHourSecs,
  execute: async function (args, context) {
    let [summaries, starts, ends,
      filename = DefaultFilenameMultiple,
      locations = [],
      descriptions = [],
      isAllDays = [],
    ] = args;
    let calendar = ical({});
    calendar.method(ICalCalendarMethod.PUBLISH);
    let lists: any[] = [summaries, starts, ends, locations, descriptions];
    let length = lists.shift().length;
    for (let list of lists) {
      if (list.length != 0 && list.length != length) {
        throw new sdk.UserVisibleError("All list parameters must be of the same length.");
      }
    }
    for (let i = 0; i < length; i++) {
      if (!summaries[i]) {
        throw new sdk.UserVisibleError(`Event ${i + 1} is missing a summary.`);
      }
      if (!starts[i]) {
        throw new sdk.UserVisibleError(`Event ${i + 1} is missing a start date/time.`);
      }
      calendar.createEvent({
        summary: summaries[i],
        start: starts[i],
        end: ends[i],
        location: locations[i],
        description: descriptions[i],
        allDay: isAllDays[i],
      });
    }
    let buffer = Buffer.from(calendar.toString());
    return context.temporaryBlobStorage.storeBlob(buffer, "text/calendar", {
      downloadFilename: filename,
      expiryMs: OneDaySecs * 1000,
    });
  },
});

function arrayOf(param: sdk.ParamDef<any>, sparse = false): sdk.ParamDef<any> {
  let type: sdk.ParameterType;
  switch (param.type) {
    case sdk.Type.string:
      type = sparse ? sdk.ParameterType.SparseStringArray : sdk.ParameterType.StringArray;
      break;
    case sdk.Type.date:
      type = sparse ? sdk.ParameterType.SparseDateArray : sdk.ParameterType.DateArray;
      break;
    case sdk.Type.boolean:
      type = sparse ? sdk.ParameterType.SparseBooleanArray : sdk.ParameterType.BooleanArray;
      break;
    default:
      throw new Error(`Unhandled parameter type: ${param.type}`);
  }
  return sdk.makeParameter({
    ...param,
    type: type,
    name: param.name + "Column",
    description: `Column containing: ${param.description}`,
  });
}
