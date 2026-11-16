import { assert } from "chai";
import { describe, it } from "mocha";
import * as sdk from "@superhuman/plugins-sdk";
import { newJsonFetchResponse, newMockExecutionContext } from "@superhuman/plugins-sdk/dist/development";
import { DOMParser } from "@xmldom/xmldom";
import { getIconImages } from "../images";

function decodeImage(uri: string) {
  assert.isTrue(uri.startsWith(sdk.SvgConstants.DataUrlPrefix));
  return Buffer.from(uri.slice(sdk.SvgConstants.DataUrlPrefix.length), "base64").toString("utf8");
}

describe("Iconify sync images", () => {
  it("groups and sorts requests by collection and produces complete SVGs with inherited and per-icon dimensions", async () => {
    let context = newMockExecutionContext();
    context.fetcher.fetch.callsFake(async request => {
      assert.equal(request.method, "GET");
      assert.equal(request.cacheTtlSecs, 86400);
      return newJsonFetchResponse({
        prefix: new URL(request.url).pathname.slice(1, -5),
        width: 24, height: 32,
        icons: {
          home: { body: '<path d="M0 0h24v32H0z" fill="currentColor"/>' },
          alert: { body: '<circle cx="8" cy="8" r="8" fill="#ff0000"/>', width: 16, height: 16 },
        },
      });
    });
    let images = await getIconImages(["mdi:home", "mdi:alert", "lucide:home", "mdi:home"], context);
    assert.equal(context.fetcher.fetch.callCount, 2);
    assert.equal(new URL(context.fetcher.fetch.firstCall.args[0].url).searchParams.get("icons"), "alert,home");
    assert.equal(new URL(context.fetcher.fetch.secondCall.args[0].url).pathname, "/lucide.json");
    assert.equal(images.size, 3);
    let home = new DOMParser().parseFromString(decodeImage(images.get("mdi:home")), "image/svg+xml").documentElement;
    assert.equal(home.tagName, "svg");
    assert.equal(home.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(home.getAttribute("width"), "24");
    assert.equal(home.getAttribute("height"), "32");
    assert.equal(home.getAttribute("viewBox"), "0 0 24 32");
    let alert = decodeImage(images.get("mdi:alert"));
    assert.include(alert, 'viewBox="0 0 16 16"');
    assert.include(alert, 'fill="#ff0000"');
    assert.isFalse(context.temporaryBlobStorage.storeBlob.called);
    assert.isFalse(context.temporaryBlobStorage.storeUrl.called);
  });

  it("resolves aliases, flips, rotations, and namespaced SVG elements", async () => {
    let context = newMockExecutionContext();
    context.fetcher.fetch.resolves(newJsonFetchResponse({
      prefix: "test", width: 24, height: 16,
      icons: { original: { body: '<use xlink:href="#shape"/><path id="shape" d="M0 0h24v16z"/>' } },
      aliases: { turned: { parent: "original", rotate: 1, hFlip: true } },
    }));
    let images = await getIconImages(["test:turned"], context);
    let svg = decodeImage(images.get("test:turned"));
    assert.include(svg, 'xmlns:xlink="http://www.w3.org/1999/xlink"');
    assert.include(svg, 'viewBox="0 0 16 24"');
    assert.include(svg, "rotate(");
    assert.include(svg, "scale(-1 1)");
    assert.notInclude(svg, "undefined");
    assert.equal(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement.tagName, "svg");
  });

  it("splits large icon-name lists into bounded URLs without dropping or duplicating icons", async () => {
    let context = newMockExecutionContext();
    let requested: string[] = [];
    context.fetcher.fetch.callsFake(async request => {
      assert.isAtMost(request.url.length, 1800);
      let names = new URL(request.url).searchParams.get("icons").split(",");
      requested.push(...names);
      return newJsonFetchResponse({
        prefix: "mdi",
        icons: Object.fromEntries(names.map(name => [name, { body: '<path d="M0 0h16v16z"/>' }])),
      });
    });
    let names = Array.from({ length: 500 }, (_, i) => `icon-${String(i).padStart(3, "0")}-${"long-name-".repeat(4)}`);
    let images = await getIconImages([...names].reverse().map(name => `mdi:${name}`), context);
    assert.deepEqual(requested, [...names].sort());
    assert.equal(images.size, 500);
    assert.isAbove(context.fetcher.fetch.callCount, 1);
    for (let name of names) assert.include(decodeImage(images.get(`mdi:${name}`)), '<path d="M0 0h16v16z"/>');
  });

  it("keeps SVGs larger than 4 KB as data URIs and preserves UTF-8 content", async () => {
    let context = newMockExecutionContext();
    let body = '<title>Étoile 星</title>' + '<path d="M0 0h16v16z"/>'.repeat(250);
    context.fetcher.fetch.resolves(newJsonFetchResponse({ prefix: "test", icons: { big: { body } } }));
    let uri = (await getIconImages(["test:big"], context)).get("test:big");
    assert.isAbove(uri.length, 4096);
    assert.include(decodeImage(uri), body);
    assert.isFalse(context.temporaryBlobStorage.storeBlob.called);
  });

  it("does not fetch image data for an empty page", async () => {
    let context = newMockExecutionContext();
    assert.equal((await getIconImages([], context)).size, 0);
    assert.isFalse(context.fetcher.fetch.called);
  });

  it("reports a missing icon rather than falling back to a public SVG request", async () => {
    let context = newMockExecutionContext();
    context.fetcher.fetch.resolves(newJsonFetchResponse({ prefix: "mdi", icons: {}, not_found: ["missing"] }));
    try {
      await getIconImages(["mdi:missing"], context);
      assert.fail("Expected an error");
    } catch (error) {
      assert.include(error.message, 'Iconify did not return image data for "mdi:missing"');
    }
    assert.equal(context.fetcher.fetch.callCount, 1);
    assert.isFalse(context.temporaryBlobStorage.storeBlob.called);
  });
});
