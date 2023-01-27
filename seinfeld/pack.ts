import * as coda from "@codahq/packs-sdk";
const seinfeld = require("seinfeldapi/seinfeld.js");

export const pack = coda.newPack();

const QuoteSchema = coda.makeObjectSchema({
  properties: {
    text: {
      type: coda.ValueType.String,
      fromKey: "quote" ,
      description: "The text of the quote.",
    },
    from: {
      type: coda.ValueType.String,
      fromKey: "author",
      description: "Who said the quote.",
    },
    season: {
      type: coda.ValueType.String,
      description: "Which season the quote is from.",
    },
    episode: {
      type: coda.ValueType.String,
      description: "Which episode within the season the quote is from.",
    },
    quoteID: {
      type: coda.ValueType.Number,
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
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "randomNumber",
      description: "A random number between 0 and 1, created with the Random(false) formula.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: QuoteSchema,
  execute: async function (args, context) {
    let [rand] = args;
    let quotes = getQuotes();
    let index = Math.floor((quotes.length - 1) * rand);
    if (index < 0 || index > quotes.length - 1) {
      throw new coda.UserVisibleError(`Invalid random value: ${rand}. It must be between 0 and 1.`);
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
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
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
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
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
