import * as sdk from "@superhuman/plugins-sdk";
import YAML from "yaml";

const OneDaySecs = 24 * 60 * 60;

export const pack = sdk.newPack();

const YAMLParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "yaml",
  description: "The YAML contents as a string.",
});

const IndentParam = sdk.makeParameter({
  type: sdk.ParameterType.Number,
  name: "indent",
  description: "The number of spaces to indent by. Default: 2.",
  optional: true,
});

pack.addFormula({
  name: "FormatYAML",
  description: "Formats YAML content using the options provided.",
  parameters: [
    YAMLParam,
    IndentParam,
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { 
      params: [`a: [1, 2]`], 
      result: trimIndent(`
        a:
          - 1
          - 2
      `),
    },
    { 
      params: [`a: [1, 2]`, 4], 
      result: trimIndent(`
        a:
            - 1
            - 2
      `),
    },
  ],
  execute: async function (args, context) {
    let [yaml, indent] = args;
    let options: Record<string, any> = {};
    if (typeof indent == "number") {
      options.indent = indent;
    }
    let value = parse(yaml);
    return YAML.stringify(value, null, options);
  },
});

pack.addFormula({
  name: "IsValidYAML",
  description: "Returns true if the content is valid YAML, false otherwise.",
  parameters: [
    YAMLParam,
  ],
  resultType: sdk.ValueType.Boolean,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`a: [1, 2]`], result: true },
    { params: [`a: [1, 2`, ], result: false },
  ],
  execute: async function (args, context) {
    let [yaml] = args;
    try {
      YAML.parse(yaml);
    } catch (e) {
      if (e.toString().startsWith("YAMLParseError")) {
        return false;
      }
      throw e;
    }
    return true;
  },
});

pack.addFormula({
  name: "ToJSON",
  description: "Converts a YAML string to JSON.",
  parameters: [
    YAMLParam,
    IndentParam,
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`a: [1, 2]`], result: `{"a":[1,2]}` },
    { 
      params: [`a: [1, 2]`, 2], 
      result: trimIndent(`
        {
          "a": [
            1,
            2
          ]
        }
      `, true)
    },
  ],
  execute: async function (args, context) {
    let [yaml, spaces] = args;
    let value = parse(yaml);
    return JSON.stringify(value, null, spaces);
  },
});

pack.addFormula({
  name: "ToYAML",
  description: "Converts a JSON string to YAML.",
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
    { 
      params: [`{"a":[1,2]}`], 
      result: trimIndent(`
        a:
          - 1
          - 2
      `),
    },
  ],
  execute: async function (args, context) {
    let [json] = args;
    try {
      let value = JSON.parse(json);
      return YAML.stringify(value);
    } catch (e) {
      if (e.toString().startsWith("SyntaxError")) {
        throw new sdk.UserVisibleError(e);
      }
      throw e;
    }
  },
});

function parse(yaml: string) {
  try {
    return YAML.parse(yaml);
  } catch (e) {
    if (e.toString().startsWith("YAMLParseError")) {
      throw new sdk.UserVisibleError(e);
    }
    throw e;
  }
}

function trimIndent(str: string, trim = false) {
  let lines = str.split("\n");
  if (lines[0] == "") {
    lines = lines.slice(1);
  }
  if (lines.at(-1) == "") {
    lines = lines.slice(0, -1);
  }
  let indent = lines[0].match(/^\s*/)[0].length;
  let result = lines.map(line => line.substring(indent)).join("\n");
  if (trim) {
    result = result.trim();
  }
  return result;
}