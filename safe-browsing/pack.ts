import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const DefaultThreatTypes = ["MALWARE", "SOCIAL_ENGINEERING"];
const DefaultPlatforms = ["ALL_PLATFORMS"];

const ThreatTypeParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "threatTypes",
  description: `Which type of threats to check for. Default: ${DefaultThreatTypes.join(", ")}`,
  optional: true,
  autocomplete: async function (context) {
    let lists = await getThreatLists(context);
    let types = lists.map(list => list.threatType);
    return Array.from(new Set(types));
  }
});

const PlatformParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "platforms",
  description: `Which platforms to check for threats. Default: ${DefaultPlatforms.join(", ")}`,
  optional: true,
  autocomplete: async function (context) {
    let lists = await getThreatLists(context);
    let platforms = lists.map(list => list.platformType);
    return Array.from(new Set(platforms));
  }
});

const ThreatSchema = coda.makeObjectSchema({
  properties: {
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    threatType: { type: coda.ValueType.String },
    platformType: { type: coda.ValueType.String },
  },
  displayProperty: "url",
});

pack.setSystemAuthentication({
  type: coda.AuthenticationType.QueryParamToken,
  paramName: "key",
});

pack.addNetworkDomain("googleapis.com");

pack.addFormula({
  name: "IsThreat",
  description: "Determines if a given URL is a threat.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL to evaluate.",
    }),
    ThreatTypeParam,
    PlatformParam,
  ],
  resultType: coda.ValueType.Boolean,
  cacheTtlSecs: 300,
  onError: onError,
  execute: async function (args, context) {
    let [
      url,
      threatTypes = DefaultThreatTypes,
      platforms = DefaultPlatforms,
    ] = args;
    if (!isUrl(url)) throw new coda.UserVisibleError(`Invalid URL: "${url}"`);
    let matches = await findThreats(context, [url], threatTypes, platforms);
    return matches.length > 0;
  },
});

pack.addFormula({
  name: "Threats",
  description: "Finds threars in a list of URLs.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.StringArray,
      name: "urls",
      description: "The list of URLs to check.",
    }),
    ThreatTypeParam,
    PlatformParam,
  ],
  resultType: coda.ValueType.Array,
  items: ThreatSchema,
  onError: onError,
  execute: async function (args, context) {
    let [
      urls,
      threatTypes = DefaultThreatTypes,
      platforms = DefaultPlatforms,
    ] = args;
    urls = urls.filter(Boolean);
    if (urls.length == 0) {
      return [];
    }
    for (let url of urls) {
      if (!isUrl(url)) throw new coda.UserVisibleError(`Invalid URL: "${url}"`);
    }
    let matches = await findThreats(context, urls, threatTypes, platforms);
    for (let match of matches) {
      match.url = match.threat.url;
    }
    return matches;
  },
});

async function getThreatLists(context: coda.ExecutionContext): Promise<any[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://safebrowsing.googleapis.com/v4/threatLists",
  });
  let data = response.body;
  return data.threatLists.filter((list: any) => list.threatEntryType == "URL");
}

function isUrl(url: string) {
  return url && (url.startsWith("https://") || url.startsWith("http://"));
}

async function findThreats(context: coda.ExecutionContext, urls: string[], types = DefaultThreatTypes, platforms = DefaultPlatforms) {
  let payload = {
    client: {
      clientId: "EricKoledaCodaPack",
    },
    threatInfo: {
      threatTypes: types,
      platformTypes: platforms,
      threatEntryTypes: ["URL"],
      threatEntries: urls.map(url => ({ url })),
    },
  };
  let response = await context.fetcher.fetch({
    method: "POST",
    url: "https://safebrowsing.googleapis.com/v4/threatMatches:find",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.body.matches ?? [];
}

function onError(error: any) {
  if (error.statusCode) {
    let message = error.body?.error?.message;
    if (message) {
      throw new coda.UserVisibleError(message);
    }
  }
  throw error;
}
