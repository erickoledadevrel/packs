import * as sdk from "@superhuman/plugins-sdk";
const RegexEscape = require("regex-escape");

export const pack = sdk.newPack();

const Keyword = "Glossary";
const ErrorEndpoint = "https://sdk.io/error";

const TermSchema = sdk.makeObjectSchema({
  properties: {
    term: { type: sdk.ValueType.String },
    definition: { type: sdk.ValueType.String },
    source: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "term",
});

pack.addFormula({
  name: "Term",
  description: "Look up a term in the glossary.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "term",
      description: "The glosssary term to lookup.",
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: TermSchema,
  execute: async function (args, context) {
    let [term] = args;
    if (!term) {
      throw new sdk.UserVisibleError("Term must not be empty.");
    }

    let key = term.trim().toLowerCase();
    let dictionary = await getGlossary(context);
    if (!dictionary[key]) {
      throw new sdk.UserVisibleError(`Unknown term: ${term}`);
    }
    return dictionary[key];
  },
});

pack.addFormula({
  name: "Terms",
  description: "Identifies glossary terms in a piece of text.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "text",
      description: "The text to scan.",
    }),
  ],
  resultType: sdk.ValueType.Array,
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "term",
      description: "The term to add.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "definition",
      description: "The definition of the term.",
    }),
  ],
  resultType: sdk.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [term, definition] = args;
    if (!term) {
      throw new sdk.UserVisibleError("Term must not be empty.");
    }
    if (!definition) {
      throw new sdk.UserVisibleError("Definition must not be empty.");
    }

    let columns = await getColumns(context);
    if (columns.length < 2) {
      throw new sdk.UserVisibleError("The glossary table must have at least two columns.");
    }

    let baseUrl = context.endpoint.split("#")[0];
    let url = sdk.joinUrl(baseUrl, "/rows");
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
  type: sdk.AuthenticationType.CodaApiHeaderBearerToken,
  postSetup: [
    {
      type: sdk.PostSetupType.SetEndpoint,
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

async function getGlossary(context: sdk.ExecutionContext) {
  if (context.endpoint == ErrorEndpoint) {
    throw new sdk.UserVisibleError("Invalid glossary.");
  }
  let [rows, columns] = await Promise.all([
    getRows(context),
    getColumns(context),
  ]);
  if (columns.length < 2) {
    throw new sdk.UserVisibleError("The glossary table must have at least two columns.");
  }
  let termColumnId = columns[0].id;
  let definitionColumnId = columns[1].id;
  return rows.reduce((result, row) => {
    let term = row.values[termColumnId];
    let definition = row.values[definitionColumnId];
    let source = row.browserLink;
    result[term.toLowerCase()] = { term, definition, source };
    return result;
  }, {});
}

async function getRows(context: sdk.ExecutionContext) {
  let baseUrl = context.endpoint.split("#")[0];
  let url = sdk.withQueryParams(sdk.joinUrl(baseUrl, "/rows"), {
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

async function getColumns(context: sdk.ExecutionContext) {
  let baseUrl = context.endpoint.split("#")[0];
  let url = sdk.withQueryParams(sdk.joinUrl(baseUrl, "/columns"), {
    visibleOnly: true,
    limit: 100,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  return response.body.items;
}

async function getGlossaries(context: sdk.ExecutionContext) {
  let docs = await getGlossaryDocs(context);
  let results = await Promise.all(docs.map(async doc => {
    let tables = await getTables(context, doc);
    tables = tables.filter(table => table.name.toLocaleLowerCase().includes(Keyword.toLocaleLowerCase()));
    return tables.map(table => ({doc, table}));
  }));
  return results.flat();
}

async function getGlossaryDocs(context: sdk.ExecutionContext) {
  let url = sdk.withQueryParams(
    sdk.joinUrl(context.invocationLocation.protocolAndHost, "/apis/v1/docs"),
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

async function getTables(context: sdk.ExecutionContext, doc: any): Promise<any> {
  let url = sdk.joinUrl(doc.href, "tables");
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 0,
  });
  return response.body.items;
}

pack.addNetworkDomain("sdk.io");
