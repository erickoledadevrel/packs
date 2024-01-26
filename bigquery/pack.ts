import * as coda from "@codahq/packs-sdk";
import { randomId, getSchema, formatObjectValue, getHash, maybeParseJsonList } from "./helpers";
import { BigQueryApi } from "./api";
import { BaseQueryRowSchema, RowIdKey, RowIndexKey } from "./schemas";

export const pack = coda.newPack();

pack.addNetworkDomain("googleapis.com");

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
    let { projectId, query, parameters } = args;
    parameters = maybeParseJsonList(parameters);
    if (!query) {
      return BaseQueryRowSchema;
    }
    let helper = new BigQueryApi(context, projectId);
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
        name: "projectId",
        description: "The ID of the Google Cloud project to bill the queries to.",
      }),
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
          let { projectId, query } = args;
          if (!query) {
            return [];
          }
          let helper = new BigQueryApi(context, projectId);
          let data = await helper.runQuery(args.query, true);
          return data.schema.fields.map(field => field.name);
        }
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "parameters",
        description: "A list of parameters, for use with parameterized queries. Use the <Type>Parameter formulas to construct the parameters.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [projectId, query, uniqueColumns, parameters] = args;
      parameters = maybeParseJsonList(parameters);

      let jobId = context.sync.continuation?.jobId as string;
      let pageToken = context.sync.continuation?.pageToken as string;
      let startRowIndex = context.sync.continuation?.startRowIndex as number ?? 0;

      let bigQuery = new BigQueryApi(context, projectId);

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

pack.addFormula({
  name: "NumberParameter",
  description: "Define a number parameter, for use in parameterized queries.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the parameter.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "value",
      description: "The value of the parameter.",
    }),
  ],
  resultType: coda.ValueType.String,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function (args, context) {
    let [name, value] = args;
    let type = value % 1 === 0 ? "INT64" : "FLOAT64";
    let parameter = {
      name,
      parameterType: {type},
      parameterValue: {value},
    };
    return JSON.stringify(parameter);
  },
});

pack.addFormula({
  name: "BooleanParameter",
  description: "Define a boolean parameter, for use in parameterized queries.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the parameter.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
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
      parameterType: {type: "BOOL"},
      parameterValue: {value},
    };
    return JSON.stringify(parameter);
  },
});
