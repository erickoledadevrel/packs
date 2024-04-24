import * as coda from "@codahq/packs-sdk";

export const MemberSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.String, required: true },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: [],
});