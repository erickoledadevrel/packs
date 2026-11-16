import * as sdk from "@superhuman/plugins-sdk";
import { CollectionSchema, SearchResultSchema, SyncIconSchema } from "./schemas";
import { getIconImages } from "./images";

export const pack = sdk.newPack();

const ApiBaseUrl = "https://api.iconify.design";
const WebsiteBaseUrl = "https://icon-sets.iconify.design";
const DefaultPageSize = 20;
const SyncPageSize = 500;
const OneDaySecs = 24 * 60 * 60;

pack.addNetworkDomain("iconify.design");

interface CollectionInfo {
  name: string;
  total?: number;
  version?: string;
  author: { name: string; url?: string };
  license: { title: string; spdx?: string; url?: string };
  samples?: string[];
  height?: number | number[];
  displayHeight?: number;
  category?: string;
  tags?: string[];
  palette?: boolean;
}

interface SearchResponse {
  icons: string[];
  collections: Record<string, CollectionInfo>;
  total: number;
  limit: number;
  start: number;
}

interface CollectionResponse {
  prefix: string;
  title?: string;
  info?: CollectionInfo;
  uncategorized?: string[];
  categories?: Record<string, string[]>;
  hidden?: string[];
  aliases?: Record<string, string>;
}

const QueryParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "query",
  description: "The icon to search for, such as home. Omit to browse the selected collection.",
  optional: true,
});

const CollectionParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "collection",
  description: "The collection ID to browse or search, such as mdi. Required when no query is provided.",
  optional: true,
  autocomplete: async function (context, search) {
    let collections = await getCollections(context);
    let options = collections.map(collection => ({
      display: `${collection.name} (${collection.id})`,
      value: collection.id,
    }));
    return sdk.autocompleteSearchObjects(search, options, "display", "value");
  },
});

pack.addFormula({
  name: "Icons",
  description: "Search Iconify icons or list the icons in a collection. Provide a query, collection, or both.",
  parameters: [
    QueryParameter,
    CollectionParameter,
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "page",
      description: "The page to retrieve, starting at 1. Default: 1.",
      optional: true,
      suggestedValue: 1,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "pageSize",
      description: `Number of icons per page, from 1 to 999. Default: ${DefaultPageSize}.`,
      optional: true,
      suggestedValue: DefaultPageSize,
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: SearchResultSchema,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: ["home"], result: "<icons matching home across all collections>" },
    { params: ["home", "mdi"], result: "<icons matching home in Material Design Icons>" },
    { params: ["", "mdi"], result: "<first page of icons in Material Design Icons>" },
    { params: ["", "mdi", 2, 10], result: "<second page of 10 icons in Material Design Icons>" },
  ],
  execute: async function (args, context) {
    let [query = "", collection = "", page = 1, pageSize = DefaultPageSize] = args;
    return getIcons(query, collection, page, pageSize, context);
  },
});

pack.addFormula({
  name: "Collections",
  description: "List Iconify collections, including their IDs, authors, licenses, and other metadata.",
  parameters: [],
  resultType: sdk.ValueType.Array,
  items: CollectionSchema,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [], result: "<available Iconify collections and their metadata>" },
  ],
  execute: async function (args, context) {
    return getCollections(context);
  },
});

pack.addSyncTable({
  name: "Icons",
  description: "Sync icons matching a query or all visible icons in a collection. Searches are limited by Iconify's API result cap.",
  identityName: "Icon",
  schema: SyncIconSchema,
  formula: {
    name: "SyncIcons",
    description: "Sync icons in batches, including their collection metadata.",
    parameters: [QueryParameter, CollectionParameter],
    cacheTtlSecs: OneDaySecs,
    execute: async function (args, context) {
      let [query = "", collection = ""] = args;
      let page = context.sync.continuation?.page as number ?? 1;
      let result = await getIcons(query, collection, page, SyncPageSize, context);
      let collections = new Map(result.collections.map(collection => [collection.id, collection]));
      let images = await getIconImages(result.icons.map(icon => icon.id), context);
      return {
        result: result.icons.map(icon => ({
          ...icon,
          image: images.get(icon.id),
          collection: {
            id: icon.collectionId,
            name: collections.get(icon.collectionId)?.name ?? icon.collectionId,
          },
        })),
        continuation: result.hasMore ? { page: page + 1 } : undefined,
      };
    },
  },
});

pack.addSyncTable({
  name: "Collections",
  description: "Sync all available Iconify collections and their metadata.",
  identityName: "Collection",
  schema: CollectionSchema,
  formula: {
    name: "SyncCollections",
    description: "Sync collections in batches.",
    parameters: [],
    cacheTtlSecs: OneDaySecs,
    execute: async function (args, context) {
      let offset = context.sync.continuation?.offset as number ?? 0;
      // The API returns the full list. Reuse the cached request on subsequent
      // iterations and sort by ID so offsets remain stable across executions.
      let collections = (await getCollections(context))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      let result = collections.slice(offset, offset + SyncPageSize);
      let nextOffset = offset + result.length;
      return {
        result,
        continuation: nextOffset < collections.length ? { offset: nextOffset } : undefined,
      };
    },
  },
});

function formatResult(icons: string[], collections: Record<string, CollectionInfo>,
  page: number, hasMore: boolean, summary: string) {
  let collectionIds = new Set(icons.map(id => id.split(":")[0]));
  return {
    summary: `Page ${page} of ${summary}`,
    icons: icons.map(id => {
      let [collectionId, name] = id.split(":");
      return {
        id,
        collectionId,
        image: `${ApiBaseUrl}/${encodeURIComponent(collectionId)}/${encodeURIComponent(name)}.svg`,
        link: `${WebsiteBaseUrl}/${encodeURIComponent(collectionId)}/${encodeURIComponent(name)}/`,
      };
    }),
    collections: formatCollections(collections).filter(collection => collectionIds.has(collection.id)),
    page,
    hasMore,
  };
}

async function getCollections(context: sdk.ExecutionContext) {
  let response = await context.fetcher.fetch<Record<string, CollectionInfo>>({
    method: "GET",
    url: `${ApiBaseUrl}/collections`,
    cacheTtlSecs: OneDaySecs,
  });
  return formatCollections(response.body);
}

function formatCollections(collections: Record<string, CollectionInfo>) {
  return Object.entries(collections).map(([id, info]) => {
    let { height, displayHeight, ...metadata } = info;
    return {
      ...metadata,
      id,
      link: `${WebsiteBaseUrl}/${encodeURIComponent(id)}/`,
    };
  });
}

async function getIcons(query: string, collection: string, page: number, pageSize: number,
  context: sdk.ExecutionContext) {
  query = query.trim();
  collection = collection.trim();
  if (!query && !collection) {
    throw new sdk.UserVisibleError("Provide a search query or a collection.");
  }
  if (collection && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection)) {
    throw new sdk.UserVisibleError("Use a collection ID such as mdi or material-symbols.");
  }
  let summary = query ? `"${query}"${collection ? ` in ${collection}` : ""}` : collection;
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new sdk.UserVisibleError("Page must be a whole number starting at 1.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 999) {
    throw new sdk.UserVisibleError("Page size must be a whole number from 1 to 999.");
  }
  let start = (page - 1) * pageSize;
  if (!Number.isSafeInteger(start)) {
    throw new sdk.UserVisibleError("Page is too large. Choose a smaller page number.");
  }
  if (!query) {
    let result: CollectionResponse;
    try {
      let response = await context.fetcher.fetch<CollectionResponse>({
        method: "GET",
        url: sdk.withQueryParams(`${ApiBaseUrl}/collection`, { prefix: collection, info: true }),
        cacheTtlSecs: OneDaySecs,
      });
      result = response.body;
    } catch (error) {
      if (sdk.StatusCodeError.isStatusCodeError(error) && error.statusCode === 404) {
        throw new sdk.UserVisibleError(`Collection "${collection}" was not found or cannot be browsed.`);
      }
      throw error;
    }
    let metadata: Record<string, CollectionInfo> = {};
    if (result.info) metadata[result.prefix] = result.info;
    let excluded = new Set([...(result.hidden ?? []), ...Object.keys(result.aliases ?? {})]);
    let visible = new Set([
      ...(result.uncategorized ?? []),
      ...Object.values(result.categories ?? {}).flat(),
    ]);
    let names = [...visible].filter(name => !excluded.has(name)).sort();
    let icons = names.slice(start, start + pageSize).map(name => `${result.prefix}:${name}`);
    return formatResult(icons, metadata, page, start + icons.length < names.length, summary);
  }
  if (start >= 999) {
    throw new sdk.UserVisibleError("Iconify exposes at most 999 results per search. Choose an earlier page or narrow your search.");
  }
  // Iconify applies start after collecting limit results and requires start <
  // limit. Increase the limit to the end of this page, respecting the API's
  // 32-result minimum and 999-result maximum, then trim any extra results.
  let limit = Math.min(Math.max(start + pageSize, 32), 999);
  let params: Record<string, string | number> = { query, start, limit };
  if (collection) {
    params.prefix = collection;
  }
  let response = await context.fetcher.fetch<SearchResponse>({
    method: "GET",
    url: sdk.withQueryParams(`${ApiBaseUrl}/search`, params),
    cacheTtlSecs: OneDaySecs,
  });
  let result = response.body;
  let icons = result.icons.slice(0, pageSize);
  // Search does not report a global match count. A full API response only
  // indicates that another page may exist, up to the search cap.
  // A server can impose a lower cap than the documented maximum. If our
  // requested limit was clamped, that response already reaches its ceiling.
  let hasMore = result.limit >= limit && start + icons.length < 999 &&
    (result.icons.length > pageSize || result.total === result.limit);
  return formatResult(icons, result.collections, page, hasMore, summary);
}
