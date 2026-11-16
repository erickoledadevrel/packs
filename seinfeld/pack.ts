import * as sdk from "@superhuman/plugins-sdk";
const seinfeld = require("seinfeldapi/seinfeld.js");

export const pack = sdk.newPack();

const QuoteSchema = sdk.makeObjectSchema({
  properties: {
    text: {
      type: sdk.ValueType.String,
      fromKey: "quote" ,
      description: "The text of the quote.",
    },
    from: {
      type: sdk.ValueType.String,
      fromKey: "author",
      description: "Who said the quote.",
    },
    season: {
      type: sdk.ValueType.String,
      description: "Which season the quote is from.",
    },
    episode: {
      type: sdk.ValueType.String,
      description: "Which episode within the season the quote is from.",
    },
    quoteID: {
      type: sdk.ValueType.Number,
      fromKey: "id",
      description: "The internal ID of the quote.",
    },
  },
  displayProperty: "text",
  idProperty: "quoteID",
  featuredProperties: ["from", "season"],
});

pack.addFormula({
  name: "RandomQuote",
  description: "Get a random quote.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "randomNumber",
      description: "A random number between 0 and 1, created with the Random(false) formula.",
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: QuoteSchema,
  execute: async function (args, context) {
    let [rand] = args;
    let quotes = getQuotes();
    let index = Math.floor((quotes.length - 1) * rand);
    if (index < 0 || index > quotes.length - 1) {
      throw new sdk.UserVisibleError(`Invalid random value: ${rand}. It must be between 0 and 1.`);
    }
    return quotes[index];
  },
});

pack.addSyncTable({
  name: "Quotes",
  identityName: "Quote",
  description: "A table containing hundreds of quotes.",
  schema: QuoteSchema,
  formula: {
    name: "SyncQuotes",
    description: "Syncs the quotes.",
    parameters: [
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "from",
        description: "Only sync quotes from these characters.",
        optional: true,
        autocomplete: getQuotes().reduce((result, quote) => {
          let from = quote.author.trim();
          if (!result.includes(from)) {
            result.push(from);
          }
          return result;
        }, []).sort(),
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "season",
        description: "Only sync quotes from these seasons.",
        optional: true,
        autocomplete: getQuotes().reduce((result, quote) => {
          if (!result.includes(quote.season)) {
            result.push(quote.season);
          }
          return result;
        }, []).sort(),
      }),
    ],
    execute: async function (args, context) {
      let [from, season] = args;
      let quotes = getQuotes().filter(quote => {
        if (from?.length && !from.includes(quote.author.trim())) {
          return false;
        }
        if (season?.length && !season.includes(quote.season)) {
          return false;
        }
        return true;
      })
      return {
        result: quotes,
      }
    },
  }
})

function getQuotes() {
  return seinfeld.quotes.map((quote, index) => {
    return {
      ...quote,
      id: index,
    };
  });
}
