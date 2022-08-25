import * as coda from "@codahq/packs-sdk";
import * as phones from "awesome-phonenumber";

export const pack = coda.newPack();

const Formats = [
  "international",
  "national",
  "e164",
  "rfc3966",
  "significant",
];

const Types = [
  "fixed-line",
  "fixed-line-or-mobile",
  "mobile",
  "pager",
  "personal-number",
  "premium-rate",
  "shared-cost",
  "toll-free",
  "uan",
  "voip",
  "unknown",
];

const InputParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "input",
  description: "The input to check.",
});

const RegionParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "region",
  description: "The region of the phone number, if provided in a local format.",
  optional: true,
  autocomplete: phones.getSupportedRegionCodes(),
});

const PhoneFormatsSchema = coda.makeObjectSchema({
  properties: {
    international: { type: coda.ValueType.String },
    national: { type: coda.ValueType.String },
    e164: { type: coda.ValueType.String },
    rfc3966: { type: coda.ValueType.String },
    significant: { type: coda.ValueType.String },
  },
  displayProperty: "e164",
});

const PhoneSchema = coda.makeObjectSchema({
  properties: {
    input: { 
      type: coda.ValueType.String,
      description: "The original phone number."
    },
    formats: {
      ...PhoneFormatsSchema,
      description: "The phone number rewritten in various formats.",
    },
    type: {
      type: coda.ValueType.String,
      description: `The type of the phone number. One of: ${Types.join(", ")}`,
    },
    regionCode: {
      type: coda.ValueType.String,
      description: "The two-digit region code the phone number belongs to. For example, \"US\" or \"CA\".",
    },
    countryCode: {
      type: coda.ValueType.Number,
      description: "The numerical country code of the phone number.",
    },
    canBeInternationallyDialled: {
      type: coda.ValueType.Boolean,
      description: "If the phone number can be dialed internationally.",
    },
  },
  displayProperty: "input",
});

pack.addFormula({
  name: "IsPhoneNumber",
  description: "Determine if the input is a valid phone number.",
  parameters: [InputParameter, RegionParameter],
  resultType: coda.ValueType.Boolean,
  examples: [
    { params: ["+19164451254"], result: true },
    { params: ["+1 (916) 445-1254"], result: true },
    { params: ["916-445-1254", "US"], result: true },
    { params: ["9164451254", "US"], result: true },
    { params: ["9164451254"], result: false },
    { params: ["Chair"], result: false },
  ],
  execute: async function ([input, region], context) {
    return phones.parsePhoneNumber(input, region).isValid();
  },
});

pack.addFormula({
  name: "FormatPhoneNumber",
  description: "Returns the phone number in a standard format. Returns an error if the input is not a valid phone number.",
  parameters: [
    InputParameter,
    RegionParameter,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "format",
      description: "The format to return the phone number in. Default value: e164",
      optional: true,
      autocomplete: async function (context) {
        let parsed = phones.parsePhoneNumber("+19164451254");
        return Formats.map(format => {
          let example = parsed.getNumber(format as phones.PhoneNumberFormat);
          return { display: `${format} - ${example}`, value: format };
        })
      },
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["+19164451254"], result: "+19164451254" },
    { params: ["(916) 445-1254", "US"], result: "+19164451254" },
    { params: ["+19164451254", null, "e164"], result: "+19164451254" },
    { params: ["+19164451254", null, "international"], result: "+1 916-445-1254" },
    { params: ["+19164451254", null, "national"], result: "(916) 445-1254" },
    { params: ["+19164451254", null, "rfc3966"], result: "tel:+1-916-445-1254" },
    { params: ["+19164451254", null, "significant"], result: "9164451254" },
  ],
  execute: async function ([input, region, format], context) {
    return formatNumber(input, region, format);
  },
});

pack.addFormula({
  name: "PhoneNumberInfo",
  description: "Returns various information about the phone number, including the type, country code, region code, etc. Returns an error if the input is not a valid phone number.",
  parameters: [InputParameter, RegionParameter],
  resultType: coda.ValueType.Object,
  schema: PhoneSchema,
  examples: [
    {
      params: ["+19164451254"],
      result: {
        CanBeInternationallyDialled: true,
        Formats: {
          E164: "+19164451254",
          International: "+1 916-445-1254",
          National: "(916) 445-1254",
          Rfc3966: "tel:+1-916-445-1254",
          Significant: "9164451254",
        },
        Input: "+19164451254",
        RegionCode: "US",
        CountryCode: 1,
        Type: "fixed-line-or-mobile",
      },
    },
  ],
  execute: async function ([input, region], context) {
    let parsed = phones.parsePhoneNumber(input, region);
    if (!parsed.isValid()) {
      throw new coda.UserVisibleError(`Invalid phone number: ${input}`);
    }
    let result = parsed.toJSON();
    result.formats = result.number;
    result.input = result.number.input;
    result.countryCode = parsed.getCountryCode();
    return result;
  },
});

pack.addFormula({
  name: "FormatPhoneNumberUS",
  description: "Returns the United States (US) phone number in a standard format. Returns an error if the input is not a valid US phone number.",
  parameters: [
    InputParameter,
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["(916) 445-1254"], result: "(916) 445-1254" },
    { params: ["9164451254"], result: "(916) 445-1254" },
    { params: ["+19164451254"], result: "(916) 445-1254" },
  ],
  execute: async function ([input], context) {
    return formatNumber(input, "US", "national");
  },
});

pack.addFormula({
  name: "FormatPhoneNumberIntl",
  description: "Returns the international phone number in a standard format. It must include a plus and the country code. Returns an error if the input is not a valid phone number.",
  parameters: [
    InputParameter,
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["+1 916-445-1254"], result: "+1 916-445-1254" },
    { params: ["+1 9164451254"], result: "+1 916-445-1254" },
  ],
  execute: async function ([input], context) {
    return formatNumber(input, undefined, "international");
  },
});

pack.addColumnFormat({
  name: "US Phone Number",
  formulaName: "FormatPhoneNumberUS",
  instructions: "Paste in a United States (US) phone number and it will be formatted.",
});

pack.addColumnFormat({
  name: "International Phone Number",
  formulaName: "FormatPhoneNumberIntl",
  instructions: "Paste in an international phone number (include plus and country code) and it will be formatted.",
});

function formatNumber(input: string, region: string, format: string) {
  let parsed = phones.parsePhoneNumber(input, region);
  if (!parsed.isValid()) {
    throw new coda.UserVisibleError("Invalid phone number");
  }
  if (format && !Formats.includes(format)) {
    throw new coda.UserVisibleError("Invalid format");
  }
  return parsed.getNumber(format as phones.PhoneNumberFormat);
}