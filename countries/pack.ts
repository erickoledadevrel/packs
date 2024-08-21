import * as coda from "@codahq/packs-sdk";
import { countries, languages, continents, getEmojiFlag, TCountryCode } from "countries-list";

export const pack = coda.newPack();

const ContinentSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    code: { type: coda.ValueType.String },
  },
  displayProperty: "name",
});

const LanguageSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    code: { type: coda.ValueType.String, description: "ISO 639-1" },
    localized: { type: coda.ValueType.String, fromKey: "native" },
  },
  displayProperty: "name",
});

const CountrySchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    code: { type: coda.ValueType.String, description: "ISO 3166-1 alpha-2" },
    localized: { type: coda.ValueType.String, fromKey: "native" },
    continent: ContinentSchema,
    capital: { type: coda.ValueType.String },
    languages: {
      type: coda.ValueType.Array,
      items: LanguageSchema,
    },
    callingCodes: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.Number },
      fromKey: "phone",
    },
    currencyCodes: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
      fromKey: "currency",
      description: "ISO 4217",
    },
    flagEmoji: { 
      type: coda.ValueType.String,
      description: "Flag emojis may not be rendered correctly on some devices."
    },
  },
  displayProperty: "name",
  idProperty: "code",
  featuredProperties: ["code", "languages"],
});

pack.addSyncTable({
  name: "Countries",
  description: "Lists all of countries (as defined by ISO 3166).",
  identityName: "Country",
  schema: CountrySchema,
  formula: {
    name: "SyncCountries",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let rows = Object.keys(countries).map(code => {
        return getCountry(code);
      });
      return {
        result: rows,
      };
    },
  },
});

pack.addFormula({
  name: "Country",
  description: "Get country information from a country code.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "code",
      description: "The ISO 3166-1 alpha-2 country code.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: CountrySchema,
  examples: [
    { params: ["US"], result: getCountry("US") },
  ],
  execute: async function (args, context) {
    let [code] = args;
    return getCountry(code);
  },
});

pack.addColumnFormat({
  name: "Country",
  instructions: "Enter a two letter country code.",
  formulaName: "Country",
});

function getCountry(code: string) {
  let country = countries[code];
  if (!country) {
    throw new coda.UserVisibleError(`Unknown country code: ${code}`);
  }
  return {
    code,
    ...country,
    continent: {
      code: country.continent,
      name: continents[country.continent],
    },
    languages: country.languages.map(lang => {
      return {
        code: lang,
        ...languages[lang],
      };
    }),
    flagEmoji: getEmojiFlag(code as TCountryCode),
  };
}