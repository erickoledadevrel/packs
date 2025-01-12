import * as coda from "@codahq/packs-sdk";

export const ThemeSchema = coda.makeObjectSchema({
  identity: {
    name: "Theme",
  },
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.Number, required: true },
    // Synthetic.
    // parent: Added below.
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["parent"],
});

ThemeSchema.properties["parent"] = coda.makeReferenceSchemaFromObjectSchema(ThemeSchema);

export const SetSchema = coda.makeObjectSchema({
  identity: {
    name: "Set",
  },
  properties: {
    name: { type: coda.ValueType.String },
    id: { fromKey: "set_num", type: coda.ValueType.String },
    year: { type: coda.ValueType.Number, useThousandsSeparator: false },
    num_parts: { type: coda.ValueType.Number },
    photo: { fromKey: "set_img_url", type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    link: { fromKey: "set_url", type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    // Synthetic properties.
    theme: coda.makeReferenceSchemaFromObjectSchema(ThemeSchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["photo", "year", "num_parts", "link"],
});

export const PartCategorySchema = coda.makeObjectSchema({
  identity: {
    name: "PartCategory",
  },
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.Number, required: true },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: [],
});

export const ColorSchema = coda.makeObjectSchema({
  identity: {
    name: "Color",
  },
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.Number, required: true },
    rgb: { type: coda.ValueType.String },
    preview: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference, width: "30" },
    transparent: { fromKey: "is_trans", type: coda.ValueType.Boolean },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["rgb", "preview"],
});

export const PartSchema = coda.makeObjectSchema({
  identity: {
    name: "Part",
  },
  properties: {
    name: { type: coda.ValueType.String },
    id: { fromKey: "part_num", type: coda.ValueType.String },
    link: { fromKey: "part_url", type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    photo: { fromKey: "part_img_url", type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    // Synthetic.
    category: coda.makeReferenceSchemaFromObjectSchema(PartCategorySchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["photo", "category", "link"],
});

export const SetPartSchema = coda.makeObjectSchema({
  ...PartSchema,
  identity: {
    name: "SetPart",
  },
  properties: {
    ...PartSchema.properties,
    name: { type: coda.ValueType.String },
    id: { type: coda.ValueType.String },
    quantity: { type: coda.ValueType.Number },
    spare: { fromKey: "is_spare", type: coda.ValueType.Boolean },
    // Synthetic.
    color: coda.makeReferenceSchemaFromObjectSchema(ColorSchema),
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: [
    ...PartSchema.featuredProperties,
    "quantity",
    "color",
  ],
});