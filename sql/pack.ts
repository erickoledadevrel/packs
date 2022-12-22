import * as coda from "@codahq/packs-sdk";
const initSqlJs = require('sql.js/dist/sql-asm.js');

export const pack = coda.newPack();

// TODO: Remove.
const DefaultDocId = "S3wDH8K0b1";

const MaxRowCount = 10000;
const RowPageSize = 500;
const ShortCacheTimeSecs = 60;
const LongCacheTimeSecs = 24 * 60 * 60;

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
  description: "",
  parameters: [LoadParam, QueryParam, ValuesParam],
  resultType: coda.ValueType.Array,
  items: {
    type: coda.ValueType.Array,
    items: { type: coda.ValueType.String },
  },
  cacheTtlSecs: ShortCacheTimeSecs,
  execute: async function (args, context) {
    let [load, query, values] = args;
    let rows = await doQuery(context, {load, query, values, asObject: false});
    rows = rows.map(row => row.map(val => String(val)));
    return rows;
  },
});

pack.addFormula({
  name: "QueryAsJSON",
  description: "",
  parameters: [LoadParam, QueryParam, ValuesParam],
  resultType: coda.ValueType.String,
  cacheTtlSecs: ShortCacheTimeSecs,
  execute: async function (args, context) {
    let [load, query, values] = args;
    let rows = await doQuery(context, {load, query, values, asObject: true});
    return JSON.stringify(rows, null, 2);
  },
});

pack.addDynamicSyncTable({
  name: "Query",
  description: "TODO: Description.",
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
    // TODO: Better URL
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

pack.addFormula({
  name: "LoadTable",
  description: "TODO: Loads table.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "table",
      description: "The table name or ID to load.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "doc",
      description: "The document URL or ID containing a table to load. Default: the current document.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "destination",
      description: "The name of the SQL table to load the data into. Default: the same name as the source table.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: LongCacheTimeSecs,
  execute: async function (args, context) {
    let [table, doc, destination] = args;
    return base64Encode(JSON.stringify({ table, doc, destination }));
  },
});

interface QueryOptions {
  load: string[];
  query: string;
  values?: string[];
  asObject: boolean;
}

async function doQuery(context: coda.ExecutionContext, options: QueryOptions) {
  let {load, query, values, asObject} = options;
  if (!query) {
    throw new coda.UserVisibleError("No query provided.");
  }

  let SQL = await initSqlJs();
  let db = new SQL.Database();

  let specs;
  if (load) {
    specs = parseLoad(load);
    await prepareSpecs(context, specs);
    await createTables(db, context, specs);
  }

  // Validate query.
  validateQuery(db, query, values);

  if (load) {
    await Promise.all(specs.map(spec => loadRows(db, context, spec)));
  }

  let statement = db.prepare(query, values);
  let rows = [];
  while (statement.step()) {
    let row = asObject ? statement.getAsObject() : statement.get();
    rows.push(row);
  }
  return rows;
}

function validateQuery(db, query, values: string[]) {
  try {
    let statement = db.prepare(query, values);
    statement.step();
    return statement;
  } catch (e) {
    throw new coda.UserVisibleError(`Invalid query: ${e}`);
  }
}

function parseLoad(load: string[]): LoadTableSpec[] {
  return load.map(entry => {
    try {
      let decoded = base64Dencode(entry);
      return JSON.parse(decoded);
    } catch (e) { }
    return { table: entry };
  });
}

async function prepareSpecs(context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  for (let spec of specs) {
    if (!spec.doc) {
      spec.doc = context.invocationLocation.docId ?? DefaultDocId;
    }
  }

  let tables = await Promise.all(specs.map(spec => getTable(context.fetcher, spec.doc, spec.table)));
  let rowCount = tables.reduce((result, table) => result + table.rowCount, 0);
  if (rowCount > MaxRowCount) {
    throw new coda.UserVisibleError(`Attempting to load ${rowCount} rows, which is greater than the max of ${MaxRowCount}.`)
  }

  for (let [i, spec] of specs.entries()) {
    if (!spec.destination) {
      spec.destination = tables[i].name;
    }
  }
}

async function createTables(db, context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  let statements = [];

  for (let { doc, table, destination } of specs) {
    let columns = await getColumns(context.fetcher, doc, table);
    let sqlColumns = columns.map(column => {
      return `[${column.name}] ${getColumnType(column)}`
    });
    statements.push(`CREATE TABLE [${destination}] (${sqlColumns.join(", ")});`);
  }

  let statement = statements.join("\n");
  console.log(statement);
  db.run(statement);
}

async function loadRows(db, context: coda.ExecutionContext, spec: LoadTableSpec) {
  let { doc, table, destination } = spec;

  let [columns, rows] = await Promise.all([
    getColumns(context.fetcher, doc, table),
    getRows(context.fetcher, doc, table),
  ]);
  for (let row of rows) {
    let values = row.values;
    let sqlValues = columns.map(column => {
      let value = values[column.id];
      return formatValue(column, value);
    });
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

function formatValue(column, value) {
  if (value == null || value == undefined) {
    return null;
  }
  switch (column.format.type) {
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

async function getRows(fetcher: coda.Fetcher, docId: string, table: string): Promise<any[]> {
  let result = [];
  let url = coda.withQueryParams(`https://coda.io/apis/v1/docs/${docId}/tables/${table}/rows`, {
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
    console.log(`Loaded ${items?.length ?? 0} items.`);
    url = response.body.nextPageLink;
  } while (url);
  return result;
}

async function getTables(fetcher: coda.Fetcher, docId: string): Promise<any[]> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables`,
    cacheTtlSecs: ShortCacheTimeSecs,
  });
  return response.body.items;
}

function base64Encode(value: string): string {
  return Buffer.from(value).toString("base64");
}

function base64Dencode(value: string): string {
  return Buffer.from(value, "base64").toString();
}

interface LoadTableSpec {
  doc?: string;
  table: string;
  destination?: string;
  columns?: any[],
}
