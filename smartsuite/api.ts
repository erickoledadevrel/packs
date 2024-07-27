import * as coda from "@codahq/packs-sdk";
import type * as sst from "./types/smartsuite";
import * as qs from 'qs';

const ShortCacheSecs = 5 * 60;
const MaxCacheSecs = 24 * 60 * 60;

export async function getRecords(context: coda.ExecutionContext, tableId: string, body: any, limit: number, offset?: number): Promise<{total: number, items: sst.Row[]}> {
  let url = coda.withQueryParams(`https://app.smartsuite.com/api/v1/applications/${tableId}/records/list/`, {
    offset: offset,
    limit: limit,
  });
  let response = await fetch(context, {
    method: "POST",
    url: url,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.body;
}

export async function getTables(context: coda.ExecutionContext, solutionId?: string): Promise<sst.SimpleTable[]> {
  let params = {
    solution: solutionId,
    fields: ["name", "id", "slug"],
  };
  // Use qs so that multiple copies of the fields parameter are added to the URL.
  let url = "https://app.smartsuite.com/api/v1/applications/?" + qs.stringify(params, {indices: false})
  let response = await fetch(context, {
    method: "GET",
    url: url,
  });
  return response.body;
}

export async function getTable(context: coda.ExecutionContext, tableId: string, cacheTtlSecs = ShortCacheSecs): Promise<sst.Table> {
  let url = coda.joinUrl("https://app.smartsuite.com/api/v1/applications/", tableId);
  let response = await fetch(context, {
    method: "GET",
    url: url,
    cacheTtlSecs: cacheTtlSecs,
  });
  return response.body;
}

export async function getSolutions(context: coda.ExecutionContext): Promise<sst.Solution[]> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/solutions/",
  });
  return response.body;
}

export async function getSolution(context: coda.ExecutionContext, solutionId: string): Promise<sst.Solution> {
  let response = await fetch(context, {
    method: "GET",
    url: coda.joinUrl("https://app.smartsuite.com/api/v1/solutions/", solutionId),
  });
  return response.body;
}

export async function getAccounts(context: coda.ExecutionContext): Promise<sst.Account[]> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/accounts/",
  });
  return response.body;
}

export async function getAccount(context: coda.ExecutionContext, accountId: string): Promise<sst.Account> {
  let response = await fetch(context, {
    method: "GET",
    url: coda.joinUrl("https://app.smartsuite.com/api/v1/accounts/", accountId),
  });
  return response.body;
}

export async function getCurrentMember(context: coda.ExecutionContext): Promise<sst.Member> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/current-member/",
  });
  return response.body;
}

export async function getMembers(context: coda.ExecutionContext, limit: number, offset?: number): Promise<{items: sst.Member[], total: number}> {
  let payload = {
    limit: limit,
    offset: offset,
  };
  let response = await fetch(context, {
    method: "POST",
    url: "https://app.smartsuite.com/api/v1/applications/members/records/list/",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.body;
}

export async function getSharedFile(context: coda.ExecutionContext, fileHandle: string): Promise<sst.SharedFile> {
  let response = await fetch(context, {
    method: "GET",
    url: `https://app.smartsuite.com/api/v1/shared-files/${fileHandle}/url/`,
    cacheTtlSecs: MaxCacheSecs,
  });
  return response.body;
}

export async function fetch(context: coda.ExecutionContext, request: coda.FetchRequest): Promise<coda.FetchResponse> {
  let accountId = getAccountId(context);
  request.headers = {
    ...request.headers,
    "Account-ID": accountId,
  };
  if (request.cacheTtlSecs === undefined) {
    request.cacheTtlSecs = ShortCacheSecs;
  }
  return context.fetcher.fetch(request);
}

export function getAccountId(context: coda.ExecutionContext) {
  return context.endpoint?.split("#")[1];
}

export async function getMembersTable(context: coda.ExecutionContext): Promise<sst.Table> {
  return getTable(context, "members", MaxCacheSecs);
}