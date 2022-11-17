import * as coda from "@codahq/packs-sdk";
const initSqlJs = require('sql.js/dist/sql-asm.js');

export const pack = coda.newPack();

pack.addNetworkDomain("coda.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
});

pack.addFormula({
  name: "Query",
  description: "",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "docId",
      description: "",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "table",
      description: "",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "query",
      description: "",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function (args, context) {
    let [doc, table, query] = args;
    let SQL = await initSqlJs();
    let db = new SQL.Database();
    await createTables(db, context, [{ doc, table }]);
    let result = db.exec(query);
    return JSON.stringify(result, null, 2);
  },
});

const RowSchema = coda.makeObjectSchema({
  properties: {
    index: { type: coda.ValueType.Number },
  },
  displayProperty: "index",
  idProperty: "index",
});

pack.addFormula({
  name: "LoadTables",
  description: "TODO: Loads table.",
  parameters: [],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "doc",
      description: "The document URL or ID containing a table to load. Leave blank to use the current document.",
      suggestedValue: "",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "table",
      description: "The table name or ID to load.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "destination",
      description: "The name of the SQL table to load the data into. Leave blank to use the same name as the source table.",
      suggestedValue: "",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function (args, context) {
    let [...rest] = args;
    let result = [];
    while (rest.length > 0) {
      let doc, table, destination;
      [doc, table, destination, ...rest] = rest;
      result.push({doc, table, destination});
    }
    return JSON.stringify(result);
  },
});

pack.addDynamicSyncTable({
  name: "Query",
  description: "",
  identityName: "Row",
  listDynamicUrls: async function () {
    return [
      { display: "New query", value: Math.random().toString(36).substring(2) }
    ];
  },
  getName: async function () {
    return "Query";
  },
  getDisplayUrl: async function () {
    return "";
  },
  getSchema: async function (context, _, args) {
    let {load, query} = args;
    let SQL = await initSqlJs();
    let db = new SQL.Database();

    if (load) {
      let specs = JSON.parse(load) as LoadTableSpec[];
      await prepareSpecs(context, specs);
      await createTables(db, context, specs);
    }

    let properties: coda.ObjectSchemaProperties = {
      ...RowSchema.properties,
    }

    if (query) {
      let statement = db.prepare(query);
      statement.step();
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
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "load",
        description: "TODO: The tables to load.",
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "query",
        description: "The SQL query to run",
      }),
    ],
    execute: async function (args, context) {
      let [load, query] = args;
      let SQL = await initSqlJs();
      let db = new SQL.Database();

      if (load) {
        let specs = JSON.parse(load) as LoadTableSpec[];
        await prepareSpecs(context, specs);
        await createTables(db, context, specs);
        // Validate query.
        //db.run(query);
        await Promise.all(specs.map(spec => loadRows(db, context, spec)));
      }

      let statement = db.prepare(query);
      let index = 1;
      let rows = [];
      while (statement.step()) {
        let row = statement.getAsObject();
        row.index = index;
        rows.push(row);
        index++;
      }
      return {
        result: rows,
      };
    },
  },
});

async function prepareSpecs(context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  for (let spec of specs) {
    if (!spec.doc) {
      spec.doc = context.invocationLocation.docId;
    }
  }

  let names = await Promise.all(specs.map(spec => getName(context.fetcher, spec.doc, spec.table)))

  for (let [i, spec] of specs.entries()) {
    if (!spec.destination) {
      spec.destination = names[i];
    }
  }
}

async function createTables(db, context: coda.ExecutionContext, specs: LoadTableSpec[]) {
  let statements = [];
  
  for (let {doc, table, destination} of specs) {
    let columns = await getColumns(context.fetcher, doc, table);
    let sqlColumns = columns.map(column => `[${column.name}] TEXT`);
    statements.push(`CREATE TABLE [${destination}] (${sqlColumns.join(", ")});`);
  }
  
  let statement = statements.join("\n");
  console.log(statement);
  db.run(statement);
}

async function loadRows(db, context: coda.ExecutionContext, spec: LoadTableSpec) {
  let statements = [];
  let {doc, table, destination} = spec;

  let [columns, rows] = await Promise.all([
    getColumns(context.fetcher, doc, table),
    getRows(context.fetcher, doc, table),
  ]);
  for (let row of rows) {
    let values = row.values;
    let sqlValues = columns.map(column => JSON.stringify(values[column.id]));
    statements.push(`INSERT INTO ${destination} VALUES (${sqlValues.join(", ")});`);
  }

  let statement = statements.join("\n");
  console.log(statement);
  db.run(statement);
}

async function getName(fetcher: coda.Fetcher, docId: string, table: string): Promise<string> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables/${table}`,
  });
  return response.body.name;
}

async function getColumns(fetcher: coda.Fetcher, docId: string, table: string): Promise<any[]> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables/${table}/columns`,
  });
  return response.body.items;
}

async function getRows(fetcher: coda.Fetcher, docId: string, table: string): Promise<any[]> {
  let response = await fetcher.fetch({
    method: "GET",
    url: `https://coda.io/apis/v1/docs/${docId}/tables/${table}/rows`,
  });
  return response.body.items;
}

interface LoadTableSpec {
  doc?: string;
  table: string;
  destination?: string;
  columns?: any[],
}