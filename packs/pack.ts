import * as coda from "@codahq/packs-sdk";
import { BuildingBlockPoperties, FeaturedDocsProperties, PackSchema, PublishedProperties, ReleasesProperties } from "./schemas";
export const pack = coda.newPack();

const ListingsUrl = "https://coda.io/apis/v1/packs/listings";

const PackUrlRegexes = [
  new RegExp("^https://coda.io/p/(\\d+)"),
  new RegExp("^https://coda.io/packs/(?:\\w+-)*(\\d+)"),
];

const MetadataTypes: Record<string, MetadataSettings> = {
  blocks: {
    name: "Building blocks",
    callback: addBuildingBlocks,
    properties: BuildingBlockPoperties,
  },
  published: {
    name: "Published status",
    callback: addPublished,
    properties: PublishedProperties,
  },
  releases: {
    name: "Releases",
    callback: addReleases,
    properties: ReleasesProperties,
  },
  featuredDocs: {
    name: "Featured docs",
    callback: addFeaturedDocs,
    properties: FeaturedDocsProperties,
  },
};

pack.addNetworkDomain("coda.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
});

pack.addFormula({
  name: "Pack",
  description: "Load information about a Pack",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "packIdOrUrl",
      description: "The ID or URL of the Pack.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: extendSchema(Object.keys(MetadataTypes)),
  execute: async function (args, context) {
    let [packIdOrUrl] = args;
    let packId = getPackId(packIdOrUrl);
    let url = coda.withQueryParams(ListingsUrl, {
      packIds: packId
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let { items } = response.body;
    if (!items?.length) {
      throw new coda.UserVisibleError(`Pack not found: ${packIdOrUrl}`);
    }
    let item = items[0];
    formatItem(item);
    let jobs = [];
    let metadata = Object.keys(MetadataTypes);
    for (let key of metadata) {
      let settings = getMetdataSettings(key);
      jobs.push(settings.callback(context, items));
    }
    await Promise.allSettled(jobs);
    return item;
  },
});

pack.addColumnFormat({
  name: "Pack",
  instructions: "Enter the ID or URL of a Pack.",
  formulaName: "Pack",
  matchers: PackUrlRegexes,
});

pack.addSyncTable({
  name: "Packs",
  description: "A list of all of the published Packs.",
  identityName: "Pack",
  schema: PackSchema,
  dynamicOptions: {
    getSchema: async function (context, search, args) {
      let metadata = args.metdata ?? [];
      return extendSchema(metadata);
    },
  },
  formula: {
    name: "SyncPacks",
    description: "Sync the Packs.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePublished",
        description: "Include public Packs published in the gallery.",
        suggestedValue: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeWorkspace",
        description: "Include internal Packs shared with everyone in your workspace.",
        suggestedValue: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePrivate",
        description: "Include private Packs you created or were shared with your directly.",
        suggestedValue: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "metdata",
        description: "Which additional Pack metadata to include (may increase time to sync).",
        optional: true,
        autocomplete: Object.entries(MetadataTypes).map(([key, value]) => ({
          display: value.name, value: key,
        })),
      }),
    ],
    execute: async function (args, context) {
      let [
        includePublished,
        includeWorkspace,
        includePrivate,
        metadata = [],
      ] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams(ListingsUrl, {
          excludePublicPacks: !includePublished,
          excludeWorkspaceAcls: !includeWorkspace,
          excludeIndividualAcls: !includePrivate,
          limit: 20,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let { items, nextPageLink } = response.body;
      for (let item of items) {
       formatItem(item);
      }
      let jobs = [];
      for (let key of metadata) {
        let settings = getMetdataSettings(key);
        jobs.push(settings.callback(context, items));
      }
      await Promise.allSettled(jobs);
      let continuation;
      if (nextPageLink) {
        continuation = { url: nextPageLink };
      }
      return {
        result: items,
        continuation,
      };
    },
  },
});

function formatItem(item:any) {
  item.categories = item.categories?.map(category => category.categoryName);
  for (let maker of item.makers) {
    maker.profileLink = `https://coda.io/@${maker.slug}`;
  }
  item.price = item.standardPackPlan?.pricing?.amount;
  item.bundledWithPlan = item.bundledPackPlan?.pricing?.minimumFeatureSet;
  item.listingUrl = `https://coda.io/packs/${item.packId}`;
  item.studioUrl = `https://coda.io/p/${item.packId}`;
}

async function addBuildingBlocks(context: coda.ExecutionContext, items: any[]) {
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "GET",
      url: item.externalMetadataUrl,
      disableAuthentication: true,
    });
  });
  let results = await Promise.allSettled(requests);
  for (let [i, result] of results.entries()) {
    let item = items[i];
    if (result.status == "fulfilled") {
      let metadata = result.value.body;
      item.formulas = metadata.formulas.map(formula => formatFormula(formula));
      item.syncTables = metadata.syncTables.map(syncTable => formatSyncTable(syncTable));
      item.columnFormats = metadata.formats.map(columnFormat => formatColumnFormat(columnFormat));
    } else {
      console.error(result.reason);
    }
  }
}

function formatFormula(formula) {
  let result = {...formula};
  let schema = formula.schema;
  result.isCard =  Boolean(schema) &&
    schema.type == "object" &&
    Boolean(schema.displayProperty || schema.titleProperty) &&
    Boolean(schema.snippetProperty || schema.subtitleProperties || schema.linkProperty);
  return result;
}

function formatSyncTable(syncTable) {
  let result = {...syncTable};
  result.canBrowseDatasets = Boolean(syncTable.listDynamicUrls);
  result.canSearchDatasets = Boolean(syncTable.searchDynamicUrls);
  return result;
}

function formatColumnFormat(columnFormat) {
  let result = {...columnFormat};
  result.hasMatchers = columnFormat.matchers?.length > 0;
  return result;
}

async function addPublished(context: coda.ExecutionContext, items: any[]) {
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "HEAD",
      url: `https://coda.io/packs/${item.packId}`,
      disableAuthentication: true,
      ignoreRedirects: true,
    });
  });
  let results = await Promise.allSettled(requests);
  for (let [i, result] of results.entries()) {
    let item = items[i];
    if (result.status == "fulfilled") {
      item.published = result.value.status == 200;
    } else {
      console.error(result.reason);
    }
  }
}

async function addReleases(context: coda.ExecutionContext, items: any[]) {
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "GET",
      url: `https://coda.io/apis/v1/packs/${item.packId}/releases`,
    });
  });
  let results = await Promise.allSettled(requests);
  for (let [i, result] of results.entries()) {
    let item = items[i];
    if (result.status == "fulfilled") {
      item.releases = result.value.body.items;
    } else {
      console.error(result.reason);
    }
  }
}

async function addFeaturedDocs(context: coda.ExecutionContext, items: any[]) {
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "GET",
      url: `https://coda.io/apis/v1/packs/${item.packId}/featuredDocs`,
    });
  });
  let results = await Promise.allSettled(requests);
  for (let [i, result] of results.entries()) {
    let item = items[i];
    if (result.status == "fulfilled") {
      item.featuredDocs = result.value.body.items;
    } else {
      console.error(result.reason);
    }
  }
}

function getPackId(packIdOrUrl: string): string {
  for (let regex of PackUrlRegexes) {
    let match = packIdOrUrl.match(regex);
    if (match) {
      return match[1];
    }
  }
  if (isNaN(Number.parseInt(packIdOrUrl))) {
    throw new coda.UserVisibleError(`Invalid Pack ID or URL: ${packIdOrUrl}`);
  }
  return packIdOrUrl;
}

function extendSchema(metadata: string[]) {
  let properties = {...PackSchema.properties};
  let featured: string[] = [...PackSchema.featuredProperties];
  for (let key of metadata) {
    let settings = getMetdataSettings(key);
    properties = {
      ...properties,
      ...settings.properties,
    };
    featured = featured.concat(Object.keys(settings.properties));
  }
  return {
    ...PackSchema,
    properties: properties,
    featuredProperties: featured,
  };
}

function getMetdataSettings(key: string): MetadataSettings {
  let result = MetadataTypes[key];
  if (!result) {
    throw new coda.UserVisibleError(`Invalid metadata: ${key}`);
  }
  return result;
}

interface MetadataSettings {
  name: string;
  callback: (context: coda.ExecutionContext, items: any[]) => Promise<void>;
  properties: coda.ObjectSchemaProperties;
}
