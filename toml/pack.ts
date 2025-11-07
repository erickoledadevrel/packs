import * as coda from "@codahq/packs-sdk";
import TOML from "smol-toml";

const OneDaySecs = 24 * 60 * 60;

const TOMLParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "toml",
  description: "The TOML contents as a string.",
});

const SpacesParam = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "spaces",
  description: "The number of spaces to indent by. Default: no indenting.",
  optional: true,
});

export const pack = coda.newPack();

pack.addFormula({
  name: "FormatTOML",
  description: "Formats TOML content.",
  parameters: [
    TOMLParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`foo="bar"`], result: `foo = "bar"` },
  ],
  onError,
  execute: async function (args, context) {
    let [toml] = args;
    let value = TOML.parse(toml);
    return TOML.stringify(value);
  },
});

pack.addFormula({
  name: "IsValidTOML",
  description: "Returns true if the content is valid TOML, false otherwise.",
  parameters: [
    TOMLParam,
  ],
  resultType: coda.ValueType.Boolean,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { 
      params: [`foo = "bar"`], result: true },
    { params: [`foo: bar`, ], result: false },
  ],
  execute: async function (args, context) {
    let [toml] = args;
    try {
      TOML.parse(toml);
    } catch (e) {
      if (e.message.startsWith("Invalid TOML")) {
        return false;
      }
      throw e;
    }
    return true;
  },
});

pack.addFormula({
  name: "ToJSON",
  description: "Converts a TOML string to JSON.",
  parameters: [
    TOMLParam,
    SpacesParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`foo = "bar"`], result: `{"foo":"bar"}` },
  ],
  onError,
  execute: async function (args, context) {
    let [toml, spaces] = args;
    let value = TOML.parse(toml);
    return JSON.stringify(value, null, spaces);
  },
});

pack.addFormula({
  name: "ToTOML",
  description: "Converts a JSON string to TOML.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "json",
      description: "The JSON contents as a string.",
    }),
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`{"foo": "bar"}`], result: `foo = "bar"` },
  ],
  onError,
  execute: async function (args, context) {
    let [json] = args;
    let value = JSON.parse(json);
    return TOML.stringify(value);
  },
});

function onError(e) {
  if (e.message.startsWith("Invalid TOML")) {
    throw new coda.UserVisibleError(e.message, e);
  } else if (e.toString().startsWith("SyntaxError")) {
    throw new coda.UserVisibleError(e.message, e);
  }
  throw e;
}