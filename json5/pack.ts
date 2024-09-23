import * as coda from "@codahq/packs-sdk";
import JSON5 from "json5";

const OneDaySecs = 24 * 60 * 60;

export const pack = coda.newPack();

const JSON5Param = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "json5",
  description: "The JSON5 contents as a string.",
});

const SpacesParam = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "spaces",
  description: "The number of spaces to indent by. Default: no indenting.",
  optional: true,
});

pack.addFormula({
  name: "FormatJSON5",
  description: "Formats JSON5 content using the options provided.",
  parameters: [
    JSON5Param,
    SpacesParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "quote",
      description: "Which quote to use around strings. Default: single quote (').",
      optional: true,
      autocomplete: [
        { display: `Single quote (')`, value: `'` },
        { display: `Double quote (")`, value: `"` },
      ],
    }),
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`{a: 1, b: "foo"}`], result: `{a:1,b:'foo'}` },
    { 
      params: [`{a: 1, b: "foo"}`, 2], 
      result: trimIndent(`
        {
          a: 1,
          b: 'foo',
        }
      `),
    },
    { params: [`{a: 1, b: "foo"}`, 0, '"'], result: `{a:1,b:"foo"}` },
  ],
  execute: async function (args, context) {
    let [json5, space, quote] = args;
    let value = parse(json5);
    return JSON5.stringify(value, {space, quote});
  },
});

pack.addFormula({
  name: "IsValidJSON5",
  description: "Returns true if the content is valid JSON5, false otherwise.",
  parameters: [
    JSON5Param,
  ],
  resultType: coda.ValueType.Boolean,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`{a: 1}`], result: true },
    { params: [`{a: 1`, ], result: false },
  ],
  execute: async function (args, context) {
    let [json5] = args;
    try {
      JSON5.parse(json5);
    } catch (e) {
      if (e.toString().startsWith("SyntaxError")) {
        return false;
      }
      throw e;
    }
    return true;
  },
});

pack.addFormula({
  name: "ToJSON",
  description: "Converts a JSON5 string to JSON.",
  parameters: [
    JSON5Param,
    SpacesParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`{a: 1, b:'foo'}`], result: `{"a":1,"b":"foo"}` },
    { 
      params: [`{a:1,b:'foo'}`, 2], 
      result: trimIndent(`
        {
          "a": 1,
          "b": "foo"
        }
      `)
    },
  ],
  execute: async function (args, context) {
    let [json5, spaces] = args;
    let value = parse(json5);
    return JSON.stringify(value, null, spaces);
  },
});

function parse(json5: string) {
  try {
    return JSON5.parse(json5);
  } catch (e) {
    if (e.toString().startsWith("SyntaxError")) {
      throw new coda.UserVisibleError(e);
    }
    throw e;
  }
}

function trimIndent(str: string) {
  let lines = str.split("\n");
  if (lines[0] == "") {
    lines = lines.slice(1);
  }
  if (lines.at(-1) == "") {
    lines = lines.slice(0, -1);
  }
  let indent = lines[0].match(/^\s*/)[0].length;
  return lines.map(line => line.substring(indent)).join("\n").trim();
}