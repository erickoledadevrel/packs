import * as coda from "@codahq/packs-sdk";

export const TitlePropertyName = "Title";

export const BaseRowSchema = coda.makeObjectSchema({
  properties: {
    recordId: {
      type: coda.ValueType.String,
      description: "The unique ID of the record.",
      fromKey: "id",
      required: true,
    },
    [TitlePropertyName]: {
      type: coda.ValueType.String,
      fromKey: "title",
      required: true,
    }
  },
  idProperty: "recordId",
  displayProperty: TitlePropertyName,
  featuredProperties: [],
});

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