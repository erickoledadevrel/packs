import * as coda from "@codahq/packs-sdk";
import * as c from "case";

export const pack = coda.newPack();

pack.addFormula({
  name: "Snake",
  description: "Converts text to snake case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "hello_world" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.snake(text);
  },
});

pack.addFormula({
  name: "Pascal",
  description: "Converts text to Pascal case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "HelloWorld" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.pascal(text);
  },
});

pack.addFormula({
  name: "Camel",
  description: "Converts text to camel case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "helloWorld" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.camel(text);
  },
});

pack.addFormula({
  name: "Kebab",
  description: "Converts text to kebab case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "hello-world" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.kebab(text);
  },
});

pack.addFormula({
  name: "Header",
  description: "Converts text to header case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "Hello-World" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.header(text);
  },
});

pack.addFormula({
  name: "Constant",
  description: "Converts text to constant case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "HELLO_WORLD" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.constant(text);
  },
});

pack.addFormula({
  name: "Title",
  description: "Converts text to title case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["Hello world!"], result: "Hello World!" },
    { params: ["snake_case"], result: "Snake Case" },
    { params: ["camelCase"], result: "Camel Case" },
  ],
  execute: async function (args, context) {
    let [text] = args;
    return c.title(text);
  },
});

pack.addFormula({
  name: "Sentence",
  description: "Converts text to sentence case.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to convert.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.StringArray,
      name: "names",
      description: "Names to keep capitalized.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.StringArray,
      name: "abbreviations",
      description: "Abbreviations that appear with a period.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: ["this_is_cool"], result: "This is cool" },
    { params: ["a man. a plan."], result: "A man. A plan." },
    { params: ["see spot run", ["spot"]], result: "See Spot run" },
    { params: ["the 12 oz. can", null, ["oz"]], result: "The 12 oz. can" },
  ],
  execute: async function (args, context) {
    let [text, names, abbreviations] = args;
    return c.sentence(text, names, abbreviations);
  },
});
