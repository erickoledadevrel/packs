import * as coda from "@codahq/packs-sdk";
const RegexEscape = require("regex-escape");

export const pack = coda.newPack();

const Keyword = "Glossary";
const ErrorEndpoint = "https://coda.io/error";

const TermSchema = coda.makeObjectSchema({
  properties: {
    term: { type: coda.ValueType.String },
    definition: { type: coda.ValueType.String },
  },
  displayProperty: "term",
});

pack.addFormula({
  name: "Term",
  description: "Look up a term in the glossary.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "term",
      description: "The glosssary term to lookup.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: TermSchema,
  execute: async function (args, context) {
    let [term] = args;
    if (!term) {
      throw new coda.UserVisibleError("Term must not be empty.");
    }

    let key = term.trim().toLowerCase();
    let dictionary = await getGlossary(context);
    if (!dictionary[key]) {
      throw new coda.UserVisibleError(`Unknown term: ${term}`);
    }
    return dictionary[key];
  },
});

pack.addFormula({
  name: "Terms",
  description: "Identifies glossary terms in a piece of text.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to scan.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: TermSchema,
  execute: async function (args, context) {
    let [text] = args;
    text = text.toLocaleLowerCase();
    let dictionary = await getGlossary(context);
    let result = [];
    for (let key of Object.keys(dictionary)) {
      let regex = getRegex(key);
      if (text.match(regex)) {
        result.push(dictionary[key]);
      }
    }
    return result;
  },
});

pack.addFormula({
  name: "AddTerm",
  description: "Adds a term to the glossary",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "term",
      description: "The term to add.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "definition",
      description: "The definition of the term.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [term, definition] = args;
    if (!term) {
      throw new coda.UserVisibleError("Term must not be empty.");
    }
    if (!definition) {
      throw new coda.UserVisibleError("Definition must not be empty.");
    }

    let columns = await getColumns(context);
    if (columns.length < 2) {
      throw new coda.UserVisibleError("The glossary table must have at least two columns.");
    }

    let baseUrl = context.endpoint.split("#")[0];
    let url = coda.joinUrl(baseUrl, "/rows");
    await context.fetcher.fetch({
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: [
          {
            cells: [
              {
                column: columns[0].id,
                value: term,
              },
              {
                column: columns[1].id,
                value: definition,
              },
            ],
          },
        ],
        keyColumns: [columns[0].id],
      }),
    });
    return "Done";
  },
});

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  postSetup: [
    {
      type: coda.PostSetupType.SetEndpoint,
      name: "SelectGlossary",
      description: "Select a glossary:",
      getOptions: async function (context) {
        let glossaries = await getGlossaries(context);
        if (glossaries.length == 0) {
          return [{
            display: "No glossaries found",
            value: ErrorEndpoint,
          }];
        }
        return glossaries.map(result => {
          let name = `${result.doc.name} - ${result.table.name}`;
          return {
            display: name,
            value: `${result.table.href}#${name}`,
          };
        });
      },
    }
  ],
  getConnectionName: async function (context) {
    if (!context.endpoint || context.endpoint == ErrorEndpoint) {
      return "Invalid glossary";
    }
    return context.endpoint.split("#")[1];
  }
});

function getRegex(key: string): RegExp {
  let matcher = RegexEscape(key);
  if (key[0].match(/\w/)) {
    matcher = "\\b" + matcher;
  }
  if (key[key.length - 1].match(/\w/)) {
    matcher = matcher + "\\b";
  }
  return new RegExp(matcher);
}

async function getGlossary(context: coda.ExecutionContext) {
  if (context.endpoint == ErrorEndpoint) {
    throw new coda.UserVisibleError("Invalid glossary.");
  }
  let [rows, columns] = await Promise.all([
    getRows(context),
    getColumns(context),
  ]);
  if (columns.length < 2) {
    throw new coda.UserVisibleError("The glossary table must have at least two columns.");
  }
  let termColumnId = columns[0].id;
  let definitionColumnId = columns[1].id;
  return rows.reduce((result, row) => {
    let term = row.values[termColumnId];
    let definition = row.values[definitionColumnId];
    result[term.toLowerCase()] = { term, definition };
    return result;
  }, {});
}

async function getRows(context: coda.ExecutionContext) {
  let baseUrl = context.endpoint.split("#")[0];
  let url = coda.withQueryParams(coda.joinUrl(baseUrl, "/rows"), {
    limit: 100,
  });
  let result = [];
  do {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    result = result.concat(response.body.items);
    url = response.body.nextPageLink;
  } while (url);
  return result;
}

async function getColumns(context: coda.ExecutionContext) {
  let baseUrl = context.endpoint.split("#")[0];
  let url = coda.withQueryParams(coda.joinUrl(baseUrl, "/columns"), {
    visibleOnly: true,
    limit: 100,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body.items;
}

async function getGlossaries(context: coda.ExecutionContext) {
  let docs = await getGlossaryDocs(context);
  let results = await Promise.all(docs.map(async doc => {
    let tables = await getTables(context, doc);
    tables = tables.filter(table => table.name.toLocaleLowerCase().includes(Keyword.toLocaleLowerCase()));
    return tables.map(table => ({doc, table}));
  }));
  return results.flat();
}

async function getGlossaryDocs(context: coda.ExecutionContext) {
  let url = coda.withQueryParams(
    coda.joinUrl(context.invocationLocation.protocolAndHost, "/apis/v1/docs"),
    { query: Keyword, limit: 100 }
  );
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 0,
  });
  let docs = response.body.items;
  return docs;
}

async function getTables(context: coda.ExecutionContext, doc: any): Promise<any> {
  let url = coda.joinUrl(doc.href, "tables");
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 0,
  });
  return response.body.items;
}

pack.addNetworkDomain("coda.io");
