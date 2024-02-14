import * as coda from "@codahq/packs-sdk";
import { ShortCacheTimeSecs, LongCacheTimeSecs, DefaultUseRowIds } from "./constants";
import { getTables, doQuery, prepareSpecs, createTables, validateQuery, parseSpec } from "./helpers";
const initSqlJs = require('sql.js/dist/sql-asm.js');

export const pack = coda.newPack();

const LoadParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "load",
  description: `The list of tables to load. For each table pass either its name or ID.
    To load a table from another doc, append the name or ID with an at-sign and the doc ID. Ex: Customers@tD8g6H0zai.
    To set the name of the resulting SQL table, append it with an arrow and the table name. Ex: Customers=>Cust`,
  autocomplete: async function (context, search) {
    let tables = await getTables(context.fetcher, context.invocationLocation.docId);
    return coda.autocompleteSearchObjects(search, tables, "name", "name");
  },
});

const QueryParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "query",
  description: "The SQL query to run. It must be compatible with the SQLite syntax.",
});

const ValuesParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "values",
  description: `Optional values to bind to the query. Use the placeholder '?' in you query where you want a value inserted.
    Put a number after the question mark to refer to a value by index (starting at 1).`,
  optional: true,
});

const UseRowIdsParam = coda.makeParameter({
  type: coda.ParameterType.Boolean,
  name: "useRowIds",
  description: `When loading the value of a Lookup column, store ID of the refernced row instead of the display value. Default: ${DefaultUseRowIds}.`,
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
  name: "QuerySingle",
  description: "Run a SQL query and return a single value (the first column of the first row).",
  parameters: [LoadParam, QueryParam, ValuesParam, UseRowIdsParam],
  resultType: coda.ValueType.String,
  cacheTtlSecs: ShortCacheTimeSecs,
  examples: [
    {
      params: [["People"], `SELECT MAX(Age) FROM People`],
      result: 35,
    },
  ],
  execute: async function (args, context) {
    let [load, query, values, useRowIds=DefaultUseRowIds] = args;
    let rows = await doQuery(context, {load, query, values, useRowIds, asObject: false});
    return rows?.[0]?.[0];
  },
});

pack.addFormula({
  name: "QueryGrid",
  description: "Run a SQL query and return a grid of values (list of lists).",
  parameters: [LoadParam, QueryParam, ValuesParam, UseRowIdsParam],
  resultType: coda.ValueType.Array,
  items: {
    type: coda.ValueType.Array,
    items: { type: coda.ValueType.String },
  },
  cacheTtlSecs: ShortCacheTimeSecs,
  examples: [
    {
      params: [["People"], `SELECT "First Name", Age FROM People`],
      result: [
        ["Alice", 25],
        ["Bob", 35],
      ],
    },
  ],
  execute: async function (args, context) {
    let [load, query, values, useRowIds=DefaultUseRowIds] = args;
    let rows = await doQuery(context, {load, query, values, useRowIds, asObject: false});
    rows = rows.map(row => row.map(val => String(val)));
    return rows;
  },
});

pack.addFormula({
  name: "QueryJSON",
  description: "Run a SQL query and return the values as JSON.",
  parameters: [LoadParam, QueryParam, ValuesParam, UseRowIdsParam],
  resultType: coda.ValueType.String,
  cacheTtlSecs: ShortCacheTimeSecs,
  examples: [
    {
      params: [["People"], `SELECT "First Name", Age FROM People`],
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
    let [load, query, values, useRowIds=DefaultUseRowIds] = args;
    let rows = await doQuery(context, {load, query, values, useRowIds, asObject: true});
    return JSON.stringify(rows, null, 2);
  },
});

pack.addDynamicSyncTable({
  name: "QueryTable",
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
      let specs = load.map(spec => parseSpec(spec));
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
        properties[column] = {
          type: coda.ValueType.String,
          displayName: column,
        };
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
    parameters: [LoadParam, QueryParam, ValuesParam, UseRowIdsParam],
    execute: async function (args, context) {
      let [load, query, values, useRowIds=DefaultUseRowIds] = args;
      let rows = await doQuery(context, {load, query, values, useRowIds, asObject: true});
      for (let [i, row] of rows.entries()) {
        row["$index"] = i + 1;
      }
      return {
        result: rows,
      };
    },
  },
});
