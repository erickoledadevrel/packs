import * as coda from "@codahq/packs-sdk";
import { MaxRowCount, ShortCacheTimeSecs, RowPageSize } from "./constants";
import { LoadTableSpec, QueryOptions } from "./types";
const initSqlJs = require('sql.js/dist/sql-asm.js');

const TableSpecRegex = /^\s*(.+?)(?:\s*@\s*(.+?))?(?:\s*=>\s*(.+?))?\s*$/;

export async function doQuery(context: coda.ExecutionContext, options: QueryOptions) {
  let { load, query, values, asObject } = options;
  if (!query) {
    throw new coda.UserVisibleError("No query provided.");
  }

  let SQL = await initSqlJs();
  let db = new SQL.Database();

  let specs;
  if (load) {
    specs = load.map(spec => parseSpec(spec));
    await prepareSpecs(context, specs);
    await createTables(db, context, specs);
  }

  // Validate query.
  validateQuery(db, query, values);

  if (load) {
    await Promise.all(specs.map(spec => loadRows(db, context, spec, options)));
  }

  let statement = db.prepare(query, values);
  let rows = [];
  while (statement.step()) {
    let row = asObject ? statement.getAsObject() : statement.get();
    rows.push(row);
  }
  return rows;
}

export function validateQuery(db, query, values: string[]) {
  try {
    let statement = db.prepare(query, values);
    statement.step();
    return statement;
  } catch (e) {
    throw new coda.UserVisibleError(`Invalid query: ${e}`);
  }
}

export function parseSpec(spec: string): LoadTableSpec {
  let match = spec.match(TableSpecRegex);
  if (!match) {
    throw new coda.UserVisibleError(`Invalid table specification: ${spec}`);
  }
  let result: LoadTableSpec = {
    table: match[1],
    doc: match[2],
    destination: match[3],
  }
  return result;
}

export async function prepareSpecs(context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  for (let spec of specs) {
    if (!spec.doc) {
      spec.doc = context.invocationLocation.docId;
    }
  }

  let tables = await Promise.all(specs.map(spec => getTable(context.fetcher, spec.doc, spec.table)));
  let rowCount = tables.reduce((result, table) => result + table.rowCount, 0);
  if (rowCount > MaxRowCount) {
    throw new coda.UserVisibleError(`Attempting to load ${rowCount} rows, which is greater than the max of ${MaxRowCount}.`);
  }

  for (let [i, spec] of specs.entries()) {
    if (!spec.destination) {
      spec.destination = tables[i].name;
    }
  }
}

export async function createTables(db, context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  let statements = [];

  for (let { doc, table, destination } of specs) {
    let columns = await getColumns(context.fetcher, doc, table);
    let sqlColumns = columns.map(column => {
      return `[${column.name}] ${getColumnType(column)}`;
    }).concat([
      `[_id] TEXT PRIMARY KEY`,
      `[_display] TEXT`,
    ]);
    statements.push(`CREATE TABLE [${destination}] (${sqlColumns.join(", ")});`);
  }

  let statement = statements.join("\n");
  db.run(statement);
}

async function loadRows(db, context: coda.ExecutionContext, spec: LoadTableSpec, options: QueryOptions) {
  let { doc, table, destination } = spec;

  let [columns, rows, richRows] = await Promise.all([
    getColumns(context.fetcher, doc, table),
    getRows(context.fetcher, doc, table),
    options.useRowIds ? getRows(context.fetcher, doc, table, true) : Promise.resolve([]),
  ]);

  for (let [i, row] of rows.entries()) {
    let values = row.values;
    let richValues = richRows[i]?.values;
    let sqlValues = columns.map(column => {
      let value = values[column.id];
      let richValue = richValues?.[column.id];
      return formatValue(column, value, richValue, options);
    }).concat([
      row.id,
      row.name,
    ]);
    let placeholders = sqlValues.map(_ => "?").join(", ");
    let statement = db.prepare(`INSERT INTO \`${destination}\` VALUES (${placeholders});`);
    statement.run(sqlValues);
  }
}

function getColumnType(column): string {
  switch (column.format.type) {
    case "number":
    case "percent":
    case "currency":
    case "slider":
    case "scale":
      return "NUMERIC";
    case "checkbox":
      return "NUMERIC";
    default:
      return "TEXT";
  }
}

function formatValue(column: any, value: any, richValue: any, options: QueryOptions) {
  if (value == null || value == undefined) {
    return null;
  }
  switch (column.format.type) {
    case "lookup":
      return options.useRowIds ? richValue.rowId ?? null : value;
    case "percent":
      return Number(value.replace(/[^\d.]/g, "")) / 100;
    case "currency":
      return Number(value.replace(/[^\d.]/g, ""));
    case "checkbox":
      return Number(value);
    default:
      return value;
  }
}

async function getTable(fetcher: coda.Fetcher, docId: string, table: string): Promise<any> {
  try {
    let response = await fetcher.fetch({
      method: "GET",
      url: `https://coda.io/apis/v1/docs/${docId}/tables/${table}`,
      cacheTtlSecs: ShortCacheTimeSecs,
    });
    return response.body;
  } catch (e) {
    if (e?.statusCode == 404) {
      throw new coda.UserVisibleError(`Table "${table}" not found in doc "${docId}".`);
    }
    throw e;
  }
}

async function getColumns(fetcher: coda.Fetcher, docId: string, table: string): Promise<any[]> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables/${table}/columns`,
    cacheTtlSecs: ShortCacheTimeSecs,
  });
  return response.body.items;
}

async function getRows(fetcher: coda.Fetcher, docId: string, table: string, rich = false): Promise<any[]> {
  let result = [];
  let url = coda.withQueryParams(`https://coda.io/apis/v1/docs/${docId}/tables/${table}/rows`, {
    valueFormat: rich ? "rich" : "simple",
    limit: RowPageSize,
  });
  do {
    let response = await fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: ShortCacheTimeSecs,
    });
    let items = response.body.items;
    result = result.concat(items);
    url = response.body.nextPageLink;
  } while (url);
  return result;
}

export async function getTables(fetcher: coda.Fetcher, docId: string): Promise<any[]> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables`,
    cacheTtlSecs: ShortCacheTimeSecs,
  });
  return response.body.items;
}
