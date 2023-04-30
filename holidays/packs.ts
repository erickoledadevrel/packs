import * as coda from "@codahq/packs-sdk";
const Holidays = require('date-holidays');
const crypto = require("crypto");

export const pack = coda.newPack();

const HolidayTypes = ["public", "bank", "school", "observance"];

const DateParameter = coda.makeParameter({
  type: coda.ParameterType.Date,
  name: "date",
  description: "The date to check.",
});

const CountryParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "country",
  description: "The target country.",
  autocomplete: async function (context, search) {
    let hd = getHolidayDatabase(context);
    let countries: Record<string, string> = hd.getCountries("en");
    if (!countries) return [];
    let options = Object.entries(countries).map(([key, value]) => {
      return {
        display: value,
        value: key,
      };
    });
    return options;
  },
});

const StateParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "state",
  description: "The target state or province within the country.",
  optional: true,
  autocomplete: async function (context, search, args) {
    let hd = getHolidayDatabase(context);
    let states: Record<string, string> = hd.getStates(args.country, "en");
    if (!states) return [];
    let options = Object.entries(states).map(([key, value]) => {
      return {
        display: value,
        value: key,
      };
    });
    return options;
  },
});

const RegionParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "region",
  description: "The target region (e.g. city) within the state or province.",
  optional: true,
  autocomplete: async function (context, search, args) {
    let hd = getHolidayDatabase(context);
    let regions: Record<string, string> = hd.getRegions(args.country, args.region, "en");
    if (!regions) return [];
    let options = Object.entries(regions).map(([key, value]) => {
      return {
        display: value,
        value: key,
      };
    });
    return options;
  },
});

const TypesParameter = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "type",
  description: `The types of holidays to return. Options: ${HolidayTypes.join(", ")}`,
  optional: true,
  autocomplete: HolidayTypes,
});

const LocationSchema = coda.makeObjectSchema({
  description: "The location that celebrates the holiday.",
  properties: {
    country: { type: coda.ValueType.String, description: "The country." },
    state: { type: coda.ValueType.String, description: "The state or province." },
    region: { type: coda.ValueType.String, description: "The region (e.g. city)." },
  },
  displayProperty: "country",
});

const HolidaySchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, description: "The name of the holiday." },
    type: { type: coda.ValueType.String, description: "The type of holiday." },
    date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
      description: "The date of the holiday.",
    },
    location: LocationSchema,
    holidayId: { type: coda.ValueType.String, description: "The unique ID of the holiday." },
  },
  displayProperty: "name",
  idProperty: "holidayId",
  featuredProperties: ["date", "type"],
});

pack.addFormula({
  name: "IsHoliday",
  description: "Determines if the given date lands on a holiday.",
  parameters: [
    DateParameter,
    CountryParameter,
    StateParameter,
    RegionParameter,
    TypesParameter,
  ],
  resultType: coda.ValueType.Boolean,
  execute: async function (args, context) {
    let [
      date,
      country,
      state,
      region,
      types,
    ] = args;
    let year = getYear(context, date);
    let location = {country, state, region};
    let holidays = getHolidays(context, year, location, types);
    let iso = getLocalISO(context, date);
    return holidays
      .map(holiday => formatHoliday(holiday))
      .filter(holiday => holiday.date == iso)
      ?.length > 0;
  },
});

pack.addFormula({
  name: "Holidays",
  description: "Gets the holidays that fall on a given date.",
  parameters: [
    DateParameter,
    CountryParameter,
    StateParameter,
    RegionParameter,
    TypesParameter,
  ],
  resultType: coda.ValueType.Array,
  items: HolidaySchema,
  execute: async function (args, context) {
    let [
      date,
      country,
      state,
      region,
      types,
    ] = args;
    let year = getYear(context, date);
    let location = {country, state, region};
    let holidays = getHolidays(context, year, location, types);
    let iso = getLocalISO(context, date);
    return holidays
      .map(holiday => formatHoliday(holiday))
      .filter(holiday => holiday.date == iso);
  },
});

pack.addSyncTable({
  name: "Holidays",
  description: "Lists the holidays for a given year.",
  identityName: "Holiday",
  schema: HolidaySchema,
  formula: {
    name: "SyncHolidays",
    description: "Syncs the holidays.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.Number,
        name: "year",
        description: "The target year.",
      }),
      CountryParameter,
      StateParameter,
      RegionParameter,
      TypesParameter,
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeLocation",
        description: "Whether to include the location in the result. This prevents holidays from multiple syncs from being merged together.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [
        year,
        country,
        state,
        region,
        types,
        includeLocation,
      ] = args;
      let location = {country, state, region};
      let holidays = getHolidays(context, year, location, types);
      return {
        result: holidays.map(holiday => formatHoliday(holiday, includeLocation ? location : undefined)),
      };
    }
  }
});

function getYear(context: coda.ExecutionContext, date: Date) {
  let formatted = date.toLocaleDateString("en", {
    timeZone: context.timezone,
    year: "numeric",
  });
  return Number(formatted);
}

function getLocalISO(context: coda.ExecutionContext, date: Date) {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone,
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

  return `${year}-${month}-${day}`;
}

function getHolidayDatabase(context, location?: Location) {
  return new Holidays(location?.country, location?.state, location?.region, {
    timezone: context.timezone,
    languages: "en",
  });
}

function getHolidays(context: coda.ExecutionContext, year: number, location: Location, types?: string[]) {
  let hd = getHolidayDatabase(context, location);
  let holidays = hd.getHolidays(year) || [];
  if (types?.length > 0) {
    holidays = holidays.filter(holiday => types.includes(holiday.type));
  }
  return holidays;
}

function formatHoliday(holiday: Holiday, location?: Location) {
  let name = formatName(holiday.name);
  let key = [name, holiday.date];
  if (location) {
    key = key.concat([location.country, location.state, location.region].filter(Boolean));
  }
  let slug = key.join(",");
  let holidayId = crypto.createHash("md5").update(slug).digest("base64").toString();
  let result: any = {
    ...holiday,
    date: holiday.date.split(" ")[0],
    name: name,
    holidayId: holidayId,
  };
  if (location) {
    result.location = location;
  }
  return result;
}

function formatName(name) {
  return  name.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

interface Holiday {
  date: string;
  name: string;
  type: string;
}

interface Location {
  country: string;
  state?: string;
  region?: string;
}
