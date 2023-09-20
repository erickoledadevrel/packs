import * as coda from "@codahq/packs-sdk";
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
const MaxDateRangeDays = 90;
const PageSizeDays = 30;

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
    execute: async function ([[fromDate, toDate], units], context) {
      let { timezone } = context;
      let profile = await getProfile(context);
      let date = new Date(context.sync.continuation?.date as string ?? toDate);
      let language = await getLanguageHeader(units, "weightUnit", context);
      let url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${formatDate(date, timezone)}/${PageSizeDays}d.json`;
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
      items = items.filter(item => {
        return formatDate(fromDate, timezone) <= item.date && item.date <= formatDate(toDate, timezone);
      });
      items = items.reverse();
      date.setTime(date.getTime() - PageSizeDays * DaySecs * 1000);
      let continuation;
      if (date > fromDate) {
        continuation = {
          date: date.toISOString(),
        };
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
    execute: async function ([[fromDate, toDate]], context) {
      let { timezone } = context;
      let profile = await getProfile(context);
      let now = new Date();
      let todayStr = formatDate(now, timezone);
      let fromStr = formatDate(fromDate, timezone);
      let toStr = formatDate(toDate, timezone);
      if (fromStr < MinDate) {
        fromStr = MinDate;
      }
      if (toStr > todayStr) {
        toStr = todayStr;
      }
      let url = `https://api.fitbit.com/1/user/-/activities/steps/date/${fromStr}/${toStr}.json`;
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
      };
    },
  },
});

async function getLanguageHeader(units, unitType, context): Promise<string> {
  if (units) {
    if (!Object.keys(ValidUnits).includes(units)) {
      throw new coda.UserVisibleError(`Unsupported units system: ${units}`);
    }
    return ValidUnits[units];
  }
  let profile = await getProfile(context);
  return profile[unitType];
}

async function getProfile(context: coda.ExecutionContext): Promise<any> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.fitbit.com/1/user/-/profile.json",
    cacheTtlSecs: DaySecs,
  });
  return response.body.user;
}

function formatDate(date: Date, timezone: string): string {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Format the date into individual parts.
  let parts = formatter.formatToParts(date);

  // Find the day, month, and year parts.
  let day = parts.find(part => part.type === "day").value;
  let month = parts.find(part => part.type === "month").value;
  let year = parts.find(part => part.type === "year").value;
  return `${year.padStart(4, "0")}-${month}-${day}`;
}
