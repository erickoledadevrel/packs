import * as sdk from "@superhuman/plugins-sdk";

export const RowIdKey = "__row__";
export const RowIndexKey = "__index__";
export const ObjectTypeKey = "__type__";

export const BaseQueryRowSchema = sdk.makeObjectSchema({
  properties: {
    rowId: { type: sdk.ValueType.String, fromKey: RowIdKey },
    rowIndex: { type: sdk.ValueType.Number, fromKey: RowIndexKey },
  },
  displayProperty: "rowIndex",
  idProperty: "rowId",
  featuredProperties: [],
});

export const BaseQueryObjectSchema = sdk.makeObjectSchema({
  properties: {
    objectType: { type: sdk.ValueType.Number, fromKey: ObjectTypeKey },
  },
  displayProperty: "objectType",
  featuredProperties: [],
});
