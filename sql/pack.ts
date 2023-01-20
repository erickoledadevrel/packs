import * as coda from "@codahq/packs-sdk";
import { ShortCacheTimeSecs, LongCacheTimeSecs } from "./constants";
import { getTables, doQuery, parseLoad, prepareSpecs, createTables, validateQuery, base64Encode } from "./helpers";
const initSqlJs = require('sql.js/dist/sql-asm.js');

export const pack = coda.newPack();

const LoadParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "load",
  description: "The tables to load. For each table pass either its name, ID, or URL, or use the LoadTable formula to load a table from another doc.",
  autocomplete: async function (context, search) {
    let tables = await getTables(context.fetcher, context.invocationLocation.docId);
    return coda.autocompleteSearchObjects(search, tables, "name", "name");
  },
});

const QueryParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "query",
  description: "The SQL query to run. It must be compatible with the SQLite syntax (https://www.sqlite.org/lang.html).",
});

const ValuesParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "values",
  description: "Optional values to bind to the query. Use the placeholder '?' in you query where you want a value inserted. Put a number after the question mark to refer to a value by index (starting at 1).",
  optional: true,
});

const RowSchema = coda.makeObjectSchema({
  properties: {
    "$index": { type: coda.ValueType.Number },
  },
  displayProperty: "$index",
  idProperty: "$index",
});

pack.addNetworkDomain("coda.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
});

pack.addFormula({
  name: "QueryAsLists",
  description: "Run a SQL query and return the values as a list of lists.",
  parameters: [LoadParam, QueryParam, ValuesParam],
  resultType: coda.ValueType.Array,
  items: {
    type: coda.ValueType.Array,
    items: { type: coda.ValueType.String },
  },
  cacheTtlSecs: ShortCacheTimeSecs,
  examples: [
    {
      params: ["People", `SELECT "First Name", Age FROM People`],
      result: [
        ["Alice", 25],
        ["Bob", 35],
      ],
    },
  ],
  execute: async function (args, context) {
    let [load, query, values] = args;
    let rows = await doQuery(context, {load, query, values, asObject: false});
    rows = rows.map(row => row.map(val => String(val)));
    return rows;
  },
});

pack.addFormula({
  name: "QueryAsJSON",
  description: "Run a SQL query and return the values as JSON.",
  parameters: [LoadParam, QueryParam, ValuesParam],
  resultType: coda.ValueType.String,
  cacheTtlSecs: ShortCacheTimeSecs,
  examples: [
    {
      params: ["People", `SELECT "First Name", Age FROM People`],
      result: JSON.stringify([
        {
          "First Name": "Alice",
          "Age": 25,
        },
        {
          "First Name": "Bob",
          "Age": 35,
        },
      ], null, 2),
    },
  ],
  execute: async function (args, context) {
    let [load, query, values] = args;
    let rows = await doQuery(context, {load, query, values, asObject: true});
    return JSON.stringify(rows, null, 2);
  },
});

pack.addDynamicSyncTable({
  name: "Query",
  description: "Run a SQL query and return the values as a table.",
  identityName: "Row",
  listDynamicUrls: async function () {
    let dynmaicUrl = Math.random().toString(36).substring(2);
    return [
      { display: "New query", value: dynmaicUrl },
    ];
  },
  getName: async function () {
    return "Query";
  },
  getDisplayUrl: async function () {
    return "https://coda.io";
  },
  getSchema: async function (context, _, args) {
    let { load, query, values } = args;

    let SQL = await initSqlJs();
    let db = new SQL.Database();

    if (load) {
      let specs = parseLoad(load);
      await prepareSpecs(context, specs);
      await createTables(db, context, specs);
    }

    let properties: coda.ObjectSchemaProperties = {
      ...RowSchema.properties,
    }

    if (query) {
      let statement = validateQuery(db, query, values);
      let columns = statement.getColumnNames();
      for (let column of columns) {
        properties[column] = { type: coda.ValueType.String };
      }
    }
    return coda.makeObjectSchema({
      ...RowSchema,
      properties,
    });
  },
  formula: {
    name: "RunQuery",
    description: "Run the query",
    parameters: [LoadParam, QueryParam, ValuesParam],
    execute: async function (args, context) {
      let [load, query, values] = args;
      let rows = await doQuery(context, {load, query, values, asObject: true});
      for (let [i, row] of rows.entries()) {
        row["$index"] = i + 1;
      }
      return {
        result: rows,
      };
    },
  },
});
