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
    let [docId, table, query] = args;
    let SQL = await initSqlJs();
    let db = new SQL.Database();
    await createTable(db, context.fetcher, docId, table);
    let result = db.exec(query);
    return JSON.stringify(result, null, 2);
  },
});

async function createTable(db, fetcher: coda.Fetcher, docId: string, table: string) {
  let statements = [];
  
  let columns = await getColumns(fetcher, docId, table);
  let sqlColumns = columns.map(column => `[${column.name}] TEXT`);
  statements.push(`CREATE TABLE ${table} (${sqlColumns.join(", ")});`)

  let rows = await getRows(fetcher, docId, table);
  for (let row of rows) {
    let values = row.values;
    let sqlValues = columns.map(column => JSON.stringify(values[column.id]));
    statements.push(`INSERT INTO ${table} VALUES (${sqlValues.join(", ")});`);
  }

  let statement = statements.join("\n");
  console.log(statement);
  db.run(statement);
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