import * as sdk from "@superhuman/plugins-sdk";
const Spinner = require('node-spintax');

export const pack = sdk.newPack();

const DefaultUnique = false;

pack.addFormula({
  name: "GenerateAll",
  description: "Generate all the variations of the spintax string.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: {type: sdk.ValueType.String},
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "variations",
      description: "How many variations to generate.",
      suggestedValue: 10,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "unique",
      description: `If each of the generated variations should be unique. Default: ${DefaultUnique}`,
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: {type: sdk.ValueType.String},
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "spintax",
      description: "A string in the spintax format.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: {type: sdk.ValueType.String},
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "format",
      description: "The base format string, which contains a placeholders like {1} where the options should be inserted.",
    }),
  ],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "options",
      description: "The options available for a given placeholder. The first list of options will replace the {1} placeholder, etc.",
    }),
  ],
  resultType: sdk.ValueType.String,
  examples: [
    {
      params: ["Hello {1}!", ["World", "Earth", "Humans"]],
      result: "Hello {World|Earth|Humans}!",
    },
  ],
  execute: async function (args, context) {
    let [format, ...allOptions] = args;
    for (let [i, options] of allOptions.entries()) {
      format = format.replace(new RegExp(`\\{${i + 1}\\}`, "g"), `{${options.filter(Boolean).join("|")}}`)
    }
    return format;
  },
});
