import * as coda from "@codahq/packs-sdk";
const RegexEscape = require("regex-escape");

export const pack = coda.newPack();

pack.addFormula({
  name: "RegexCapture",
  description: "Executes a regular expression on text and returns the values of the capture groups.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to apply it to.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "regex",
      description: "The regular expression to apply.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "flags",
      description: `Any regular expression flags to use (ex: "g", "i", etc). Using the "g" flag will change the behavior of the formula, returning all of the full matches and ignoring capture groups.`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },
  examples: [
    {params: ["Hello Packs", "H.*o"], result: ["Hello"]},
    {params: ["Hello Packs", "H(.*)o"], result: ["Hello", "ell"]},
    {params: ["Hello Packs", "H(.*)o P(.*)s"], result: ["Hello Packs", "ell", "ack"]},
    {params: ["Hello Packs", "H.*y"], result: []},
    {params: ["Hello Packs", "h.*o", "i"], result: ["Hello"]},
    {params: ["Hello Packs", "(H|P).", "g"], result: ["He", "Pa"]},
  ],
  execute: async function (args, context) {
    let [text, regex, flags = ""] = args;
    let r = new RegExp(regex, flags);
    let match = text.match(r);
    if (!match) {
      return [];
    }
    return match;
  },
});

pack.addFormula({
  name: "RegexEscape",
  description: "Escapes special characters in a string, so it's safe to use as a literal value in a regular expression.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to escape.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    {params: ["*Hello* World."], result: "\\*Hello\\* World\\."},
  ],
  execute: async function (args, context) {
    let [text] = args;
    return RegexEscape(text);
  },
});
