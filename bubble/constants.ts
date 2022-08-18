import * as coda from "@codahq/packs-sdk";

export const RowIdKey = "_id";
export const DataTypeKey = "_type"
export const MaxFeatured = 50;
export const DataTableIdentityName = "Data";
export const LoadDataTypesWorkflow = "load_data_types";
export const PageSize = 100;
export const IgnoreFields = [RowIdKey];
export const MetadataFields = {
  "Modified Date": "date",
  "Created Date": "date",
  "Created By": "user",
  "user_signed_up": "boolean",
  "authentication": "text",
};
export const ConstraintTypes = [
  "equals", "not equal",
  "is_empty", "is_not_empty",
  "text contains", "not text contains",
  "greater than", "less than",
  "in", "not in",
  "contains", "not contains",
  "empty", "not empty",
  "geographic_search",
];

export const BaseDataSchema = coda.makeObjectSchema({
  properties: {
    "rowId": { 
      type: coda.ValueType.String, 
      fromKey: RowIdKey, 
      description: "Internal ID for the row.",
      required: true,
    },
    "dataType": { 
      type: coda.ValueType.String, 
      fromKey: DataTypeKey, 
      description: "Data type of the row.",
      required: true,
    },
  },
  displayProperty: "dataType",
  idProperty: "rowId",
});