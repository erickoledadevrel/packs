import * as coda from "@codahq/packs-sdk";

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