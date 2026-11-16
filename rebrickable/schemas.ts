import * as sdk from "@superhuman/plugins-sdk";

export const ThemeSchema = sdk.makeObjectSchema({
  identity: {
    name: "Theme",
  },
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.Number, required: true },
    // Synthetic.
    // parent: Added below.
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["parent"],
});

ThemeSchema.properties["parent"] = sdk.makeReferenceSchemaFromObjectSchema(ThemeSchema);

export const SetSchema = sdk.makeObjectSchema({
  identity: {
    name: "Set",
  },
  properties: {
    name: { type: sdk.ValueType.String },
    id: { fromKey: "set_num", type: sdk.ValueType.String },
    year: { type: sdk.ValueType.Number, useThousandsSeparator: false },
    num_parts: { type: sdk.ValueType.Number },
    photo: { fromKey: "set_img_url", type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    link: { fromKey: "set_url", type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
    // Synthetic properties.
    theme: sdk.makeReferenceSchemaFromObjectSchema(ThemeSchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["photo", "year", "num_parts", "link"],
});

export const PartCategorySchema = sdk.makeObjectSchema({
  identity: {
    name: "PartCategory",
  },
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.Number, required: true },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: [],
});

export const ColorSchema = sdk.makeObjectSchema({
  identity: {
    name: "Color",
  },
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.Number, required: true },
    rgb: { type: sdk.ValueType.String },
    preview: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference, width: "30" },
    transparent: { fromKey: "is_trans", type: sdk.ValueType.Boolean },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["rgb", "preview"],
});

export const PartSchema = sdk.makeObjectSchema({
  identity: {
    name: "Part",
  },
  properties: {
    name: { type: sdk.ValueType.String },
    id: { fromKey: "part_num", type: sdk.ValueType.String },
    link: { fromKey: "part_url", type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
    photo: { fromKey: "part_img_url", type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    // Synthetic.
    category: sdk.makeReferenceSchemaFromObjectSchema(PartCategorySchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["photo", "category", "link"],
});

export const SetPartSchema = sdk.makeObjectSchema({
  ...PartSchema,
  identity: {
    name: "SetPart",
  },
  properties: {
    ...PartSchema.properties,
    name: { type: sdk.ValueType.String },
    id: { type: sdk.ValueType.String },
    quantity: { type: sdk.ValueType.Number },
    spare: { fromKey: "is_spare", type: sdk.ValueType.Boolean },
    // Synthetic.
    color: sdk.makeReferenceSchemaFromObjectSchema(ColorSchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: [
    ...PartSchema.featuredProperties,
    "quantity",
    "color",
  ],
});