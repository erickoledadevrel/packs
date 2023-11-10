import * as coda from "@codahq/packs-sdk";
import { getProjectId, randomId, getSchema, formatObjectValue, getHash, maybeParseJsonList } from "./helpers";
import { BigQueryApi } from "./api";
import { BaseQueryRowSchema, RowIdKey, RowIndexKey } from "./schemas";

export const pack = coda.newPack();

const ListProjectsPageSize = 100;
const OneDaySecs = 24 * 60 * 60;

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "profile",
    "https://www.googleapis.com/auth/bigquery.readonly",
    "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
  ],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
  postSetup: [
    {
      type: coda.PostSetupType.SetEndpoint,
      name: "SelectProject",
      description: "Select the Google Cloud Console project to use for queries.",
      getOptions: async function (context) {
        let url = coda.withQueryParams("https://cloudresourcemanager.googleapis.com/v1/projects", {
          filter: "lifecycleState:ACTIVE",
          pageSize: ListProjectsPageSize,
        });
        let response = await context.fetcher.fetch({
          method: "GET",
          url: url,
        });
        let data = response.body;
        return data.projects.map(project => {
          return {
            display: `${project.name} (${project.projectId})`,
            value: `https://www.googleapis.com/#${project.projectId}`,
          };
        });
      },
    },
  ],
  getConnectionName: async function (context) {
    if (!context.endpoint) {
      return "Incomplete";
    }
    let projectId = getProjectId(context);
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://www.googleapis.com/oauth2/v1/userinfo",
      cacheTtlSecs: OneDaySecs,
    });
    let user = response.body;
    return `${projectId} (${user.name})`;
  },
});

pack.addDynamicSyncTable({
  name: "Query",
  description: "Run a query and load the results into a table.",
  identityName: "QueryRow",
  entityName: "Row",
  placeholderSchema: BaseQueryRowSchema,
  listDynamicUrls: async function (context) {
    let queryId = randomId();
    return [
      { display: "New query", value: queryId },
    ];
  },
  getName: async function (context) {
    return "Query results";
  },
  getSchema: async function (context, _, args) {
    let { query, parameters } = args;
    parameters = maybeParseJsonList(parameters);
    if (!query) {
      return BaseQueryRowSchema;
    }
    let helper = new BigQueryApi(context);
    let data = await helper.runQuery(args.query, true, parameters);
    return getSchema(data.schema, BaseQueryRowSchema);
  },
  getDisplayUrl: async function (context) {
    return "https://console.cloud.google.com/bigquery";
  },
  formula: {
    name: "SyncQuery",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "query",
        description: "The query to use (in the Standard SQL dialect).",
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "uniqueColumns",
        description: "Which columns, if their values are combined, will form a unique ID for the row.",
        optional: true,
        autocomplete: async function (context, _, args) {
          let { query } = args;
          if (!query) {
            return [];
          }
          let helper = new BigQueryApi(context);
          let data = await helper.runQuery(args.query, true);
          return data.schema.fields.map(field => field.name);
        }
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "parameters",
        description: "A list of paremeters, for use with parameterized queries. Use the <Type>Parameter formulas to construct the parameters.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [query, uniqueColumns, parameters] = args;
      parameters = maybeParseJsonList(parameters);

      let jobId = context.sync.continuation?.jobId as string;
      let pageToken = context.sync.continuation?.pageToken as string;
      let startRowIndex = context.sync.continuation?.startRowIndex as number ?? 0;

      let bigQuery = new BigQueryApi(context);

      let job;
      if (jobId) {
        job = await bigQuery.getQueryResults(jobId, pageToken);
      } else {
        job = await bigQuery.runQuery(query, false, parameters);
      }
      jobId = job.jobReference.jobId;

      let results = [];
      if (job.jobComplete) {
        let rows = job.rows;
        for (let [i, row] of rows.entries()) {
          let result = formatObjectValue(row, job.schema);
          result[RowIndexKey] = startRowIndex + i;
          if (uniqueColumns) {
            result[RowIdKey] = getHash(JSON.stringify(uniqueColumns.map(col => result[col])));
          } else {
            result[RowIdKey] = result[RowIndexKey];
          }
          results.push(result);
        }
      }

      let continuation;
      if (!job.jobComplete || job.pageToken) {
        continuation = {
          jobId: job.jobReference.jobId,
          pageToken: job.pageToken,
          startRowIndex: startRowIndex + results.length,
        };
      }

      return {
        result: results,
        continuation,
      };
    },
  },
});

pack.addFormula({
  name: "StringParameter",
  description: "Define a string parameter, for use in parameterized queries.",
  parameters: [
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
  execute: async function (args, context) {
    let [name, value] = args;
    let parameter = {
      name,
      parameterType: {type: "STRING"},
      parameterValue: {value},
    };
    return JSON.stringify(parameter);
  },
});
