import * as coda from "@codahq/packs-sdk";
import * as console from "console";
import { url } from "inspector";
import { DateTime } from "luxon";

export const pack = coda.newPack();

pack.addNetworkDomain("fitbit.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://www.fitbit.com/oauth2/authorize",
  tokenUrl: "https://api.fitbit.com/oauth2/token",
  scopes: ["activity", "profile", "weight"],
  useProofKeyForCodeExchange: true,
  getConnectionName: async function (context) {
    let profile = await getProfile(context);
    return profile.fullName;
  },
});

const MinDate = "2009-01-01";
const HourSecs = 60 * 60;
const DaySecs = 24 * HourSecs;
const PageSizeDays = 30;
const LargePageSizeDays = 365;

const ValidUnits = {
  US: "en_US",
  UK: "en_GB",
  Metric: "",
};

const DateRangeParameter = coda.makeParameter({
  type: coda.ParameterType.DateArray,
  name: "dateRange",
  description: "The date range to consider.",
  suggestedValue: coda.PrecannedDateRange.Last3Months,
});

const UnitsParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "units",
  description: [
    "Which units system to use. ",
    `Supported values: ${Object.keys(ValidUnits).join(", ")}. `,
    "If not specified the account's default is used."
  ].join(""),
  optional: true,
});

const UserSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      fromKey: "fullName",
      description: "The full name of the user.",
      required: true,
    },
    userId: {
      type: coda.ValueType.String,
      fromKey: "encodedId",
      description: "The user's unique ID.",
      required: true,
    },
    photo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageAttachment,
      fromKey: "avatar640",
      description: "The user's profile photo.",
    },
  },
  displayProperty: "name",
  idProperty: "userId",
  featuredProperties: ["photo"],
});

const WeightEntrySchema = coda.makeObjectSchema({
  properties: {
    user: UserSchema,
    date: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
    time: { type: coda.ValueType.String, codaType: coda.ValueHintType.Time },
    weight: { type: coda.ValueType.Number },
    bmi: { type: coda.ValueType.Number },
    fat: { type: coda.ValueType.Number, codaType: coda.ValueHintType.Percent, precision: 2 },
    logId: { type: coda.ValueType.String },
  },
  displayProperty: "date",
  idProperty: "logId",
  featuredProperties: ["weight", "fat", "bmi"],
});

const StepsEntrySchema = coda.makeObjectSchema({
  properties: {
    user: UserSchema,
    date: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date, fromKey: "dateTime" },
    steps: { type: coda.ValueType.Number, fromKey: "value" },
    logId: { type: coda.ValueType.String },
  },
  displayProperty: "date",
  idProperty: "logId",
  featuredProperties: ["steps"],
});

pack.addSyncTable({
  name: "Weight",
  description: "The log of your weight over time.",
  identityName: "WeightEntry",
  schema: WeightEntrySchema,
  formula: {
    name: "SyncWeight",
    description: "Sync the weight logs.",
    parameters: [
      DateRangeParameter,
      UnitsParameter,
    ],
    execute: async function (args, context) {
      let [dateRange, units] = args;
      let [fromDate, toDate] = dateRange;
      let profile = await getProfile(context);
      let language = getLanguageHeader(units, "weightUnit", profile);
      let {start, end, continuation} = getDatePage(context, fromDate, toDate, PageSizeDays);
      let url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${start}/${end}.json`;
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
        headers: {
          "Accept-Language": language,
        },
        cacheTtlSecs: HourSecs,
      });
      let items: any[] = response.body.weight ?? [];

      for (let item of items) {
        item.user = profile;
        item.fat = item.fat ? item.fat / 100 : undefined;
        item.logId = String(item.logId);
      }

      return {
        result: items,
        continuation,
      };
    },
  },
});

pack.addSyncTable({
  name: "Steps",
  description: "The log of your total steps per day over time.",
  identityName: "StepsEntry",
  schema: StepsEntrySchema,
  formula: {
    name: "SyncSteps",
    description: "Sync the step logs.",
    parameters: [
      DateRangeParameter,
    ],
    execute: async function (args, context) {
      let [dateRange] = args;
      let [fromDate, toDate] = dateRange;
      let profile = await getProfile(context);

      let {start, end, continuation} = getDatePage(context, fromDate, toDate, LargePageSizeDays);
      let url = `https://api.fitbit.com/1/user/-/activities/steps/date/${start}/${end}.json`;
      let response: coda.FetchResponse;
      try {
        response = await context.fetcher.fetch({
          method: "GET",
          url: url,
          cacheTtlSecs: HourSecs,
        });
      } catch (error) {
        if (error.statusCode == 400 && error.body?.errors?.[0]?.message) {
          throw new coda.UserVisibleError(error.body.errors[0].message);
        }
        throw error;
      }
      let items = response.body["activities-steps"];

      for (let item of items) {
        item.value = parseInt(item.value);
        item.user = profile;
        item.logId = `${item.dateTime}-${profile.encodedId}`;
      }

      return {
        result: items,
        continuation,
      };
    },
  },
});

async function getProfile(context: coda.ExecutionContext): Promise<any> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.fitbit.com/1/user/-/profile.json",
    cacheTtlSecs: DaySecs,
  });
  return response.body.user;
}

function getLanguageHeader(units, unitType, profile): string {
  if (units) {
    if (!Object.keys(ValidUnits).includes(units)) {
      throw new coda.UserVisibleError(`Unsupported units system: ${units}`);
    }
    return ValidUnits[units];
  }
  return profile[unitType];
}

function getDatePage(context: coda.ExecutionContext, fromDate: Date, toDate: Date, pageSizeDays: number) {
  let {timezone} = context;
  let fromDateTime = DateTime.fromJSDate(fromDate, {zone: timezone}).startOf("day");
  let toDateTime = DateTime.fromJSDate(toDate, {zone: timezone}).startOf("day");

  // Clamp the from date time.
  let minDateTime = DateTime.fromFormat(MinDate, "yyyy-MM-dd", {zone: timezone}).startOf("day");
  if (fromDateTime < minDateTime) {
    fromDateTime = minDateTime;
  }

  // Clamp the to date time.
  let maxDateTime = DateTime.now().setZone(timezone).startOf("day");
  if (toDateTime > maxDateTime) {
    toDateTime = maxDateTime;
  }

  // Determine the start date for this execution.
  let startDateTime = fromDateTime;
  if (context.sync.continuation?.date) {
    startDateTime = DateTime.fromISO(context.sync.continuation.date as string, {zone: timezone}).startOf("day");
  }

  // Determine the end date for this execution.
  let endDateTime = startDateTime.plus({days: pageSizeDays}).startOf("day");
  if (endDateTime > toDateTime) {
    endDateTime = toDateTime;
  }

  return {
    start: startDateTime.toFormat("yyyy-MM-dd"),
    end: endDateTime.toFormat("yyyy-MM-dd"),
    continuation: endDateTime < toDateTime ? {date: endDateTime.toISO()} : undefined,
  };
}
