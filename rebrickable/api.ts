import * as coda from "@codahq/packs-sdk";

const OneDaySecs = 24 * 60 * 60;

export async function getSet(context: coda.ExecutionContext, id: string) {
  let url = `https://rebrickable.com/api/v3/lego/sets/${id}`;
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    cacheTtlSecs: OneDaySecs,
  });
  return response.body;
}

export async function listSets(context: coda.ExecutionContext, themeId?: string, max = 500) {
  let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/sets/", {
    page_size: max,
    theme_id: themeId,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    cacheTtlSecs: OneDaySecs,
  });
  let page = response.body;
  return page.results;
}

export async function listPartCategories(context: coda.ExecutionContext, max = 1000) {
  let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/part_categories/", {
    page_size: max,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    cacheTtlSecs: OneDaySecs,
  });
  let page = response.body;
  return page.results;
}

export async function listParts(context: coda.ExecutionContext, categoryId?: string, max = 1000) {
  let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/parts", {
    page_size: max,
    part_cat_id: categoryId,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    cacheTtlSecs: OneDaySecs,
  });
  let page = response.body;
  return page.results;
}

export async function listThemes(context: coda.ExecutionContext, max = 1000) {
  let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/themes/", {
    page_size: max,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    cacheTtlSecs: OneDaySecs,
  });
  let page = response.body;
  return page.results;
}