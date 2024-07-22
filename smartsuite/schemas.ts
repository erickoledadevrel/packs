import * as coda from "@codahq/packs-sdk";
import type * as sst from "./types/smartsuite";

const PersonSchema = coda.makeObjectSchema({
  codaType: coda.ValueHintType.Person,
  properties: {
    name: { type: coda.ValueType.String, required: true },
    email: { type: coda.ValueType.String, required: true },
  },
  displayProperty: "name",
  idProperty: "email",
});

export const MemberSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.String, required: true },
    email: { type: coda.ValueType.String, codaType: coda.ValueHintType.Email },
    codaAccount: { ...PersonSchema },
    timezone: { type: coda.ValueType.String },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["email", "codaAccount"],
});

export function getBaseRowSchema(table: sst.Table): coda.GenericObjectSchema {
  let primaryColumn = table.structure.find(column => column.slug == table.primary_field);
  return coda.makeObjectSchema({
    properties: {
      recordId: {
        type: coda.ValueType.String,
        description: "The unique ID of the record.",
        fromKey: "id",
        required: true,
      },
      [primaryColumn.label]: {
        type: coda.ValueType.String, 
        fromKey: primaryColumn.slug,
        required: true,
      },
    },
    idProperty: "recordId",
    displayProperty: primaryColumn.label,
    featuredProperties: [],
    identity: {
      name: "Record",
      dynamicUrl: table.id,
    }
  });
}

export function getReferenceSchema(table: sst.Table) {
  let schema = getBaseRowSchema(table);
  return coda.makeReferenceSchemaFromObjectSchema(schema);
}