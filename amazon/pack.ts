import * as coda from '@codahq/packs-sdk';
import * as schemas from './schemas';

export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;

// From: https://github.com/vaiden/amazon-asin/blob/master/index.js
const AmazonProductUrlRegex = /^https?:\/\/(www\.)?(.*)amazon\.([a-z\.]{2,6})(\/d\/(.*)|\/(.*)\/?(?:dp|o|gp|-)\/)(aw\/d\/|product\/)?(B[0-9]{1}[0-9A-Z]{8}|[0-9]{9}(?:X|[0-9]))/i;
const AmazonShortUrlRegex = /^https?:\/\/([a-zA-Z\d-]+\.){0,}(amzn|a)\.(to|eu|co)\//i;

pack.addNetworkDomain("outscraper.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CustomHeaderToken,
  headerName: "X-API-KEY",
  instructionsUrl: "https://app.outscraper.com/profile",
});

pack.addFormula({
  name: "Product",
  description: "Gets information about an Amazon product given a link.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "link",
      description: "A link to the Amazon product.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.ProductSchema,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [link] = args;
    let query = link;
    let match;
    if (match = link.match(AmazonProductUrlRegex)) {
      query = match.at(-1);
    } else if (link.match(AmazonShortUrlRegex)) {
      // All good.
    } else {
      throw new coda.UserVisibleError("Invalid link: " + link);
    }
    let url = coda.withQueryParams("https://api.app.outscraper.com/amazon/products", {
      query: link,
      async: false,
    })
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: OneDaySecs,
    });
    let {data} = response.body;
    let product = data[0][0];
    let result = {
      ...product,
      brand: product.overview?.brand,
      upc: product.details?.upc,
      photo: product.image_1,
      asOf: new Date(),
    }
    return result;
  },
});

pack.addColumnFormat({
  name: "Product",
  instructions: "Paste an Amazon product URL to get information about it.",
  formulaName: "Product",
  matchers: [AmazonProductUrlRegex, AmazonShortUrlRegex],
});