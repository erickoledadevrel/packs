import * as sdk from "@superhuman/plugins-sdk";
import { Row, SheetResult, Sheet, SheetFormatSettings } from "./types";
import { PageSize } from "./builder";

export async function searchSheets(context: sdk.ExecutionContext, query: string): Promise<SheetResult[]> {
  if (query) {
    let url = sdk.withQueryParams("https://api.smartsheet.com/2.0/search", {
      query,
      scopes: "sheetNames",
    })
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let results = response.body.results ?? [];
    return results
      .filter(item => item.objectType == "sheet")
      .map(item => {
        let name = item.text;
        let parent = item.contextData?.[0];
        let id = item.objectId;
        let url = `https://api.smartsheet.com/2.0/sheets/${id}`;
        return {name, parent, id, url};
      });
  } else {
    let url = sdk.withQueryParams("https://api.smartsheet.com/2.0/sheets", {
      pageSize: 100,
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let sheets = response.body.data ?? [];
    return sheets
      .map(sheet => {
        return {
          ...sheet,
          url: `https://api.smartsheet.com/2.0/sheets/${sheets.id}`
        };
      });
  }
}

export async function getSheet(context: sdk.ExecutionContext, sheetUrl: string): Promise<Sheet> {
  let url = sdk.withQueryParams(sheetUrl, {
    include: 'filterDefinitions',
    pageSize: 0,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function syncSheet(context: sdk.ExecutionContext, sheetUrl: string, settings: SheetFormatSettings): Promise<Sheet> {
  let url = sdk.withQueryParams(sheetUrl, {
    page: String(settings.page),
    pageSize: String(PageSize),
    filterId: settings.filterId,
    exclude: 'filteredOutRows',
    columnIds: settings.columnIds,
    include: "rowPermalink",
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body as Sheet;
}

export async function updateRows(context: sdk.ExecutionContext, sheetUrl: string, rows: Row[]) {
  let response = await context.fetcher.fetch({
    method: "PUT",
    url: sdk.withQueryParams(sdk.joinUrl(sheetUrl, "/rows"), {
      allowPartialSuccess: true,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rows),
  });
  return response.body;
}

export async function getRows(context: sdk.ExecutionContext, sheetUrl: string, rowIds: number[], cacheTtlSecs?: number) {
  let url = sdk.withQueryParams(sheetUrl, {
    rowIds: rowIds.join(","),
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs,
  });
  return response.body.rows;
}
