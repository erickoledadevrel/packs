import { assert } from "chai";
import { describe, it } from "mocha";
import * as sdk from "@superhuman/plugins-sdk";
import {
  executeSyncFormulaFromPackDefSingleIteration,
  newJsonFetchResponse,
  newMockSyncExecutionContext,
} from "@superhuman/plugins-sdk/dist/development";
import { pack } from "../pack";

const Collection = {
  name: "Test Icons",
  author: { name: "Artist" },
  license: { title: "MIT" },
  height: 24,
  displayHeight: 24,
};

// Each call creates a fresh execution context, as real continuation runs do.
async function iterate(name: string, params: any[], continuation: sdk.Continuation | undefined,
  fetch: (request: sdk.FetchRequest) => Promise<sdk.FetchResponse>) {
  let context = newMockSyncExecutionContext();
  context.sync.continuation = continuation;
  context.fetcher.fetch.callsFake(async request => {
    let url = new URL(request.url);
    if (url.pathname.endsWith(".json")) {
      let names = url.searchParams.get("icons").split(",");
      return newJsonFetchResponse({
        prefix: url.pathname.slice(1, -5), width: 24, height: 24,
        icons: Object.fromEntries(names.map(name => [name, { body: '<path d="M0 0h24v24H0z" fill="currentColor"/>' }])),
      });
    }
    return fetch(request);
  });
  return executeSyncFormulaFromPackDefSingleIteration(pack, name,
    params as sdk.ParamValues<sdk.ParamDefs>, context, { useDeprecatedResultNormalization: false });
}

describe("Iconify sync tables", () => {
  it("syncs an entire collection across fresh continuation runs beyond 999 icons", async () => {
    let names = Array.from({ length: 1203 }, (_, i) => `icon-${String(i).padStart(4, "0")}`);
    let calls = 0;
    let fetch = async (request: sdk.FetchRequest) => {
      calls++;
      let url = new URL(request.url);
      assert.equal(url.pathname, "/collection");
      assert.equal(url.searchParams.get("prefix"), "mdi");
      assert.equal(url.searchParams.get("info"), "true");
      assert.equal(request.cacheTtlSecs, 86400);
      return newJsonFetchResponse({
        prefix: "mdi", info: Collection,
        uncategorized: [...names].reverse(),
        categories: { Duplicate: [names[0], "hidden", "alias"] },
        hidden: ["hidden"], aliases: { alias: names[0] },
      });
    };
    let first = await iterate("Icons", ["", "mdi"], undefined, fetch);
    assert.equal(first.result.length, 500);
    assert.deepEqual(first.continuation, { page: 2 });
    let second = await iterate("Icons", ["", "mdi"], first.continuation, fetch);
    assert.equal(second.result.length, 500);
    assert.deepEqual(second.continuation, { page: 3 });
    let last = await iterate("Icons", ["", "mdi"], second.continuation, fetch);
    assert.equal(last.result.length, 203);
    assert.isUndefined(last.continuation);
    let rows = [...first.result, ...second.result, ...last.result];
    assert.deepEqual(rows.map(row => row.id), names.map(name => `mdi:${name}`));
    assert.equal(new Set(rows.map(row => row.id)).size, 1203);
    assert.deepEqual(rows[0].collection, { id: "mdi", name: "Test Icons" });
    assert.isTrue(rows[0].image.startsWith(sdk.SvgConstants.DataUrlPrefix));
    assert.include(Buffer.from(rows[0].image.split(",")[1], "base64").toString(), '<svg xmlns="http://www.w3.org/2000/svg"');
    assert.equal(rows[0].link, "https://icon-sets.iconify.design/mdi/icon-0000/");
    assert.equal(calls, 3);
  });

  it("uses large search requests and stops at the API's 999-result cap", async () => {
    let ids = Array.from({ length: 1500 }, (_, i) => `mdi:home-${i}`);
    let requests: URL[] = [];
    let fetch = async (request: sdk.FetchRequest) => {
      let url = new URL(request.url);
      requests.push(url);
      assert.equal(url.pathname, "/search");
      assert.equal(url.searchParams.get("query"), "home");
      assert.equal(url.searchParams.get("prefix"), "mdi");
      assert.equal(request.cacheTtlSecs, 86400);
      let start = Number(url.searchParams.get("start"));
      let limit = Number(url.searchParams.get("limit"));
      let total = Math.min(ids.length, limit);
      return newJsonFetchResponse({
        icons: ids.slice(start, total), collections: { mdi: Collection }, start, limit, total,
      });
    };
    let first = await iterate("Icons", ["home", "mdi"], undefined, fetch);
    assert.equal(first.result.length, 500);
    assert.deepEqual(first.continuation, { page: 2 });
    let last = await iterate("Icons", ["home", "mdi"], first.continuation, fetch);
    assert.equal(last.result.length, 499);
    assert.isUndefined(last.continuation);
    assert.deepEqual([...first.result, ...last.result].map(row => row.id), ids.slice(0, 999));
    assert.deepEqual(requests.map(url => [url.searchParams.get("start"), url.searchParams.get("limit")]),
      [["0", "500"], ["500", "999"]]);
  });

  it("ends a search on a partial page and supports searches across all collections", async () => {
    let fetch = async (request: sdk.FetchRequest) => {
      assert.isFalse(new URL(request.url).searchParams.has("prefix"));
      return newJsonFetchResponse({
        icons: ["mdi:home", "lucide:house"], collections: { mdi: Collection, lucide: Collection },
        start: 0, limit: 500, total: 2,
      });
    };
    let page = await iterate("Icons", ["home"], undefined, fetch);
    assert.equal(page.result.length, 2);
    assert.equal(page.result[1].collection.id, "lucide");
    assert.isUndefined(page.continuation);
  });

  it("honors a lower search cap returned by the live server", async () => {
    let page = await iterate("Icons", ["home"], undefined, async request => {
      assert.equal(new URL(request.url).searchParams.get("limit"), "500");
      return newJsonFetchResponse({
        icons: Array.from({ length: 128 }, (_, i) => `mdi:home-${i}`),
        collections: { mdi: Collection }, start: 0, total: 128, limit: 128,
      });
    });
    assert.equal(page.result.length, 128);
    assert.isUndefined(page.continuation);
  });

  it("uses the same collection identity for icon references and the collections table", () => {
    let icons = pack.syncTables.find(table => table.name === "Icons");
    let collections = pack.syncTables.find(table => table.name === "Collections");
    let properties = Object.values(icons.schema.properties) as sdk.Schema[];
    let reference = properties.find(property =>
      property.type === sdk.ValueType.Object && property.codaType === sdk.ValueHintType.Reference) as sdk.GenericObjectSchema;
    assert.equal(reference.codaType, sdk.ValueHintType.Reference);
    assert.equal(reference.identity.name, collections.schema.identity.name);
    assert.equal(reference.idProperty, collections.schema.idProperty);
  });

  it("ends after an empty search continuation instead of looping", async () => {
    let page = await iterate("Icons", ["home"], { page: 2 }, async () => newJsonFetchResponse({
      icons: [], collections: {}, start: 500, limit: 999, total: 500,
    }));
    assert.deepEqual(page.result, []);
    assert.isUndefined(page.continuation);
  });

  it("ends an exact-size collection without an unnecessary continuation", async () => {
    let page = await iterate("Icons", ["", "mdi"], undefined, async () => newJsonFetchResponse({
      prefix: "mdi", info: Collection,
      uncategorized: Array.from({ length: 500 }, (_, i) => `icon-${i}`),
    }));
    assert.equal(page.result.length, 500);
    assert.isUndefined(page.continuation);
  });

  it("requires a query or collection before fetching", async () => {
    let called = false;
    try {
      await iterate("Icons", [], undefined, async () => {
        called = true;
        throw new Error("Unexpected request");
      });
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, "Provide a search query or a collection");
    }
    assert.isFalse(called);
  });

  it("syncs all collections in stable batches without duplicates or missing rows", async () => {
    let ids = Array.from({ length: 1203 }, (_, i) => `set-${String(i).padStart(4, "0")}`);
    let calls = 0;
    let fetch = async (request: sdk.FetchRequest) => {
      assert.equal(request.url, "https://api.iconify.design/collections");
      assert.equal(request.cacheTtlSecs, 86400);
      // API object ordering is allowed to change between requests.
      let orderedIds = ++calls % 2 ? [...ids].reverse() : ids;
      return newJsonFetchResponse(Object.fromEntries(orderedIds.map(id => [id, Collection])));
    };
    let first = await iterate("Collections", [], undefined, fetch);
    assert.equal(first.result.length, 500);
    assert.deepEqual(first.continuation, { offset: 500 });
    let second = await iterate("Collections", [], first.continuation, fetch);
    assert.equal(second.result.length, 500);
    assert.deepEqual(second.continuation, { offset: 1000 });
    let last = await iterate("Collections", [], second.continuation, fetch);
    assert.equal(last.result.length, 203);
    assert.isUndefined(last.continuation);
    let rows = [...first.result, ...second.result, ...last.result];
    assert.deepEqual(rows.map(row => row.id), ids);
    assert.notProperty(rows[0], "height");
    assert.notProperty(rows[0], "displayHeight");
    assert.equal(rows[0].link, "https://icon-sets.iconify.design/set-0000/");
    assert.equal(calls, 3);
  });

  for (let count of [0, 1, 500]) {
    it(`finishes a ${count}-collection response without a continuation`, async () => {
      let page = await iterate("Collections", [], undefined, async () => newJsonFetchResponse(
        Object.fromEntries(Array.from({ length: count }, (_, i) => [`set-${i}`, Collection]))));
      assert.equal(page.result.length, count);
      assert.isUndefined(page.continuation);
    });
  }
});
