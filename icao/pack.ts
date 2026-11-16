import * as sdk from "@superhuman/plugins-sdk";
import tokenizeWords from "tokenize-words";

export const pack = sdk.newPack();

const CodeWords = [
  "Alfa",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
  "Juliett",
  "Kilo",
  "Lima",
  "Mike",
  "November",
  "Oscar",
  "Papa",
  "Quebec",
  "Romeo",
  "Sierra",
  "Tango",
  "Uniform",
  "Victor",
  "Whiskey",
  "Xray",
  "Yankee",
  "Zulu",
];

const CodeWordMap = CodeWords.reduce((result, word) => {
  result[word[0].toUpperCase()] = word;
  return result;
}, {});

pack.addFormula({
  name: "TranslateWord",
  description: "Translates a word into a series of codewords, as a list.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "word",
      description: "The word to translate.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: { type: sdk.ValueType.String },
  execute: async function (args, context) {
    let [word] = args;
    if (!word) {
      return [];
    }
    let words = tokenizeWords(word);
    if (words.length > 1) {
      throw new sdk.UserVisibleError("The input must be a single word.")
    }
    return words[0].split("")
      .map(letter => CodeWordMap[letter.toUpperCase()])
      .filter(word => word);
  },
});

pack.addFormula({
  name: "TranslateText",
  description: "Translates text into codewords, as a list of lists.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "text",
      description: "The text to translate.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: { 
    type: sdk.ValueType.Array, 
    items: { type: sdk.ValueType.String },
  },
  execute: async function (args, context) {
    let [text] = args;
    if (!text) {
      return [];
    }
    let words = tokenizeWords(text);
    return words.map(
      word => word.split("")
        .map(letter => CodeWordMap[letter.toUpperCase()])
        .filter(word => word)
    );
  },
});

const CodeWordSchema = sdk.makeObjectSchema({
  properties: {
    letter: { type: sdk.ValueType.String },
    codeWord: { type: sdk.ValueType.String },
  },
  displayProperty: "codeWord",
  idProperty: "letter",
  featuredProperties: ["letter"],
});

pack.addSyncTable({
  name: "CodeWords",
  description: "Lists the code words in the alphabet.",
  identityName: "Word",
  schema: CodeWordSchema,
  formula: {
    name: "SyncCodeWords",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let rows = CodeWords.sort().map(word => {
        return {
          codeWord: word,
          letter: word[0],
        };
      });
      return {
        result: rows,
      };
    },
  },
});