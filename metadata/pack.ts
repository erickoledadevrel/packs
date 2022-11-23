import * as coda from "@codahq/packs-sdk";
const cheerio = require('cheerio');
// https://github.com/BetaHuhn/metadata-scraper/blob/master/src/rules.ts
const scraperRules = require("metadata-scraper/lib/rules");

export const pack = coda.newPack();

const MetadataSchema = coda.makeObjectSchema({
  properties: {
    title: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      description: "The title of the web page.",
    },
    description: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      description: "The description of the web page.",
    },
    language: {
      type: coda.ValueType.String,
      description: "The language code for language of the content of the web page.",
    },
    type: {
      type: coda.ValueType.String,
      description: "The Open Graph type of the content of the web page. See https://ogp.me.",
    },
    url: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "The canonical URL of the web page.",
    },
    provider: {
      type: coda.ValueType.String,
      description: "The organization providing the web page.",
    },
    keywords: {
      type: coda.ValueType.Array,
      items: {
        type: coda.ValueType.String,
      },
      description: "The keywords associated with the web page.",
    },
    author: {
      type: coda.ValueType.String,
      description: "The author of the web page.",
    },
    published: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      description: "The date and time the web page was published.",
    },
    modified: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      description: "The date and time the web page was last modified.",
    },
    copyright: {
      type: coda.ValueType.String,
      description: "The copyright information for the web page.",
    },
    email: {
      type: coda.ValueType.String,
      description: "The email address associated with the web page.",
    },
    twitter: {
      type: coda.ValueType.String,
      description: "The Twitter handle associated with the web page.",
    },
    facebook: {
      type: coda.ValueType.String,
      description: "The Facebook page associated with the web page.",
    },
    image: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "The primary image of the web page.",
    },
    icon: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "The icon of the web page.",
    },
    video: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Embed,
      description: "The primary video of the web page.",
    },
    audio: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Embed,
      description: "The primary audio of the web page.",
    },
  }
});

pack.addNetworkDomain("httpbin.org");

pack.addFormula({
  name: "Metadata",
  description: "Gets metdata about a specific web page.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL of the webpage to parse."
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: MetadataSchema,
  execute: async function (args, context) {
    let [url] = args;
    let httpbinUrl = coda.withQueryParams("https://httpbin.org/redirect-to", {
      url: url,
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: httpbinUrl,
    });
    let result = getMetdata(url, response.body);
    return result;
  },
});

pack.addColumnFormat({
  name: "Metadata",
  formulaName: "Metadata",
  instructions: "Paste a URL to get metadata about it.",
});

function getMetdata(url, html) {
  let $ = cheerio.load(html);
  let rules = scraperRules.metaDataRules as Record<string, any>
  let context = {
    url: url,
    options: {
      forceImageHttps: true,
    },
  };

  let result: any = {};
  for (let [key, config] of Object.entries(rules)) {
    let value;
    for (let rule of config.rules) {
      let [query, func] = rule;
      let elem = $(query).get(0);
      if (elem) {
        elem.getAttribute = getAttribute;
        value = func(elem);
        if (value) {
          if (config.processor) {
            value = config.processor(value, context);
          }
          break;
        }
      }
    }
    result[key] = value;
  }
  return result;
}

function getAttribute (name) {
  return this.attribs[name];
}
