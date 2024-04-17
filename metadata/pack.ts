import * as coda from "@codahq/packs-sdk";
const cheerio = require('cheerio');
// https://github.com/BetaHuhn/metadata-scraper/blob/master/src/rules.ts
const scraperRules = require("metadata-scraper/lib/rules");

export const pack = coda.newPack();

const OneHourSecs = 1 * 60 * 60;
const RedirectBaseUrl = "https://redirect.erickoleda.com";

const MetadataSchema = coda.makeObjectSchema({
  properties: {
    label: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      description: "The label to show for the web page. Default to the title.",
    },
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
  },
  displayProperty: "label",
});

pack.addNetworkDomain("erickoleda.com");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

pack.addFormula({
  name: "WebPageMetadata",
  description: "Gets metdata (title, icon, etc.) about a specific web page.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL of the web page to inspect. It must be a public URL that doesn't require the user to sign in."
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: MetadataSchema,
  cacheTtlSecs: OneHourSecs,
  execute: async function (args, context) {
    let [url] = args;
    if (!url.toLocaleLowerCase().startsWith("https://")) {
      throw new coda.UserVisibleError("The URL must start with 'https://'.");
    }
    let redirectUrl = coda.withQueryParams(RedirectBaseUrl, {
      url: url,
    });
    let html = await fetch(context, url);
    let result = getMetdata(url, html);
    result.url = result.url ?? url;
    result.label = result.title ?? "⚠️ No Title";
    return result;
  },
});

pack.addColumnFormat({
  name: "Web Page Metadata",
  formulaName: "WebPageMetadata",
  instructions: "Paste a URL of a web page to get its metadata (title, icon, etc).",
});

async function fetch(context: coda.ExecutionContext, url: string): Promise<string> {
  let redirectUrl = coda.withQueryParams(RedirectBaseUrl, {
    url: url,
  });
  let response;
  try {
    response = await context.fetcher.fetch({
      method: "GET",
      url: redirectUrl,
      cacheTtlSecs: OneHourSecs,
    });
    return response.body;
  } catch (e) {
    // Fallback to the Google Cache.
    let cacheUrl = "https://webcache.googleusercontent.com/search?q=cache:" + encodeURIComponent(url);
    redirectUrl = coda.withQueryParams(RedirectBaseUrl, {
      url: cacheUrl,
    });
    try {
      response = await context.fetcher.fetch({
        method: "GET",
        url: redirectUrl,
        cacheTtlSecs: OneHourSecs,
      });
      return response.body;
    } catch (e) {
      throw new coda.UserVisibleError(`Error accessing URL: ${url}`);
    }
  }
}

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
        upgradeElement(elem, $);
        value = func(elem);
        if (value) {
          break;
        }
      }
    }
    if (!value && config.defaultValue) {
      value = config.defaultValue(context);
    }
    if (value && config.processor) {
      value = config.processor(value, context);
    }
    result[key] = value;
  }
  return result;
}

function upgradeElement(elem, $) {
  // Add elem.getAttribute("foo")
  elem.getAttribute = function (name) {
    return this.attribs[name];
  };
  // Add elem.text
  Object.defineProperty(elem, "text", {
    get() {
      return $(elem).text();
    }
  });
}
