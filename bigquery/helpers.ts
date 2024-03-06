import * as coda from "@codahq/packs-sdk";
import * as crypto from "crypto";
import { ObjectTypeKey } from "./schemas";
import { BaseQueryObjectSchema } from "./schemas";

export function getProjectId(context: coda.ExecutionContext) {
  return context.endpoint.split("#").pop();
}

export function formatObjectValue(obj, schema) {
  let result: Record<string, any> = {};
  let fieldValues = obj.f;
  for (let [j, fieldValue] of fieldValues.entries()) {
    let field = schema.fields[j];
    let name = field.name;
    let value = fieldValue.v;
    result[name] = getColumnValue(field, value);
  }
  return result;
}

function getColumnValue(field, value) {
  if (value == null || value == undefined) {
    return value;
  }
  if (field.mode == "REPEATED") {
    return value.map(val => getColumnValue(itemOf(field), val.v));
  }
  switch (field.type) {
    case "RECORD":
      let obj = formatObjectValue(value, field);
      obj[ObjectTypeKey] = field.name;
      return obj;
    case "TIMESTAMP":
      return (new Date(Number(value) * 1000)).toUTCString();
    default:
      return value;
  }
}

function getColumnSchema(field): coda.Schema & coda.ObjectSchemaProperty {
  if (field.mode == "REPEATED") {
    return {
      type: coda.ValueType.Array,
      items: getColumnSchema(itemOf(field)),
    };
  }
  switch (field.type) {
    case "STRING":
      return { type: coda.ValueType.String };
    case "INTEGER":
    case "FLOAT":
      return { type: coda.ValueType.Number };
    case "BOOLEAN":
      return { type: coda.ValueType.Boolean };
    case "DATE":
      return { type: coda.ValueType.String, codaType: coda.ValueHintType.Date };
    case "TIME":
      return { type: coda.ValueType.String, codaType: coda.ValueHintType.Time };
    case "DATETIME":
    case "TIMESTAMP":
      return { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime };
    case "RECORD":
      return getSchema(field, BaseQueryObjectSchema);
    default:
      return { type: coda.ValueType.String };
  }
}

export function getSchema(schema, baseSchema?): coda.GenericObjectSchema {
  let result = coda.makeObjectSchema({
    ...baseSchema ? baseSchema : {},
    properties: {
      ...baseSchema ? baseSchema.properties : {},
    },
  });
  for (let field of schema.fields) {
    let propertySchema = getColumnSchema(field);
    propertySchema.displayName = field.name;
    result.properties[field.name] = propertySchema;
  }
  return result;
}

function itemOf(arrayField) {
  return {
    ...arrayField,
    mode: undefined,
  };
}

export function randomId() {
  return Math.random().toString(36).substring(2);
}

export function onError(error: Error) {
  console.error(error)
  if (coda.StatusCodeError.isStatusCodeError(error) && error.statusCode != 401 && error.body?.error?.message) {
    let message = error.body.error.message;
    if (message.includes("CloudRegion")) {
      console.log("match");
      message = "Invalid project ID, or access hasn't been granted.";
    }
    throw new coda.UserVisibleError(message);
  }
  throw error;
}

export function getHash(value: string): string {
  return crypto.createHash("md5").update(value).digest("base64").toString();
}

export function maybeParseJsonList(jsonList: string[] | undefined): string[] | undefined {
  if (jsonList) {
    return jsonList.map(json => JSON.parse(json));
  }
}
