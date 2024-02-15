import * as coda from "@codahq/packs-sdk";
import { Row, Sheet, SheetFormatSettings } from "./types";
import { PageSize } from "./pack";

export async function getSheet(context: coda.ExecutionContext, sheetUrl: string): Promise<Sheet> {
  let url = coda.withQueryParams(sheetUrl, {
    include: 'filterDefinitions',
    pageSize: 0,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function syncSheet(context: coda.ExecutionContext, sheetUrl: string, settings: SheetFormatSettings): Promise<Sheet> {
  let url = coda.withQueryParams(sheetUrl, {
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

export async function updateRows(context: coda.ExecutionContext, sheetUrl: string, rows: Row[]) {
  let response = await context.fetcher.fetch({
    method: "PUT",
    url: coda.withQueryParams(coda.joinUrl(sheetUrl, "/rows"), {
      allowPartialSuccess: true,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rows),
  });
  return response.body;
}

export async function getRows(context: coda.ExecutionContext, sheetUrl: string, rowIds: number[], cacheTtlSecs?: number) {
  let url = coda.withQueryParams(sheetUrl, {
    rowIds: rowIds.join(","),
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs,
  });
  return response.body.rows;
}
