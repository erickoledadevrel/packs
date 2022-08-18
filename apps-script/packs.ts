import * as coda from "@codahq/packs-sdk";
import { ScriptUrlRegexes } from "./constants";
import { getFiles, getMetrics, getScript, getScripts, parseScriptId } from "./helpers";
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
    "https://www.googleapis.com/auth/drive.metadata.readonly",
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

pack.addSyncTable({
  name: "Scripts",
  description: "Your Apps Script projects.",
  identityName: "Script",
  schema: ScriptSchema,
  formula: {
    name: "SyncScripts",
    description: "Syncs the scripts.",
    parameters: [],
    execute: async function (args, context) {
      let pageToken = context.sync.continuation?.pageToken as string;
      let response = await getScripts(context, pageToken);
      let files = response.files;
      let scriptIds = files.map(file => file.id);
      let jobs = scriptIds.map(scriptId => Promise.all([
        getScript(scriptId, context),
        getFiles(scriptId, context),
        getMetrics(scriptId, context),
      ]));
      let results = await Promise.all(jobs);
      let scripts = results.map(([script, files, metrics]) => {
        return {
          ...script,
          files,
          metrics,
        };
      });

      let continuation;
      if (response.nextPageToken) {
        continuation = { pageToken: response.nextPageToken };
      }
      return {
        result: scripts,
        continuation,
      };
    },
  }
});
