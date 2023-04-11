import * as coda from "@codahq/packs-sdk";
import { ScriptUrlRegexes } from "./constants";
import { getFiles, getMetrics, getScript, parseScriptId } from "./helpers";
import { ScriptSchema } from "./schemas";

const DefaultRequestMethod = "GET";
const SupportedRequestMethods = ["GET", "POST"];
const DefaultRequestContentType = "text/plain";

export const pack = coda.newPack();

pack.addNetworkDomain("googleapis.com");
pack.addNetworkDomain("script.google.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  // TODO: Use googleapis.com URL after config change.
  // tokenUrl: "https://oauth2.googleapis.com/token",
  tokenUrl: "https://accounts.google.com/o/oauth2/token",
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
  networkDomain: "googleapis.com",
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
      link: `https://script.google.com/home/projects/${script.scriptId}`,
    };
  },
});

pack.addColumnFormat({
  name: "Script",
  formulaName: "Script",
  instructions: "Enter the URL of an Apps Script project.",
  matchers: ScriptUrlRegexes,
});

pack.addFormula({
  name: "TriggerWebApp",
  description: `Make a request to a Google Apps Script web app. It must be deployed using "Execute as: Me" and "Who has access: Anyone".`,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: `The URL of the Apps Script web app. Usually in the form "https://script.google.com/macros/s/.../exec".`,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "method",
      description: `The HTTP method to use when making the request. Use "GET" for doGet() and "POST" for doPost(). Default: ${DefaultRequestMethod}.`,
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "parameters",
      description: `The request parameters to include, available in Apps Script at "e.parameter". Use the RequestParameters() formula to construct this value.`,
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "body",
      description: `The content to send in the HTTP body, available in Apps Script at "e.postData.contents". Only supported when the method is "POST".`,
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "contentType",
      description: `The MIME type of the body content, avalable in Apps Script at "e.postData.type". Only supported when the method is "POST" and a body is specified. Default: "${DefaultRequestContentType}".`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function (args, context) {
    let [
      url,
      method = DefaultRequestMethod,
      parameters,
      body,
      contentType = DefaultRequestContentType
    ] = args;
    if (!SupportedRequestMethods.includes(method)) {
      throw new coda.UserVisibleError(`Invalid method: ${method}`);
    }
    if (parameters) {
      let parsed;
      try {
        parsed = JSON.parse(parameters);
      } catch (e) {
        throw new coda.UserVisibleError(`Invalid parameters: ${parameters}`);
      }
      url = coda.withQueryParams(url, parsed);
    }
    let request: coda.FetchRequest = {
      method: method == "GET" ? "GET" : "POST",
      url,
      headers: {},
      disableAuthentication: true,
    };
    if (body) {
      request.body = body;
      request.headers["Content-Type"] = contentType;
    }
    let response = await context.fetcher.fetch(request);
    let result = response.body;
    if (typeof result == "object") {
      result = JSON.stringify(result);
    }
    return result;
  },
});

pack.addFormula({
  name: "RequestParameters",
  description: "Build a set of request parameters, to use with the TriggerWebApp action.",
  parameters: [],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the parameter.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value of the parameter.",
    }),
  ],
  resultType: coda.ValueType.String,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function (args: any[], context) {
    let result: Record<string, string> = {};
    while (args.length > 0) {
      let [name, value, ...rest] = args;
      result[name] = String(value);
      args = rest;
    }
    return JSON.stringify(result);
  },
});

pack.addFormula({
  name: "JSONBody",
  description: "Build a JSON object from key-value pairs, to pass in the body of the TriggerWebApp action.",
  parameters: [],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "key",
      description: "A key to add to the object.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value to store at that key.",
    }),
  ],
  resultType: coda.ValueType.String,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function (args: any[], context) {
    let result: Record<string, string> = {};
    while (args.length > 0) {
      let [name, value, ...rest] = args;
      result[name] = String(value);
      args = rest;
    }
    return JSON.stringify(result);
  },
});
