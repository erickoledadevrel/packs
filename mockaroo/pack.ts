import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;
const DefaultColumnTypeOptions: string[] = [
  "name",
  "percentBlank",
  "formula",
];

pack.addNetworkDomain("mockaroo.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.QueryParamToken,
  paramName: "key",
  instructionsUrl: "https://mockaroo.com/docs#:~:text=in%20the%20header.-,Gaining%20Access,-Both%20APIs%20require",
});

pack.addDynamicSyncTable({
  name: "MockData",
  identityName: "MockData",
  listDynamicUrls: async function (context) {
    let url = coda.withQueryParams("https://mockaroo.com/", {
      id: Math.random().toString(36).split(".")[1],
    })
    return [{ display: "New Table", value: url }];
  },
  getName: async function (context) {
    return "Mock Data";
  },
  getSchema: async function (context, _, args) {
    let rawColumns = args.columns || [];
    let columns = rawColumns.map(column => parseColumn(column));
    let properties: coda.ObjectSchemaProperties = {
      rowId: { type: coda.ValueType.String },
    };
    let featuredProperties = [];
    for (let column of columns) {
      properties[column.name] = getColumnSchema(column.type);
      featuredProperties.push(column.name);
    }
    let idProperty = "rowId";
    let displayProperty = "rowId";
    return coda.makeObjectSchema({
      properties: properties,
      idProperty: idProperty,
      displayProperty: displayProperty,
      featuredProperties: featuredProperties,
    });
  },
  getDisplayUrl: async function (context) {
    return "https://mockaroo.com/";
  },
  formula: {
    name: "SyncMockData",
    description: "Syncs the mock data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "columns",
        description: [
          "The columns to generate. Select from the supported column types, ",
          "or to specify more otions use a formula specifying a List() of the ",
          "MockColumn().",
        ].join(""),
        autocomplete: autocompleteColumnTypes,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Number,
        name: "numRows",
        description: "How many rows to generate.",
        suggestedValue: 10,
      }),
    ],
    execute: async function (args, context) {
      let [rawColumns, numRows] = args;
      let baseUrl = "https://api.mockaroo.com/api/generate.json";
      let url = coda.withQueryParams(baseUrl, {
        count: numRows,
      });
      let columns = rawColumns.map(column => parseColumn(column));
      columns.push({
        name: "rowId",
        type: "Row Number",
      });
      try {
        let response = await context.fetcher.fetch({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(columns),
        });
        let items = response.body;
        return {
          result: items,
        };
      } catch (e) {
        if (e?.body?.error) {
          throw new coda.UserVisibleError(e.body.error);
        }
        throw e;
      }
    },
  },
});

pack.addFormula({
  name: "MockColumn",
  description: [
    "Define a column of mock data to generate. Use in place of a column type ",
    "string when you want to specify advanced options."
  ].join(""),
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "type",
      description: "The type of data to generate in the column.",
      autocomplete: autocompleteColumnTypes,
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "option",
      description: "The column option to set.",
      autocomplete: autocompleteColumnTypeParameters,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value of the option.",
      autocomplete: autocompleteColumnTypeParameterValues,
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function (args, context) {
    let [type, ...rest] = args;
    let result: Record<string, any> = {
      type: type,
    };
    while (rest.length > 0) {
      let option, value;
      [option, value, ...rest] = rest;
      result[option] = value;
    }
    if (!result.name) {
      result.name = type;
    }
    return JSON.stringify(result);
  },
});

function parseColumn(column: string): any {
  try {
    return JSON.parse(column);
  } catch {
    return {
      type: column,
      name: column,
    };
  }
}

function getColumnSchema(columnType: string): coda.Schema {
  switch (columnType) {
    case "Airport Elevation (Feet)":
    case "Airport Latitude":
    case "Airport Longitude":
    case "Car Model Year":
    case "Number":
      return { type: coda.ValueType.Number };
      break;
    case "Boolean":
      return { type: coda.ValueType.Boolean };
      break;
    case "Avatar":
    case "Base64 Image URL":
    case "Dummy Image URL":
      return {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.ImageReference,
      };
      break;
    case "Datetime":
      return {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.DateTime,
      };
      break;
    case "Time":
      return {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Time,
      };
      break;
    case "Email Address":
      return {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Email,
      };
      break;
    case "URL":
      return {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Url,
        display: coda.LinkDisplayType.Url,
      };
      break;
    default:
      return { type: coda.ValueType.String };
  }
}

async function getColumnTypes(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.mockaroo.com/api/types",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.types;
}

async function getColumnType(context: coda.ExecutionContext, type: string) {
  let types = await getColumnTypes(context);
  let definition = types.find(t => t.name == type);
  if (!definition) {
    throw new coda.UserVisibleError(`Invalid column type: ${type}`);
  }
  return definition;
}

async function autocompleteColumnTypes(context: coda.ExecutionContext,
  search: string) {
  let types = await getColumnTypes(context);
  return coda.autocompleteSearchObjects(search, types, "name", "name");
}

async function autocompleteColumnTypeParameters(context: coda.ExecutionContext,
  search: string, args: Record<string, any>) {
  let options = [...DefaultColumnTypeOptions];
  let type = args.type;
  let definition = await getColumnType(context, type);
  if (definition.parameters) {
    for (let parameter of definition.parameters) {
      options.push(parameter.name);
    }
  }
  return options;
}

async function autocompleteColumnTypeParameterValues(
  context: coda.ExecutionContext, search: string, args: Record<string, any>) {
  let type = args.type;
  let option = args.option;
  let definition = await getColumnType(context, type);
  let parameter = definition.parameters?.find(
    parameter => parameter.name == option);
  if (!parameter) {
    throw new coda.UserVisibleError(`Invalid option: ${option}`);
  }
  if (!parameter.values) return;
  return parameter.values;
}
