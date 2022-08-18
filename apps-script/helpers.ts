import * as coda from "@codahq/packs-sdk";
import { ScriptUrlRegexes } from "./constants";

const PageSize = 20;
const Extensions = {
  SERVER_JS: "gs",
  JSON: "json",
  HTML: "html",
};

export function parseScriptId(scriptIdOrUrl: string): string {
  for (let regex of ScriptUrlRegexes) {
    let match = scriptIdOrUrl.match(regex);
    if (match) return match[1];
  }
  return scriptIdOrUrl;
}

export async function getScript(scriptId: string, context: coda.ExecutionContext) {
  let url = `https://script.googleapis.com/v1/projects/${scriptId}`;
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
  });
  let script = response.body;
  return script;
}

export async function getFiles(scriptId: string, context: coda.ExecutionContext) {
  let url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
  });
  let files = response.body.files;
  for (let file of files) {
    let extension = Extensions[file.type];
    if (extension) {
      file.name += `.${extension}`;
    }  
  }
  return files;
}

export async function getMetrics(scriptId: string, context: coda.ExecutionContext) {
  let url = coda.withQueryParams(`https://script.googleapis.com/v1/projects/${scriptId}/metrics`, {
    metricsGranularity: "WEEKLY",
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
  });
  let metrics = response.body;
  for (let [key, value] of Object.entries(metrics)) {
    metrics[key] = value[0].value ?? 0;
  }
  return metrics;
}

export async function getScripts(context: coda.SyncExecutionContext, pageToken?: string) {
  let url = coda.withQueryParams("https://www.googleapis.com/drive/v3/files", {
    q: "mimeType:'application/vnd.google-apps.script'",
    pageSize: PageSize,
    pageToken,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
  });
  let data = response.body;
  return data;
}