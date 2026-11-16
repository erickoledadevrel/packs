import * as sdk from "@superhuman/plugins-sdk";
import TOML from "smol-toml";

const OneDaySecs = 24 * 60 * 60;

const TOMLParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "toml",
  description: "The TOML contents as a string.",
});

const SpacesParam = sdk.makeParameter({
  type: sdk.ParameterType.Number,
  name: "spaces",
  description: "The number of spaces to indent by. Default: no indenting.",
  optional: true,
});

export const pack = sdk.newPack();

pack.addFormula({
  name: "FormatTOML",
  description: "Formats TOML content.",
  parameters: [
    TOMLParam,
  ],
  resultType: sdk.ValueType.String,
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
  resultType: sdk.ValueType.Boolean,
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
  resultType: sdk.ValueType.String,
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "json",
      description: "The JSON contents as a string.",
    }),
  ],
  resultType: sdk.ValueType.String,
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
    throw new sdk.UserVisibleError(e.message, e);
  } else if (e.toString().startsWith("SyntaxError")) {
    throw new sdk.UserVisibleError(e.message, e);
  }
  throw e;
}