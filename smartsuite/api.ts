import * as coda from "@codahq/packs-sdk";
import { SmartSuiteMember, Solution, Table } from "./types";

export async function listSheets(context: coda.ExecutionContext) {
  let url = coda.withQueryParams("https://api.smartsheet.com/2.0/sheets", {})
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function searchSheets(context: coda.ExecutionContext, search: string) {
  let url = coda.withQueryParams("https://api.smartsheet.com/2.0/search", {
    query: search,
    scopes: "sheetNames",
  })
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function getTables(context: coda.ExecutionContext, solutionId?: string): Promise<Table[]> {
  let url = coda.withQueryParams("https://app.smartsuite.com/api/v1/applications/", {
    solution: solutionId,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function getTable(context: coda.ExecutionContext, tableId: string): Promise<Table> {
  let url = coda.joinUrl("https://app.smartsuite.com/api/v1/applications/", tableId);
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function getSolutions(context: coda.ExecutionContext): Promise<Solution[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/solutions/",
  });
  return response.body;
}

export async function getMembers(context: coda.ExecutionContext, limit: number, offset?: number): Promise<{items: SmartSuiteMember[], total: number}> {
  let payload = {
    limit: limit,
    offset: offset,
  };
  let response = await context.fetcher.fetch({
    method: "POST",
    url: "https://app.smartsuite.com/api/v1/applications/members/records/list/",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.body;
}