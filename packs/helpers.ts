import * as coda from "@codahq/packs-sdk";
import { PackSchema } from "./schemas";
import { PackUrlRegexes, MetadataTypes } from "./constants";

export function formatItem(context: coda.ExecutionContext, item: any) {
  let host = context.invocationLocation.protocolAndHost;
  item.categories = item.categories?.map(category => category.categoryName);
  for (let maker of item.makers) {
    maker.profileLink = coda.joinUrl(host, `/@${maker.slug}`);
  }
  item.price = item.standardPackPlan?.pricing?.amount;
  item.bundledWithPlan = item.bundledPackPlan?.pricing?.minimumFeatureSet;
  item.listingUrl = coda.joinUrl(host, `/packs/${item.packId}`);
  item.studioUrl = coda.joinUrl(host, `/p/${item.packId}`);
}

export async function addBuildingBlocks(context: coda.ExecutionContext, items: any[]) {
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
      item.authentication = metadata.authentication;
    } else {
      console.error(result.reason);
    }
  }
}

function formatFormula(formula) {
  let result = { ...formula };
  let schema = formula.schema;
  result.isCard = Boolean(schema) &&
    schema.type == "object" &&
    Boolean(schema.displayProperty || schema.titleProperty) &&
    Boolean(schema.snippetProperty || schema.subtitleProperties || schema.linkProperty);
  return result;
}

function formatSyncTable(syncTable) {
  let result = { ...syncTable };
  result.canBrowseDatasets = Boolean(syncTable.listDynamicUrls);
  result.canSearchDatasets = Boolean(syncTable.searchDynamicUrls);
  result.canEdit = syncTable.getter?.supportsUpdates;
  result.hasDynamicSchema = Boolean(syncTable.getSchema);
  return result;
}

function formatColumnFormat(columnFormat) {
  let result = { ...columnFormat };
  result.hasMatchers = columnFormat.matchers?.length > 0;
  return result;
}

export async function addPublished(context: coda.ExecutionContext, items: any[]) {
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

export async function addReleases(context: coda.ExecutionContext, items: any[]) {
  let host = context.invocationLocation.protocolAndHost;
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "GET",
      url: coda.joinUrl(host, `/apis/v1/packs/${item.packId}/releases`),
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

export async function addFeaturedDocs(context: coda.ExecutionContext, items: any[]) {
  let host = context.invocationLocation.protocolAndHost;
  let requests = items.map(item => {
    return context.fetcher.fetch({
      method: "GET",
      url: coda.joinUrl(host, `/apis/v1/packs/${item.packId}/featuredDocs`),
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

export function getPackId(context: coda.ExecutionContext, packIdOrUrl: string): string {
  for (let regex of PackUrlRegexes) {
    let match = packIdOrUrl.match(regex);
    if (match) {
      let [_, host, packId] = match;
      if (host != context.invocationLocation.protocolAndHost) {
        throw new coda.UserVisibleError(
          `This Pack can only fetch Packs hosted on ${context.invocationLocation.protocolAndHost}`);
      }
      return packId;
    }
  }
  if (isNaN(Number.parseInt(packIdOrUrl))) {
    throw new coda.UserVisibleError(`Invalid Pack ID or URL: ${packIdOrUrl}`);
  }
  return packIdOrUrl;
}

export function extendSchema(metadata: string[]) {
  let properties = { ...PackSchema.properties };
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

export function getMetdataSettings(key: string): MetadataSettings {
  let result = MetadataTypes[key];
  if (!result) {
    throw new coda.UserVisibleError(`Invalid metadata: ${key}`);
  }
  return result;
}

export interface MetadataSettings {
  name: string;
  callback: (context: coda.ExecutionContext, items: any[]) => Promise<void>;
  properties: coda.ObjectSchemaProperties;
}

export async function getVersions(context: coda.ExecutionContext, packId: string) {
  let host = context.invocationLocation.protocolAndHost;
  let response = await context.fetcher.fetch({
    method: "GET",
    url: coda.joinUrl(host, `/apis/v1/packs/${packId}/versions`),
  });
  return response.body.items;
}

export async function getFiles(context: coda.ExecutionContext, packId: string, version: string) {
  let host = context.invocationLocation.protocolAndHost;
  let response = await context.fetcher.fetch({
    method: "GET",
    url: coda.joinUrl(host, `/apis/v1/packs/${packId}/versions/${version}/sourceCode`),
  });
  return response.body.files;
}

export function handleError(e) {
  if (e.statusCode == 404) {
    throw new coda.UserVisibleError(`Pack doesn't exist or you don't have access to it.`);
  }
  throw e;
}
