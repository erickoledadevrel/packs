import * as coda from "@codahq/packs-sdk";
const Spinner = require('node-spintax');

export const pack = coda.newPack();

const DefaultUnique = false;

pack.addFormula({
  name: "GenerateAll",
  description: "Generate all the variations of the spintax string.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: {type: coda.ValueType.String},
  examples: [
    {
      params: ["Hello {World|Earth|Humans}!"],
      result: ["Hello World!", "Hello Earth!", "Hello Humans!"],
    },
  ],
  execute: async function (args, context) {
    let [spintax] = args;
    let spinner = new Spinner(spintax);
    return spinner.unspin();
  },
});

pack.addFormula({
  name: "GenerateSome",
  description: "Generate a number of random variations of the spintax string.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "variations",
      description: "How many variations to generate.",
      suggestedValue: 10,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "unique",
      description: `If each of the generated variations should be unique. Default: ${DefaultUnique}`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Array,
  items: {type: coda.ValueType.String},
  cacheTtlSecs: 0,
  examples: [
    {
      params: ["Hello {World|Earth|Humans}!", 2],
      result: ["Hello World!", "Hello Humans!"],
    },
  ],
  execute: async function (args, context) {
    let [spintax, variations, unique = DefaultUnique] = args;
    let spinner = new Spinner(spintax);
    if (unique && spinner.countVariations() < variations) {
      variations = spinner.countVariations();
    }
    return spinner.unspinRandom(variations, unique);
  },
});

pack.addFormula({
  name: "Generate",
  description: "Generate a random variation of the spintax string.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: {type: coda.ValueType.String},
  cacheTtlSecs: 0,
  examples: [
    {
      params: ["Hello {World|Earth|Humans}!"],
      result: "Hello Earth!",
    },
  ],
  execute: async function (args, context) {
    let [spintax] = args;
    let spinner = new Spinner(spintax);
    return spinner.unspinRandom(1);
  },
});

pack.addFormula({
  name: "Build",
  description: "Builds a string in the spintax format, from a base string and columns of possible options.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "format",
      description: "The base format string, which contains a placeholders like {1} where the options should be inserted.",
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseStringArray,
      name: "options",
      description: "The options available for a given placeholder. The first list of options will replace the {1} placeholder, etc.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    {
      params: ["Hello {1}!", ["World", "Earth", "Humans"]],
      result: "Hello {World|Earth|Humans}!",
    },
  ],
  execute: async function (args, context) {
    // TODO: Unpack the parameter values.
    let [format, ...allOptions] = args;
    for (let [i, options] of allOptions.entries()) {
      format = format.replace(new RegExp(`\\{${i + 1}\\}`, "g"), `{${options.filter(Boolean).join("|")}}`)
    }
    return format;
  },
});
