import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;

pack.addNetworkDomain("peopledatalabs.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CustomHeaderToken,
  headerName: "X-Api-Key",
  instructionsUrl: "https://dashboard.peopledatalabs.com/api-keys",
});

const LocationSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    locality: { type: coda.ValueType.String },
    region: { type: coda.ValueType.String },
    metro: { type: coda.ValueType.String },
    country: { type: coda.ValueType.String },
    continent: { type: coda.ValueType.String },
    street_address: { type: coda.ValueType.String },
    address_line_2: { type: coda.ValueType.String },
    postal_code: { type: coda.ValueType.String },
    geo: { type: coda.ValueType.String },
  },
  displayProperty: "name",
});

const CompanySchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, fromKey: "display_name" },
    tagline: { type: coda.ValueType.String, fromKey: "headline" },
    summary: { type: coda.ValueType.String },
    founded: { type: coda.ValueType.Number, description: "The year the company was founded." },
    type: { type: coda.ValueType.String },
    industry: { type: coda.ValueType.String },
    tags: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
    website: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    location: LocationSchema,
    ticker: { type: coda.ValueType.String, description: "The company's stock ticker, if publicly traded." },
    employees_estimate: { type: coda.ValueType.String, description: "An estimated range of how many people work at the company.", fromKey: "size" },
    employees_count: { type: coda.ValueType.Number, description: "The number of people listed at working at the company on social networks (LinkedIn, etc).", fromKey: "employee_count" },
    revenue_estimate: { type: coda.ValueType.String, description: "An estimated range of the company's annual revenus in US dollars.", fromKey: "inferred_revenue" },
  },
  displayProperty: "name",
});

pack.addFormula({
  name: "EnrichCompany",
  description: "TODO",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "website",
      description: "The company's website.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: CompanySchema,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    // TODO: Unpack the parameter values.
    let [website] = args;

    let url = coda.withQueryParams("https://api.peopledatalabs.com/v5/company/enrich", {
      website,
      titlecase: true,
      min_likelihood: 6,
    });

    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let data = response.body;
    console.log(JSON.stringify(data, null, 2));
    if (!data.website?.startsWith("https://")) {
      data.website = "https://" + data.website;
    }
    return data;
  },
});
