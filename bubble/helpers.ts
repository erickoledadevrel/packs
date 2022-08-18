import * as coda from "@codahq/packs-sdk";
import * as nearley from 'nearley';
import * as grammar from './grammar';
import Url from "url-parse";

import { DataSourceDefinition, FieldDefinition } from "./types";
import { BaseDataSchema, DataTableIdentityName, DataTypeKey, IgnoreFields, LoadDataTypesWorkflow, MetadataFields, PageSize, RowIdKey } from "./constants";

export function getAppId(endpoint: string): string {
  let parsed = new Url(endpoint);
  return parsed.hostname.split(".")[0];
}

export function parseDataSource(url: string): DataSourceDefinition {
  return JSON.parse(url);
}

export function getDataUrl(type: string, live = false, params?: Record<string, any>): string {
  let url = coda.joinUrl("/api/1.1/obj/", type);
  if (!live) {
    url = coda.joinUrl("version-test", url);
  }
  return coda.withQueryParams(url, params);
}

export function getWorkflowUrl(name: string, live = false, params?: Record<string, any>): string {
  let url = coda.joinUrl("/api/1.1/wf/", name);
  if (!live) {
    url = coda.joinUrl("version-test", url);
  }
  return coda.withQueryParams(url, params);
}

export function parseField(key: string): FieldDefinition {
  if (MetadataFields[key]) {
    return {
      name: key,
      type: MetadataFields[key],
    };
  }
  let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(key);
  let results = parser.results;
  if (!results.length) {
    throw new Error("Cannot parse field: " + key);
  }
  let result = results.reduce((res, item) => {
    if (!res || item.name < res.name) return item;
    return res;
  });
  return result;
}

export function getPropertyValue(value, definition: FieldDefinition) {
  if (definition.list) {
    return value.map(item => getPropertyValue(item, {...definition, list: false}));
  }
  switch (definition.type) {
    case "dateinterval":
      return (value / 1000) + " secs";
    case "user":
      return {
        [RowIdKey]: value,
        [DataTypeKey]: "user",
      };
    case "custom":
      return {
        [RowIdKey]: value,
        [DataTypeKey]: definition.ref,
      };
    case "image":
    case "file":
      if (value.startsWith("//")) {
        return "https:" + value;
      }
    default:
      return value;
  }
}

export function getPropertySchema(definition: FieldDefinition): coda.Schema & coda.ObjectSchemaProperty {
  let schema: coda.Schema & coda.ObjectSchemaProperty;
  switch (definition.type) {
    case "boolean":
      schema = {
        type: coda.ValueType.Boolean,
      };
      break;
    case "number":
      schema = {
        type: coda.ValueType.Number,
      };
      break;
    case "date":
      schema = { 
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.DateTime,
      };
      break;
    case "date_range":
      schema = { 
        type: coda.ValueType.Array,
        items: {
          type: coda.ValueType.String,
          codaType: coda.ValueHintType.DateTime,
        },
      };
      break;
    case "dateinterval":
      schema = { 
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Duration,
      };
      break;
    case "image":
      schema = { 
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.ImageReference,
      };
      break;
    case "file":
      schema = { 
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Url,
      };
      break;
    case "user":
      schema = getReferenceSchema("user");
      break;
    case "custom":
      schema = getReferenceSchema(definition.ref);
      break;
    case "option":
    case "text":
    default:
      schema = { type: coda.ValueType.String };
  }
  if (definition.list) {
    schema = {
      type: coda.ValueType.Array,
      items: schema,
    };
  }
  return schema;
}

function getReferenceSchema(type): coda.GenericObjectSchema {
  let schema = coda.makeReferenceSchemaFromObjectSchema(BaseDataSchema, DataTableIdentityName);
  schema.identity.dynamicUrl = type;
  return schema;
}

export async function getDataTypes(live: boolean, context: coda.ExecutionContext): Promise<string[]> {
  let url = getWorkflowUrl(LoadDataTypesWorkflow, live);
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 60,
  });
  return response.body.split(",").map(type => type.trim());
}

export async function getFields(dataType: string, live: boolean, context: coda.ExecutionContext) {
  let params: Record<string, any> = {
    limit: PageSize,
  };
  let url = getDataUrl(dataType, live, params)

  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 0,
  });

  let rows = response.body.response.results;
  if (!rows?.length) {
    return [];
  }
  let row = Object.assign({}, ...rows);
  return Object.keys(row)
    .filter(key => !IgnoreFields.includes(key));
}