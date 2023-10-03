import * as coda from "@codahq/packs-sdk";
import * as console from "console";
import { DateTime } from "luxon";
import { OneDaySecs } from "../flight-codes/constants";

export const pack = coda.newPack();

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "profile",
    "https://www.googleapis.com/auth/fitness.activity.read",
  ],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
  getConnectionName: async function (context) {
    let user = await getUserInfo(context);
    return user.name;
  },
  networkDomain: "googleapis.com",
});

const PageSizeDays = 30;
const HourSecs = 60 * 60;

const DateRangeParameter = coda.makeParameter({
  type: coda.ParameterType.DateArray,
  name: "dateRange",
  description: "The date range to consider.",
  suggestedValue: coda.PrecannedDateRange.Last3Months,
});

const UserSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The full name of the user.",
      required: true,
    },
    id: {
      type: coda.ValueType.String,
      description: "The user's unique ID.",
      required: true,
    },
    photo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "picture",
      description: "The user's profile photo.",
    },
  },
  displayProperty: "name",
});

const StepsEntrySchema = coda.makeObjectSchema({
  properties: {
    user: UserSchema,
    date: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
    steps: { type: coda.ValueType.Number },
    logId: { type: coda.ValueType.String },
  },
  displayProperty: "date",
  idProperty: "logId",
  featuredProperties: ["steps"],
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
      let {start, end, continuation} = getDatePage(context, fromDate, toDate, 90);

      let user = await getUserInfo(context);

      let url = `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`;
      let body = {
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime(),
        aggregateBy: [
          {
            dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
            dataTypeName: "com.google.step_count.delta"
          }
        ],
        bucketByTime: {
          period: {
            type: "day",
            value: 1,
            timeZoneId: context.timezone,
          }
        }
      }
      let response = await context.fetcher.fetch({
        method: "POST",
        url: url,
        body: JSON.stringify(body),
      });
      let buckets = response.body.bucket;

      let rows: any[] = [];
      for (let bucket of buckets) {
        let point = bucket.dataset[0].point[0];
        let date = new Date(Number(bucket.startTimeMillis));
        rows.push({
          date: date.toISOString(),
          steps: point?.value[0]?.intVal,
          logId: `${user.id}-${bucket.startTimeMillis}`,
          user: user,
        });
      }

      return {
        result: rows,
        continuation: continuation,
      };
    },
  },
});

async function getUserInfo(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://www.googleapis.com/oauth2/v1/userinfo",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body;
}

function getDatePage(context: coda.ExecutionContext, fromDate: Date, toDate: Date, pageSizeDays: number) {
  let {timezone} = context;
  let fromDateTime = DateTime.fromJSDate(fromDate, {zone: timezone});
  let toDateTime = DateTime.fromJSDate(toDate, {zone: timezone});

  // Determine the start date for this execution.
  let startDateTime = fromDateTime;
  if (context.sync.continuation?.date) {
    startDateTime = DateTime.fromISO(context.sync.continuation.date as string, {zone: timezone});
  }

  // Determine the end date for this execution.
  let endDateTime = startDateTime.plus({days: pageSizeDays});
  if (endDateTime > toDateTime) {
    endDateTime = toDateTime;
  }

  return {
    start: startDateTime.toJSDate(),
    end: endDateTime.toJSDate(),
    continuation: endDateTime < toDateTime ? {date: endDateTime.toISO()} : undefined,
  };
}
