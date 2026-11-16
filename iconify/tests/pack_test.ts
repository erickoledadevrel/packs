import { assert } from "chai";
import { beforeEach, describe, it } from "mocha";
import {
  executeFormulaFromPackDef,
  executeMetadataFormula,
  MockExecutionContext,
  newJsonFetchResponse,
  newMockExecutionContext,
} from "@codahq/packs-sdk/dist/development";
import { pack } from "../pack";
import * as coda from "@codahq/packs-sdk";

const Collection = {
  name: "Material Design Icons",
  total: 7000,
  version: "1.0.0",
  author: { name: "Pictogrammers", url: "https://pictogrammers.com" },
  license: { title: "Apache 2.0", spdx: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  samples: ["home"],
  category: "General",
  tags: ["Material"],
  palette: false,
};

describe("Iconify", () => {
  let context: MockExecutionContext;

  beforeEach(() => {
    context = newMockExecutionContext();
  });

  function execute(name: string, params: any[] = []) {
    return executeFormulaFromPackDef(pack, name, params as coda.ParamValues<coda.ParamDefs>, context, {
      useDeprecatedResultNormalization: false,
    });
  }

  function search([query, page = 1, pageSize = 20, collection = ""]: any[]) {
    return execute("Icons", [query, collection, page, pageSize]);
  }

  function mockSearch(icons = ["mdi:home"], limit = 32, start = 0) {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      icons,
      collections: icons.length ? { mdi: { ...Collection, height: 24, displayHeight: 24 } } : {},
      total: icons.length ? start + icons.length : 0,
      limit,
      start,
    }));
  }

  function requestedUrl() {
    assert.equal(context.fetcher.fetch.callCount, 1);
    assert.equal(context.fetcher.fetch.firstCall.args[0].method, "GET");
    return new URL(context.fetcher.fetch.firstCall.args[0].url);
  }

  it("searches with defaults and exposes icon URLs and collection metadata through the SDK schema", async () => {
    mockSearch();
    let result = await execute("Icons", ["home"]);
    let url = requestedUrl();
    assert.equal(url.origin + url.pathname, "https://api.iconify.design/search");
    assert.equal(url.searchParams.get("query"), "home");
    assert.equal(url.searchParams.get("start"), "0");
    assert.equal(url.searchParams.get("limit"), "32");
    assert.isFalse(url.searchParams.has("prefix"));
    assert.deepEqual(result, {
      summary: 'Page 1 of "home"',
      icons: [{ id: "mdi:home", collectionId: "mdi", image: "https://api.iconify.design/mdi/home.svg", link: "https://icon-sets.iconify.design/mdi/home/" }],
      collections: [{ ...Collection, id: "mdi", link: "https://icon-sets.iconify.design/mdi/" }],
      page: 1,
      hasMore: false,
    });
  });

  it("converts pages to offsets, filters a single collection, and preserves full IDs", async () => {
    mockSearch(["material-symbols:add-home", "material-symbols:home"], 96, 64);
    let result = await search([" home & garden ", 3, 32, " material-symbols "]);
    let url = requestedUrl();
    assert.equal(url.searchParams.get("start"), "64");
    assert.equal(url.searchParams.get("limit"), "96");
    assert.equal(url.searchParams.get("query"), "home & garden");
    assert.equal(url.searchParams.get("prefix"), "material-symbols");
    assert.equal(result.icons[0].collectionId, "material-symbols");
    assert.equal(result.icons[0].image, "https://api.iconify.design/material-symbols/add-home.svg");
    assert.equal(result.page, 3);
    assert.equal(result.summary, 'Page 3 of "home & garden" in material-symbols');
    assert.equal(result.icons.length, 2);
  });

  it("indicates possible additional results for a full page", async () => {
    mockSearch(Array.from({ length: 32 }, (_, i) => `mdi:home-${i}`), 32);
    let result = await search(["home", 1, 32]);
    assert.isTrue(result.hasMore);
    assert.equal(result.icons.length, 32);
  });

  it("returns empty results and omits an empty collection filter", async () => {
    mockSearch([], 192, 128);
    let result = await search(["no-match", 3, 64, ""]);
    assert.deepEqual(result.icons, []);
    assert.deepEqual(result.collections, []);
    assert.isFalse(result.hasMore);
    assert.equal(result.icons.length, 0);
    assert.equal(result.summary, 'Page 3 of "no-match"');
    assert.isFalse(requestedUrl().searchParams.has("prefix"));
  });

  it("lists collection metadata without height fields", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      mdi: { ...Collection, height: 24, displayHeight: 24 },
      mixed: { ...Collection, name: "Mixed", height: [16, 24] },
      minimal: { name: "Minimal", author: { name: "Artist" }, license: { title: "MIT" } },
    }));
    let result = await execute("Collections");
    assert.equal(requestedUrl().href, "https://api.iconify.design/collections");
    assert.deepEqual(result[0], { ...Collection, id: "mdi", link: "https://icon-sets.iconify.design/mdi/" });
    assert.notProperty(result[1], "height");
    assert.notProperty(result[1], "displayHeight");
    assert.deepEqual(result[2], {
      id: "minimal", name: "Minimal", author: { name: "Artist" }, license: { title: "MIT" },
      link: "https://icon-sets.iconify.design/minimal/",
    });
  });

  it("autocompletes collections by name and ID", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({ mdi: Collection }));
    let formula = pack.formulas.find(formula => formula.name === "Icons");
    let parameters: Array<coda.ParamDefs[number]> = formula.parameters;
    let autocomplete = parameters.find(parameter => parameter.name === "collection").autocomplete;
    for (let search of ["mdi", "material"]) {
      let result = await executeMetadataFormula(autocomplete, { search }, context);
      assert.deepEqual(result, [{ display: "Material Design Icons (mdi)", value: "mdi" }]);
    }
    assert.deepEqual(await executeMetadataFormula(autocomplete, { search: "no-match" }, context), []);
  });

  for (let [params, message] of [
    [["  "], "Provide a search query or a collection"],
    [["home", 0], "Page must be a whole number"],
    [["home", 1.5], "Page must be a whole number"],
    [["home", 1, 0], "Page size must be a whole number from 1 to 999"],
    [["home", 1, 1000], "Page size must be a whole number from 1 to 999"],
    [["home", 1, 1.5], "Page size must be a whole number from 1 to 999"],
    [["home", Number.MAX_SAFE_INTEGER], "Page is too large"],
    [["home", 17, 64], "Iconify exposes at most 999 results"],
    [["home", 1000, 1], "Iconify exposes at most 999 results"],
    [["home", 1, 64, "mdi,other"], "Use a collection ID"],
  ] as [any[], string][]) {
    it(`rejects invalid input ${JSON.stringify(params)} before fetching`, async () => {
      try {
        await search(params);
        assert.fail("Expected an error");
      } catch (error) {
        assert.include(error.message, message);
      }
      assert.isFalse(context.fetcher.fetch.called);
    });
  }

  it("accepts the maximum page size", async () => {
    mockSearch([], 999);
    await search(["home", 1, 999]);
    assert.equal(requestedUrl().searchParams.get("limit"), "999");
  });

  it("returns one icon and only its collection when the API overfetches", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      icons: ["mdi:home", "lucide:house"],
      collections: { mdi: Collection, lucide: { ...Collection, name: "Lucide" } },
      total: 2,
      limit: 32,
      start: 0,
    }));
    let result = await search(["home", 1, 1]);
    assert.equal(requestedUrl().searchParams.get("limit"), "32");
    assert.equal(result.icons.length, 1);
    assert.equal(result.icons[0].id, "mdi:home");
    assert.deepEqual(result.collections.map(collection => collection.id), ["mdi"]);
    assert.equal(result.icons.length, 1);
    assert.isTrue(result.hasMore);
  });

  it("advances small pages using offsets while respecting the API minimum", async () => {
    mockSearch(Array.from({ length: 22 }, (_, i) => `mdi:home-${i + 10}`), 32, 10);
    let result = await search(["home", 3, 5]);
    let url = requestedUrl();
    assert.equal(url.searchParams.get("start"), "10");
    assert.equal(url.searchParams.get("limit"), "32");
    assert.equal(result.icons.length, 5);
    assert.equal(result.icons.length, 5);
    assert.isTrue(result.hasMore);
  });

  it("stops small pages when all matching icons have been returned", async () => {
    mockSearch(["mdi:home"], 32, 10);
    let result = await search(["home", 3, 5]);
    assert.equal(result.icons.length, 1);
    assert.isFalse(result.hasMore);
  });

  it("allows a one-icon page at the final accessible result", async () => {
    mockSearch(["mdi:home"], 999, 998);
    let result = await search(["home", 999, 1]);
    assert.equal(requestedUrl().searchParams.get("limit"), "999");
    assert.equal(result.icons.length, 1);
    assert.isFalse(result.hasMore);
  });

  it("truncates the last accessible page at the API cap", async () => {
    mockSearch(Array.from({ length: 39 }, (_, i) => `mdi:home-${i}`), 999, 960);
    let result = await search(["home", 16, 64]);
    assert.equal(requestedUrl().searchParams.get("limit"), "999");
    assert.equal(result.icons.length, 39);
    assert.isFalse(result.hasMore);
  });

  it("propagates API errors instead of returning an empty success", async () => {
    context.fetcher.fetch.rejects(new Error("API unavailable"));
    try {
      await search(["home"]);
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, "API unavailable");
    }
  });

  it("browses visible icons alphabetically and removes category duplicates, aliases, and hidden icons", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      prefix: "mdi", info: { ...Collection, height: 24, displayHeight: 24 },
      uncategorized: ["zebra", "home", "old", "house"],
      categories: { Buildings: ["home", "apartment"], Other: ["zebra"] },
      hidden: ["old"], aliases: { house: "home" },
    }));
    let result = await execute("Icons", ["", "mdi"]);
    assert.equal(result.summary, "Page 1 of mdi");
    let url = requestedUrl();
    assert.equal(url.pathname, "/collection");
    assert.equal(url.searchParams.get("prefix"), "mdi");
    assert.equal(url.searchParams.get("info"), "true");
    assert.equal(context.fetcher.fetch.firstCall.args[0].cacheTtlSecs, 86400);
    assert.deepEqual(result.icons.map(icon => icon.id), ["mdi:apartment", "mdi:home", "mdi:zebra"]);
    assert.equal(result.icons[1].image, "https://api.iconify.design/mdi/home.svg");
    assert.equal(result.icons[1].link, "https://icon-sets.iconify.design/mdi/home/");
    assert.deepEqual(result.collections, [{ ...Collection, id: "mdi", link: "https://icon-sets.iconify.design/mdi/" }]);
    assert.equal(result.icons.length, 3);
    assert.isFalse(result.hasMore);
  });

  it("paginates a single collection in alphabetical order", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      prefix: "mdi", info: Collection,
      uncategorized: ["zebra", "house", "apple", "banana", "car"],
    }));
    let first = await execute("Icons", ["   ", "mdi", 1, 2]);
    assert.equal(context.fetcher.fetch.callCount, 1);
    assert.deepEqual(first.icons.map(icon => icon.id), ["mdi:apple", "mdi:banana"]);
    assert.isTrue(first.hasMore);
    let second = await execute("Icons", ["", "mdi", 2, 2]);
    assert.deepEqual(second.icons.map(icon => icon.id), ["mdi:car", "mdi:house"]);
    assert.equal(second.page, 2);
    let last = await execute("Icons", ["", "mdi", 3, 2]);
    assert.deepEqual(last.icons.map(icon => icon.id), ["mdi:zebra"]);
    assert.deepEqual(last.collections.map(collection => collection.id), ["mdi"]);
    assert.equal(last.icons.length, 1);
    assert.isFalse(last.hasMore);
  });

  it("browses beyond the search cap and returns empty pages after the collection ends", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      prefix: "mdi", info: Collection,
      uncategorized: Array.from({ length: 1050 }, (_, i) => `icon-${String(i).padStart(4, "0")}`),
    }));
    let result = await execute("Icons", ["", "mdi", 51, 20]);
    assert.equal(result.page, 51);
    assert.equal(result.icons.length, 20);
    assert.equal(result.icons[0].id, "mdi:icon-1000");
    assert.isTrue(result.hasMore);
    let empty = await execute("Icons", ["", "mdi", 60, 20]);
    assert.deepEqual(empty.icons, []);
    assert.deepEqual(empty.collections, []);
    assert.equal(empty.icons.length, 0);
    assert.isFalse(empty.hasMore);
  });

  it("handles an empty collection without optional list fields", async () => {
    context.fetcher.fetch.resolves(newJsonFetchResponse({ prefix: "mdi", info: Collection }));
    let result = await execute("Icons", ["", "mdi"]);
    assert.deepEqual(result.icons, []);
    assert.isFalse(result.hasMore);
  });

  it("requires a query or a collection when called with no arguments", async () => {
    try {
      await execute("Icons");
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, "Provide a search query or a collection");
    }
    assert.isFalse(context.fetcher.fetch.called);
  });

  it("rejects invalid collection IDs before browsing", async () => {
    try {
      await execute("Icons", ["", "mdi-"]);
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, "Use a collection ID");
    }
    assert.isFalse(context.fetcher.fetch.called);
  });

  it("explains when a collection cannot be browsed", async () => {
    context.fetcher.fetch.rejects(Object.assign(new Error("Not found"), {
      name: "StatusCodeError", statusCode: 404,
    }));
    try {
      await execute("Icons", ["", "unknown"]);
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, 'Collection "unknown" was not found or cannot be browsed.');
    }
  });
});
