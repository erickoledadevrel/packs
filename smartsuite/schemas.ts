import * as sdk from "@superhuman/plugins-sdk";
import type * as sst from "./types/smartsuite";

const PersonSchema = sdk.makeObjectSchema({
  codaType: sdk.ValueHintType.Person,
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    email: { type: sdk.ValueType.String, required: true },
  },
  displayProperty: "name",
  idProperty: "email",
});

export const MemberSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.String, required: true },
    email: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Email },
    codaAccount: { ...PersonSchema },
    timezone: { type: sdk.ValueType.String },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["email", "codaAccount"],
});

export function getBaseRowSchema(table: sst.Table): sdk.GenericObjectSchema {
  let primaryColumn = table.structure.find(column => column.slug == table.primary_field);
  return sdk.makeObjectSchema({
    properties: {
      recordId: {
        type: sdk.ValueType.String,
        description: "The unique ID of the record.",
        fromKey: "id",
        required: true,
      },
      [primaryColumn.label]: {
        type: sdk.ValueType.String, 
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
  return sdk.makeReferenceSchemaFromObjectSchema(schema);
}