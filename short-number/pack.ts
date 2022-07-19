import * as coda from "@codahq/packs-sdk";
import abbreviate from 'number-abbreviate';

const DefaultDecimalPlaces = 1;

export const pack = coda.newPack();

pack.addFormula({
  name: "ShortNumber",
  description: "Abbreviate a number.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "number",
      description: "The number to shorten.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "decimalPlaces",
      description: `How many decimal places to include. Default: ${DefaultDecimalPlaces}`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    {params: [1234], result: "1.2k"},
    {params: [1234, 0], result: "1k"},
    {params: [1234, 2], result: "1.23k"},
  ],
  execute: async function ([number, decimalPlaces = DefaultDecimalPlaces], context) {
    return abbreviate(number, decimalPlaces);
  }
});