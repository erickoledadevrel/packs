import * as coda from "@codahq/packs-sdk";

export const RowIdKey = "__row__";
export const RowIndexKey = "__index__";
export const ObjectTypeKey = "__type__";

export const BaseQueryRowSchema = coda.makeObjectSchema({
  properties: {
    rowId: { type: coda.ValueType.String, fromKey: RowIdKey },
    rowIndex: { type: coda.ValueType.Number, fromKey: RowIndexKey },
  },
  displayProperty: "rowIndex",
  idProperty: "rowId",
  featuredProperties: [],
});

export const BaseQueryObjectSchema = coda.makeObjectSchema({
  properties: {
    objectType: { type: coda.ValueType.Number, fromKey: ObjectTypeKey },
  },
  displayProperty: "objectType",
  featuredProperties: [],
});
