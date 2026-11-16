import * as sdk from "@superhuman/plugins-sdk";
import type * as sst from "./types/smartsuite";
import * as qs from 'qs';

const ShortCacheSecs = 5 * 60;
const MaxCacheSecs = 24 * 60 * 60;

export async function getRecords(context: sdk.ExecutionContext, tableId: string, body: any, limit: number, offset?: number): Promise<{total: number, items: sst.Row[]}> {
  let url = sdk.withQueryParams(`https://app.smartsuite.com/api/v1/applications/${tableId}/records/list/`, {
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

export async function getTables(context: sdk.ExecutionContext, solutionId?: string): Promise<sst.SimpleTable[]> {
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

export async function getTable(context: sdk.ExecutionContext, tableId: string, cacheTtlSecs = ShortCacheSecs): Promise<sst.Table> {
  let url = sdk.joinUrl("https://app.smartsuite.com/api/v1/applications/", tableId);
  let response = await fetch(context, {
    method: "GET",
    url: url,
    cacheTtlSecs: cacheTtlSecs,
  });
  return response.body;
}

export async function getSolutions(context: sdk.ExecutionContext): Promise<sst.Solution[]> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/solutions/",
  });
  return response.body;
}

export async function getSolution(context: sdk.ExecutionContext, solutionId: string): Promise<sst.Solution> {
  let response = await fetch(context, {
    method: "GET",
    url: sdk.joinUrl("https://app.smartsuite.com/api/v1/solutions/", solutionId),
  });
  return response.body;
}

export async function getAccounts(context: sdk.ExecutionContext): Promise<sst.Account[]> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/accounts/",
  });
  return response.body;
}

export async function getAccount(context: sdk.ExecutionContext, accountId: string): Promise<sst.Account> {
  let response = await fetch(context, {
    method: "GET",
    url: sdk.joinUrl("https://app.smartsuite.com/api/v1/accounts/", accountId),
  });
  return response.body;
}

export async function getCurrentMember(context: sdk.ExecutionContext): Promise<sst.Member> {
  let response = await fetch(context, {
    method: "GET",
    url: "https://app.smartsuite.com/api/v1/current-member/",
  });
  return response.body;
}

export async function getMembers(context: sdk.ExecutionContext, limit: number, offset?: number): Promise<{items: sst.Member[], total: number}> {
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

export async function getSharedFile(context: sdk.ExecutionContext, fileHandle: string): Promise<sst.SharedFile> {
  let response = await fetch(context, {
    method: "GET",
    url: `https://app.smartsuite.com/api/v1/shared-files/${fileHandle}/url/`,
    cacheTtlSecs: MaxCacheSecs,
  });
  return response.body;
}

export async function fetch(context: sdk.ExecutionContext, request: sdk.FetchRequest): Promise<sdk.FetchResponse> {
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

export function getAccountId(context: sdk.ExecutionContext) {
  return context.endpoint?.split("#")[1];
}

export async function getMembersTable(context: sdk.ExecutionContext): Promise<sst.Table> {
  return getTable(context, "members", MaxCacheSecs);
}