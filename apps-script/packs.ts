import * as coda from "@codahq/packs-sdk";
import { ScriptUrlRegexes } from "./constants";
import { getFiles, getMetrics, getScript, parseScriptId } from "./helpers";
import { ScriptSchema } from "./schemas";
export const pack = coda.newPack();

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "profile",
    "https://www.googleapis.com/auth/script.metrics",
    "https://www.googleapis.com/auth/script.projects.readonly",
  ],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
  getConnectionName: async function (context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://www.googleapis.com/oauth2/v1/userinfo",
    });
    let user = response.body;
    return user.name;
  },
});

pack.addFormula({
  name: "Script",
  description: "Get details about an Apps Script project.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL or ID of the script.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: ScriptSchema,
  execute: async function (args, context) {
    let [url] = args;
    let scriptId = parseScriptId(url);
    let jobs = [
      getScript(scriptId, context),
      getFiles(scriptId, context),
      getMetrics(scriptId, context),
    ];
    let [script, files, metrics] = await Promise.all(jobs);
    return {
      ...script,
      files,
      metrics,
    };
  },
});

pack.addColumnFormat({
  name: "Script",
  formulaName: "Script",
  instructions: "Enter the URL of an Apps Script project.",
  matchers: ScriptUrlRegexes,
});
