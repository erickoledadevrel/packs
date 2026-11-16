# Iconify

A Coda Pack backed by the public Iconify REST API. No authentication is required.

## Formulas

- `Icons(query?, collection?, page?, pageSize?)` searches for icons or browses
  a single collection. Provide a query, a collection ID, or both.
  It returns an object containing
  `icons`, `collections`, `page`, `hasMore`, and a `summary` used for display.
  The summary is `Page 1 of "home"`, `Page 1 of mdi`, or
  `Page 1 of "home" in mdi`, depending on the inputs and page.
  Pages start at 1; the default page size is 20 (allowed range: 1–999).
  Each icon contains its full `id` (for example `mdi:home`), `collectionId`
  (`mdi`), `image`, displayed as an image reference, and `link` to its Iconify page.
  `collections` is a list of the collections included in that response, with
  metadata supplied by the API.
- `Collections()` lists all available collections and their metadata. Collection
  IDs are also suggested by the `Icons` formula's `collection` parameter.

Examples:

```text
Icons("home")
Icons("home", "mdi", 2, 64)
Icons("", "mdi")
Icons("", "mdi", 2, 20)
Collections()
```

Collection metadata includes ID, name, a `link` to its Iconify page, icon count, version, author, license,
samples, category, tags, and palette, where supplied by Iconify.
With a query, an omitted or empty collection filter searches all collections.
With a collection only, visible icon names are deduplicated and sorted
alphabetically. Hidden icons and aliases are excluded. Pagination is applied locally to
the full list, so collection browsing is not subject to the search result cap.

In collection browsing, `hasMore` reports whether another page exists.
In search mode it indicates that another page may be available; the next page
can still be empty. Iconify exposes at most 999 results per search. The last search page
can be shorter to fit this cap, and pages starting at or beyond result 999 are
rejected; narrow the query or collection filter to find more specific results.
Formula results and API fetcher requests are cached for one day, including
collection requests used by autocomplete.

For search page sizes below 32, the Pack requests at least 32 cumulative results to meet
Iconify's API minimum, then returns only the requested page and its collections.

API documentation: [search](https://iconify.design/docs/api/search.html),
[collection icons](https://iconify.design/docs/api/collection.html),
[collections](https://iconify.design/docs/api/collections.html),
[collection metadata](https://iconify.design/docs/types/iconify-info.html),
[SVG URLs](https://iconify.design/docs/api/svg.html).

## Sync tables

- **Icons** accepts the same optional `query` and `collection` inputs as the
  formula, with at least one required. Each row includes `id`, `collectionId`,
  `image`, `link`, and a `collection` reference that links to the matching row
  in the Collections sync table. Sync both tables to resolve these references.
  The `image` field is an SVG data URI displayed as an image reference. The Pack
  batch-fetches icon data by collection, resolves aliases and transforms, and
  builds complete SVGs server-side. The Doc does not need to download each SVG
  from Iconify, and no temporary image uploads are required. All sync images use
  data URIs without a size cutoff; large collections increase document size.
  The paginated `Icons()` formula continues to return hosted SVG URLs.
- **Collections** has no inputs and returns all collections using the same
  metadata schema as the formula.

Both tables use 500-row batches and continuation cursors to finish syncing.
Search requests use cumulative limits of 500 then 999, stopping at Iconify's
search cap. Servers may impose a lower cap than the documented 999 results;
the live public API currently clamps large search requests to 128. Sync honors
the returned limit and stops without an invalid continuation. Collection browsing
can sync the full visible icon list.
The collection endpoints return complete lists, so continuations page those
lists locally using API requests cached for one day. Only cursors are stored in
continuations, allowing each batch to run in a fresh execution context.

Run the Pack tests from the repository root:

```sh
node --import=tsx node_modules/mocha/bin/mocha "iconify/tests/*_test.ts"
```
