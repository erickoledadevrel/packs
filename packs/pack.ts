import * as coda from "@codahq/packs-sdk";
import { extendSchema, getPackId, formatItem, getMetdataSettings, getVersions, getFiles, handleError } from "./helpers";
import { MetadataTypes, PackUrlRegexes } from "./constants";
import { PackSchema } from "./schemas";
const escape = require('escape-html');

export const pack = coda.newPack();

const PackIdOrUrlParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "packIdOrUrl",
  description: "The ID or URL of the Pack.",
});

pack.addNetworkDomain("coda.io");
pack.addNetworkDomain("coda-us-west-2-prod-packs.s3.us-west-2.amazonaws.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
  networkDomain: "coda.io",
});

pack.addFormula({
  name: "Pack",
  description: "Load information about a Pack",
  parameters: [
    PackIdOrUrlParameter,
  ],
  resultType: coda.ValueType.Object,
  schema: extendSchema(Object.keys(MetadataTypes)),
  execute: async function (args, context) {
    let [packIdOrUrl] = args;
    let packId = getPackId(context, packIdOrUrl);
    let baseUrl = coda.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/packs/listings");
    let url = coda.withQueryParams(baseUrl, {
      packIds: packId
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let { items } = response.body;
    if (!items?.length) {
      throw new coda.UserVisibleError(`Pack not found: ${packIdOrUrl}`);
    }
    let item = items[0];
    formatItem(context, item);
    let jobs = [];
    let metadata = Object.keys(MetadataTypes);
    for (let key of metadata) {
      let settings = getMetdataSettings(key);
      jobs.push(settings.callback(context, items));
    }
    await Promise.allSettled(jobs);
    return item;
  },
});

pack.addColumnFormat({
  name: "Pack",
  instructions: "Enter the ID or URL of a Pack.",
  formulaName: "Pack",
  matchers: PackUrlRegexes,
});

pack.addSyncTable({
  name: "Packs",
  description: "A list of all of the published Packs.",
  identityName: "Pack",
  schema: PackSchema,
  dynamicOptions: {
    getSchema: async function (context, search, args) {
      let metadata = args.metdata ?? [];
      return extendSchema(metadata);
    },
  },
  formula: {
    name: "SyncPacks",
    description: "Sync the Packs.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePublished",
        description: "Include public Packs published in the gallery.",
        suggestedValue: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeWorkspace",
        description: "Include internal Packs shared with everyone in your workspace.",
        suggestedValue: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePrivate",
        description: "Include private Packs you created or were shared with your directly.",
        suggestedValue: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "metdata",
        description: "Which additional Pack metadata to include (may increase time to sync).",
        optional: true,
        autocomplete: Object.entries(MetadataTypes).map(([key, value]) => ({
          display: value.name, value: key,
        })),
      }),
    ],
    execute: async function (args, context) {
      let [
        includePublished,
        includeWorkspace,
        includePrivate,
        metadata = [],
      ] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        let baseUrl = coda.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/packs/listings");
        url = coda.withQueryParams(baseUrl, {
          excludePublicPacks: !includePublished,
          excludeWorkspaceAcls: !includeWorkspace,
          excludeIndividualAcls: !includePrivate,
          limit: 20,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let { items, nextPageLink } = response.body;
      for (let item of items) {
       formatItem(context, item);
      }
      let jobs = [];
      for (let key of metadata) {
        let settings = getMetdataSettings(key);
        jobs.push(settings.callback(context, items));
      }
      await Promise.allSettled(jobs);
      let continuation;
      if (nextPageLink) {
        continuation = { url: nextPageLink };
      }
      return {
        result: items,
        continuation,
      };
    },
  },
});

pack.addFormula({
  name: "SourceCode",
  description: "Gets the source code for a Pack. You must be a Pack Admin of the Pack.",
  parameters: [
    PackIdOrUrlParameter,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "version",
      description: "Which version of the Pack to get the source code for.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Html,
  onError: handleError,
  execute: async function (args, context) {
    let [packIdOrUrl, version] = args;
    let packId = getPackId(context, packIdOrUrl);
    if (!version) {
      let versions = await getVersions(context, packId);
      version = versions[0].packVersion;
    }
    let files = await getFiles(context, packId, version);
    if (!files?.length)  {
      throw new Error(`No source code found.`);
    }
    let file = files[0];
    let response = await context.fetcher.fetch({
      method: "GET",
      url: file.url,
      disableAuthentication: true,
    });
    let code = response.body;
    return `<pre>${escape(code)}</pre>`;
  },
});
