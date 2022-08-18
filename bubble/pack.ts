import * as coda from "@codahq/packs-sdk";
import Url from "url-parse";
import { BaseDataSchema, ConstraintTypes, DataTableIdentityName, DataTypeKey, IgnoreFields, MaxFeatured, MetadataFields, PageSize } from "./constants";
import { getAppId, getDataTypes, getDataUrl, getFields, getPropertySchema, getPropertyValue, parseDataSource, parseField } from "./helpers";

export const pack = coda.newPack();

pack.addNetworkDomain("bubbleapps.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
  requiresEndpointUrl: true,
  endpointDomain: "bubbleapps.io",
  // TODO: instructionsUrl
  getConnectionName: async function (context) {
    let url = new Url(context.endpoint!);
    return url.host.split(".")[0];
  },
})

pack.addDynamicSyncTable({
  name: "Data",
  description: "Sync rows from a Bubble database.",
  identityName: DataTableIdentityName,
  entityName: "Row",
  listDynamicUrls: async function (context, folderUrl) {
    if (!folderUrl) {
      return [
        { display: "Development", value: "dev", hasChildren: true },
        { display: "Live", value: "live", hasChildren: true },
      ];
    }
    let types = await getDataTypes(folderUrl == "live", context);
    return types.map(type => {
      let url = JSON.stringify({
        type: type,
        live: folderUrl == "live",
      });
      return {
        display: type,
        value: url,
      };
    })
  },
  getName: async function (context) {
    return parseDataSource(context.sync!.dynamicUrl!).type;
  },
  getDisplayUrl: async function (context) {
    let appId = getAppId(context.endpoint);
    let datatype = parseDataSource(context.sync!.dynamicUrl!).type;
    return `https://bubble.io/page?id=${appId}&type_id=${datatype}&tab=tabs-3&subtab=App+Data`
  },
  getSchema: async function (context, _, args) {
    let {type: dataType, live} = parseDataSource(context.sync!.dynamicUrl!);

    let schema: coda.GenericObjectSchema = {
      ...BaseDataSchema,
      properties: {
        ...BaseDataSchema.properties,
      },
    };

    let fields = await getFields(dataType, live, context);
    let featured = [];
    for (let key of fields) {
      if (IgnoreFields.includes(key)) {
        continue;
      }
      let definition = parseField(key);
      console.log(`Key: ${key}, Definition: ${JSON.stringify(definition)}`);
      if (!MetadataFields[key]) {
        featured.push(definition.name);
      }
      let propertySchema = getPropertySchema(definition);
      propertySchema.fromKey = key;
      
      schema.properties[definition.name] = propertySchema;
    }
    schema.featuredProperties = featured.sort().slice(0, MaxFeatured);
    
    return schema;
  },
  formula: {
    name: "SyncData",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "constraints",
        description: "Search constraints used to limit the results. Use the Constraints() formula to build this value.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [constraints] = args;
      let {type: dataType, live} = parseDataSource(context.sync!.dynamicUrl!);
      let cursor = context.sync!.continuation?.cursor as number || 0;

      let params: Record<string, any> = {
        limit: PageSize,
        cursor,
        constraints,
      };
      let url = getDataUrl(dataType, live, params)

      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
        cacheTtlSecs: 0,
      });

      // TODO: Handle malformed constraint error.

      let {count, remaining, results: rows} = response.body.response;
      for (let row of rows) {
        for (let [key, value] of Object.entries(row)) {
          if (IgnoreFields.includes(key)) {
            continue;
          }
          let definition = parseField(key);
          console.log(`Key: ${key}, Definition: ${JSON.stringify(definition)}`);
          row[key] = getPropertyValue(value, definition);
        }
        row[DataTypeKey] = dataType;
      }

      let continuation;
      if (remaining > 0) {
        continuation = { cursor: cursor + count };
      }

      return {
        result: rows,
        continuation,
      };
    }
  }
});

pack.addFormula({
  name: "Constraints",
  description: "Generate a constraint value for filtering a sync table of data.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "live",
      description: "If the contraint is againt the live database.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "dataType",
      description: "Which data type the constraint is for.",
      autocomplete: async function (context, _, args) {
        let {live} = args;
        let types = getDataTypes(live, context);
        return types;
      },
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "key",
      description: "Which field to apply the constraint to.",
      autocomplete: async function (context, _, args) {
        let {live, dataType} = args;
        let fields = await getFields(dataType, live, context);
        return fields.map(field => {
          let definition = parseField(field);
          return {
            display: definition.name,
            value: field,
          };
        });
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "constraint",
      description: "The constraint to apply.",
      autocomplete: ConstraintTypes,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value to use for the constraint. For contraints that don't require a value leave this parameter blank.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function (args, context) {
    let [live, dataType, ...varargs] = args;
    let results = [];
    while (varargs.length) {
      let key, constraint, value;
      [key, constraint, value, ...varargs] = varargs;
      results.push({key, constraint_type: constraint, value});
    }
    return JSON.stringify(results);
  },
})