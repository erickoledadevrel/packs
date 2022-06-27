import * as coda from "@codahq/packs-sdk";
import { ApiFilter, ApiKey, ApiVersion, BaseUrl, DevApiKey, Sites } from "./constants";

export function getUrl(path, context: coda.ExecutionContext, params = {}) {
  let url = coda.joinUrl(BaseUrl, ApiVersion, path);
  return coda.withQueryParams(url, {
    key: getKey(context),
    site: getSite(context),
    filter: ApiFilter,
    ...params,
  });
}

function getKey(context: coda.ExecutionContext) {
  return context.invocationLocation.docId ? ApiKey : DevApiKey;
}

function getSite(context: coda.ExecutionContext) {
  if (!context.endpoint) {
    return null;
  }
  return coda.getQueryParams(context.endpoint).site;
}

export function formatDate(date: Date) {
  return Math.round(date.getTime() / 1000);
}

export function getMatchers(path: string): RegExp[] {
  return Sites.map(site => {
    let url = coda.joinUrl(`https://(${site.value})`, path, "(\\d+)")
    return new RegExp(url);
  });
}

export function extractId(path: string, urlOrId: string) {
  if (!isNaN(parseInt(urlOrId))) {
    return {
      site: undefined,
      id: urlOrId,
    }
  };
  let matchers = getMatchers(path);
  for (let matcher of matchers) {
    let match = urlOrId.match(matcher);
    if (match) {
      return {
        site: match[1],
        id: match[2],
      };
    }
  }
  return null;
}

export async function wait(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), seconds * 1000);
  });
}