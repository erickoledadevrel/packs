import * as coda from "@codahq/packs-sdk";
import * as TOON from "@toon-format/toon";

const OneDaySecs = 24 * 60 * 60;

const Delimiters = {
  "comma": ",",
   "tab": "\t",
   "pipe": "|",
};

const TOONParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "toon",
  description: "The TOON contents as a string.",
});

const SpacesParam = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "spaces",
  description: "The number of spaces to indent by. Default: 2.",
  optional: true,
});

const DelimiterParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "delimiter",
  description: `The character to use to separate array values. One of: ${Object.keys(Delimiters).join(", ")}. Default: comma.`,
  autocomplete: Object.keys(Delimiters),
  optional: true,
});

export const pack = coda.newPack();

pack.addFormula({
  name: "ToTOON",
  description: "Converts a JSON string to TOON.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "json",
      description: "The JSON contents as a string.",
    }),
    SpacesParam,
    DelimiterParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`{"foo":"bar"}`], result: `foo: bar` },
  ],
  onError,
  execute: async function (args, context) {
    let [json, spaces, delimiter] = args;
    let value = JSON.parse(json);
    return TOON.encode(value, {
      indent: spaces,
      delimiter: getDelimiter(delimiter),
    });
  },
});

pack.addFormula({
  name: "ToJSON",
  description: "Converts a TOON string to JSON.",
  parameters: [
    TOONParam,
    SpacesParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`foo: bar`], result: `{"foo":"bar"}` },
  ],
  onError,
  execute: async function (args, context) {
    let [toon, spaces] = args;
    let value = parseToon(toon)
    return JSON.stringify(value, null, spaces);
  },
});

pack.addFormula({
  name: "IsValidTOON",
  description: "Returns true if the content is valid TOON, false otherwise.",
  parameters: [
    TOONParam,
  ],
  resultType: coda.ValueType.Boolean,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { 
      params: [`foo: bar`], result: true },
    { params: [`foo: "bar`, ], result: false },
  ],
  execute: async function (args, context) {
    let [toon] = args;
    try {
      parseToon(toon);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return false;
      }
      throw e;
    }
    return true;
  },
});

pack.addFormula({
  name: "FormatTOON",
  description: "Formats TOON content.",
  parameters: [
    TOONParam,
    SpacesParam,
    DelimiterParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`foo:bar`], result: `foo: bar` },
  ],
  onError,
  execute: async function (args, context) {
    let [toon, spaces, delimiter] = args;
    let value = parseToon(toon);
    return TOON.encode(value, {
      indent: spaces,
      delimiter: getDelimiter(delimiter),
    });
  },
});

function getDelimiter(delimiter) {
  if (!delimiter) return delimiter;
  if (!Object.keys(Delimiters).includes(delimiter)) {
    throw new coda.UserVisibleError(`Unsupported delimiter: ${delimiter}`);
  }
  return Delimiters[delimiter];
}

function parseToon(toon: string) {
  return TOON.decode(toon
    .trim()
    .replaceAll("\n\n", "\n"), 
    {strict: true}
  );
}

function onError(e) {
  if (e instanceof SyntaxError) {
    throw new coda.UserVisibleError(e.message, e);
  }
  throw e;
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