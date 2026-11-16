import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

const OneDaySecs = 24 * 60 * 60;
const DefaultColumnTypeOptions: string[] = [
  "name",
  "percentBlank",
  "formula",
];

pack.addNetworkDomain("mockaroo.com");

pack.setUserAuthentication({
  type: sdk.AuthenticationType.QueryParamToken,
  paramName: "key",
  instructionsUrl: "https://mockaroo.com/docs#:~:text=in%20the%20header.-,Gaining%20Access,-Both%20APIs%20require",
});

pack.addDynamicSyncTable({
  name: "MockData",
  identityName: "MockData",
  listDynamicUrls: async function (context) {
    let url = sdk.withQueryParams("https://mockaroo.com/", {
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
    let properties: sdk.ObjectSchemaProperties = {
      rowId: { type: sdk.ValueType.String },
    };
    let featuredProperties = [];
    for (let column of columns) {
      let prop = getColumnSchema(column.type);
      prop.fixedId = column.name;
      prop.displayName = column.name;
      properties[column.name] = prop;
      featuredProperties.push(column.name);
    }
    let idProperty = "rowId";
    let displayProperty = "rowId";
    return sdk.makeObjectSchema({
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
      sdk.makeParameter({
        type: sdk.ParameterType.StringArray,
        name: "columns",
        description: [
          "The columns to generate. Select from the supported column types, ",
          "or to specify more otions use a formula specifying a List() of the ",
          "MockColumn().",
        ].join(""),
        autocomplete: autocompleteColumnTypes,
      }),
      sdk.makeParameter({
        type: sdk.ParameterType.Number,
        name: "numRows",
        description: "How many rows to generate.",
        suggestedValue: 10,
      }),
    ],
    execute: async function (args, context) {
      let [rawColumns, numRows] = args;
      let start = context.sync.continuation?.start as number || 0;
      let count = Math.min(1000, numRows - start);

      let baseUrl = "https://api.mockaroo.com/api/generate.json";
      let url = sdk.withQueryParams(baseUrl, {
        count,
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
        for (let item of items) {
          item.rowId += start;
        }
        start += count;
        let continuation;
        if (start < numRows) {
          continuation = { start };
        }
        return {
          result: items,
          continuation,
        };
      } catch (e) {
        if (e?.body?.error) {
          throw new sdk.UserVisibleError(e.body.error);
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
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "type",
      description: "The type of data to generate in the column.",
      autocomplete: autocompleteColumnTypes,
    }),
  ],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "option",
      description: "The column option to set.",
      autocomplete: autocompleteColumnTypeParameters,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "value",
      description: "The value of the option.",
      autocomplete: autocompleteColumnTypeParameterValues,
    }),
  ],
  resultType: sdk.ValueType.String,
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

function getColumnSchema(columnType: string): sdk.Schema & sdk.ObjectSchemaProperty {
  switch (columnType) {
    case "Airport Elevation (Feet)":
    case "Airport Latitude":
    case "Airport Longitude":
    case "Car Model Year":
    case "Number":
      return { type: sdk.ValueType.Number };
      break;
    case "Boolean":
      return { type: sdk.ValueType.Boolean };
      break;
    case "Avatar":
    case "Base64 Image URL":
    case "Dummy Image URL":
      return {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.ImageReference,
      };
      break;
    case "Datetime":
      return {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.DateTime,
      };
      break;
    case "Time":
      return {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.Time,
      };
      break;
    case "Email Address":
      return {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.Email,
      };
      break;
    case "URL":
      return {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.Url,
        display: sdk.LinkDisplayType.Url,
      };
      break;
    default:
      return { type: sdk.ValueType.String };
  }
}

async function getColumnTypes(context: sdk.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.mockaroo.com/api/types",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.types;
}

async function getColumnType(context: sdk.ExecutionContext, type: string) {
  let types = await getColumnTypes(context);
  let definition = types.find(t => t.name == type);
  if (!definition) {
    throw new sdk.UserVisibleError(`Invalid column type: ${type}`);
  }
  return definition;
}

async function autocompleteColumnTypes(context: sdk.ExecutionContext,
  search: string) {
  let types = await getColumnTypes(context);
  return sdk.autocompleteSearchObjects(search, types, "name", "name");
}

async function autocompleteColumnTypeParameters(context: sdk.ExecutionContext,
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
  context: sdk.ExecutionContext, search: string, args: Record<string, any>) {
  let type = args.type;
  let option = args.option;
  let definition = await getColumnType(context, type);
  let parameter = definition.parameters?.find(
    parameter => parameter.name == option);
  if (!parameter) {
    throw new sdk.UserVisibleError(`Invalid option: ${option}`);
  }
  if (!parameter.values) return;
  return parameter.values;
}
