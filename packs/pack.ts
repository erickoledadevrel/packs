import * as sdk from "@superhuman/plugins-sdk";
import { extendSchema, getPackId, formatItem, getMetdataSettings, getVersions, getFiles, handleError, getCategories, unformatItem, removeCategory, addCategory, addStats, addManifest } from "./helpers";
import { MetadataTypes, PackUrlRegexes, PageSize } from "./constants";
import { MyPackSchema, PackSchema, StatsSchema } from "./schemas";
const escape = require('escape-html');

export const pack = sdk.newPack();

const PackIdOrUrlParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "packIdOrUrl",
  description: "The ID or URL of the Pack.",
});

const ManifestFieldsParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "manifestFields",
  description: "If this field mask is specified, the selected fields from Pack's internal manifest will be included as raw JSON in Manifest.",
  optional: true,
});

const IncludeBrainOnlyPacksOption = "includeBrainOnlyPacks";
const CertifiedAgentsOnlyOption = "certifiedAgentsOnly";
const AllOptions = [IncludeBrainOnlyPacksOption, CertifiedAgentsOnlyOption];

pack.addNetworkDomain("sdk.io");
pack.addNetworkDomain("coda-us-west-2-prod-packs.s3.us-west-2.amazonaws.com");

pack.setUserAuthentication({
  type: sdk.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
  networkDomain: "sdk.io",
});

pack.addFormula({
  name: "Pack",
  description: "Load information about a Pack",
  parameters: [
    PackIdOrUrlParameter,
    ManifestFieldsParameter,
  ],
  resultType: sdk.ValueType.Object,
  schema: extendSchema(Object.keys(MetadataTypes), true),
  execute: async function (args, context) {
    let [packIdOrUrl, manifestFields] = args;
    let packId = getPackId(context, packIdOrUrl);
    let baseUrl = sdk.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/packs/listings");
    let url = sdk.withQueryParams(baseUrl, {
      packIds: packId
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let { items } = response.body;
    if (!items?.length) {
      throw new sdk.UserVisibleError(`Pack not found: ${packIdOrUrl}`);
    }
    let item = items[0];
    formatItem(context, item);
    let jobs = [];
    let metadata = Object.keys(MetadataTypes);
    for (let key of metadata) {
      let settings = getMetdataSettings(key);
      jobs.push(settings.callback(context, items));
    }
    if (manifestFields) {
      jobs.push(addManifest(context, items, manifestFields))
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
  description: "Lists of all of the Packs you have access to.",
  identityName: "Pack",
  schema: PackSchema,
  dynamicOptions: {
    getSchema: async function (context, search, args) {
      let metadata = args.metdata ?? [];
      let schema = extendSchema(metadata, Boolean(args.manifestFields));
      return schema;
    },
    propertyOptions: async function (context) {
      switch (context.propertyName) {
        case "categories":
          return await getCategories(context);
        default:
          throw new sdk.UserVisibleError(`Unknown property: ${context.propertyName}`);
      }
    },
  },
  formula: {
    name: "SyncPacks",
    description: "Sync the Packs.",
    parameters: [
      sdk.makeParameter({
        type: sdk.ParameterType.Boolean,
        name: "includePublished",
        description: "Include public Packs published in the gallery.",
        suggestedValue: true,
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.Boolean,
        name: "includeWorkspace",
        description: "Include internal Packs shared with everyone in your workspace.",
        suggestedValue: false,
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.Boolean,
        name: "includePrivate",
        description: "Include private Packs you created or were shared with your directly.",
        suggestedValue: false,
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "metdata",
        description: "Which additional Pack metadata to include (may increase time to sync).",
        optional: true,
        autocomplete: Object.entries(MetadataTypes).map(([key, value]) => ({
          display: value.name, value: key,
        })),
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "options",
        description: "Additional options to enable.",
        optional: true,
        autocomplete: AllOptions,
      }),
      ManifestFieldsParameter,
    ],
    execute: async function (args, context) {
      let [
        includePublished,
        includeWorkspace,
        includePrivate,
        metadata = [],
        options = [],
        manifestFields,
      ] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        let baseUrl = sdk.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/packs/listings");
        let pageSize = metadata.reduce((result, key) => {
          let maxPageSize = getMetdataSettings(key).maxPageSize;
            return maxPageSize ? Math.min(result, maxPageSize) : result;
          }, PageSize);
        
        url = sdk.withQueryParams(baseUrl, {
          excludePublicPacks: !includePublished,
          excludeWorkspaceAcls: !includeWorkspace,
          excludeIndividualAcls: !includePrivate,
          includeBrainOnlyPacks: options.includes(IncludeBrainOnlyPacksOption),
          certifiedAgentsOnly: options.includes(CertifiedAgentsOnlyOption),
          limit: pageSize,
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
      if (manifestFields) {
        jobs.push(addManifest(context, items, manifestFields))
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

pack.addSyncTable({
  name: "MyPacks",
  description: "Lists the Packs that you can edit. Only includes basic information about each Pack.",
  identityName: "MyPack",
  schema: MyPackSchema,
  dynamicOptions: {
    entityName: "Pack",
    propertyOptions: async function (context) {
      switch (context.propertyName) {
        case "categories":
          return await getCategories(context);
        default:
          throw new sdk.UserVisibleError(`Unknown property: ${context.propertyName}`);
      }
    },
  },
  formula: {
    name: "SyncMyPacks",
    description: "Sync the MyPacks.",
    parameters: [],
    execute: async function (args, context) {
      let url = context.sync.continuation?.url as string;
      if (!url) {
        let baseUrl = sdk.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/packs");
        url = sdk.withQueryParams(baseUrl, {
          accessTypes: "edit,admin",
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
      await addStats(context, items);
      let continuation;
      if (nextPageLink) {
        continuation = { url: nextPageLink };
      }
      return {
        result: items,
        continuation,
      };
    },
    executeUpdate: async function (args, updates, context) {
      let host = context.invocationLocation.protocolAndHost;
      let update = updates[0];
      let pack = update.newValue;

      if (update.updatedFields.includes("categories")) {
        let jobs = [];
        for (let category of update.previousValue.categories) {
          if (!update.newValue.categories.includes(category)) {
            jobs.push(removeCategory(context, pack.packId, category));
          }
        }
        for (let category of update.newValue.categories) {
          if (!update.previousValue.categories.includes(category)) {
            jobs.push(addCategory(context, pack.packId, category));
          }
        }
        await Promise.all(jobs);
      }

      unformatItem(pack);
      let body = Object.fromEntries(
        Object.entries(update.newValue).filter(
          ([key, value]) => update.updatedFields.includes(key)));
      let response = await context.fetcher.fetch({
        method: "PATCH",
        url: sdk.joinUrl(host, "apis/v1/packs", String(pack.packId)),
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      let final = response.body;
      formatItem(context, final);
      return {
        result: [final],
      };
    },
  },
});

pack.addSyncTable({
  name: "Stats",
  description: "Usage stats for all the Packs that you can edit.",
  identityName: "Stats",
  schema: StatsSchema,
  formula: {
    name: "SyncStats",
    description: "Sync the stats.",
    parameters: [
      sdk.makeParameter({
        type: sdk.ParameterType.DateArray,
        name: "dateRange",
        description: "The date range of stats to retrieve.",
        suggestedValue: sdk.PrecannedDateRange.Last90Days,
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "packIds",
        description: "If specified, only the stats for these Packs will be included.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [dateRange, packIds] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        let baseUrl = sdk.joinUrl(context.invocationLocation.protocolAndHost, "apis/v1/analytics/packs");
        url = sdk.withQueryParams(baseUrl, {
          sinceDate: dateRange[0].toISOString().split("T")[0],
          untilDate: dateRange[1].toISOString().split("T")[0],
          scale: "daily",
          limit: 200,
          packIds: packIds?.length ? packIds.join(",") : undefined,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let { items, nextPageLink } = response.body;
      let stats = [];
      for (let item of items) {
        for (let metric of item.metrics) {
          let stat = {
            ...item,
            ...metric,
          };
          stat.label = `${stat.pack.name} @ ${stat.date}`;
          stat.statsId = `${stat.date}-${stat.pack.id}`;
          stat.pack.packId = stat.pack.id;
          stat.revenueUsd = stat.revenueUsd ? Number(stat.revenueUsd) : undefined;
          stats.push(stat);
        }
      }
      let continuation;
      if (nextPageLink) {
        continuation = { url: nextPageLink };
      }
      return {
        result: stats,
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "version",
      description: "Which version of the Pack to get the source code for.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Html,
  onError: handleError,
  execute: async function (args, context) {
    let [packIdOrUrl, version] = args;
    let packId = getPackId(context, packIdOrUrl);
    if (!version) {
      let versions = await getVersions(context, packId);
      version = versions[0].packVersion;
    }
    let files = await getFiles(context, packId, version);
    if (!files?.length) {
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
