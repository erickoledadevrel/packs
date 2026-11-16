import * as sdk from "@superhuman/plugins-sdk";

const AuthorSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    url: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "name",
});

const LicenseSchema = sdk.makeObjectSchema({
  properties: {
    title: { type: sdk.ValueType.String },
    spdx: { type: sdk.ValueType.String },
    url: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "title",
});

export const CollectionSchema = sdk.makeObjectSchema({
  properties: {
    id: { type: sdk.ValueType.String, description: "The collection prefix, such as mdi." },
    name: { type: sdk.ValueType.String },
    total: { type: sdk.ValueType.Number, description: "Number of icons in this collection." },
    link: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url, description: "The collection's page on Iconify." },
    version: { type: sdk.ValueType.String },
    author: AuthorSchema,
    license: LicenseSchema,
    samples: { type: sdk.ValueType.Array, items: { type: sdk.ValueType.String } },
    category: { type: sdk.ValueType.String },
    tags: { type: sdk.ValueType.Array, items: { type: sdk.ValueType.String } },
    palette: { type: sdk.ValueType.Boolean, description: "Whether icons have hardcoded colors." },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["id", "total", "author", "license"],
});

export const IconSchema = sdk.makeObjectSchema({
  properties: {
    id: { type: sdk.ValueType.String, description: "The full icon ID, such as mdi:home." },
    collectionId: { type: sdk.ValueType.String, description: "The collection prefix, such as mdi." },
    image: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference, width: 48 },
    link: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url, description: "The icon's page on Iconify." },
  },
  displayProperty: "id",
  idProperty: "id",
  featuredProperties: ["collectionId", "image"],
});

export const SyncIconSchema = sdk.makeObjectSchema({
  ...IconSchema,
  properties: {
    ...IconSchema.properties,
    collection: sdk.makeObjectSchema({
      codaType: sdk.ValueHintType.Reference,
      identity: { name: "Collection" },
      properties: {
        id: { ...CollectionSchema.properties.id, required: true },
        name: { ...CollectionSchema.properties.name, required: true },
      },
      idProperty: "id",
      displayProperty: "name",
    }),
  },
  featuredProperties: ["collection", "image", "link"],
});

export const SearchResultSchema = sdk.makeObjectSchema({
  properties: {
    summary: { type: sdk.ValueType.String, description: "The page, query, and/or collection used to find these icons." },
    icons: { type: sdk.ValueType.Array, items: IconSchema },
    collections: { type: sdk.ValueType.Array, items: CollectionSchema },
    page: { type: sdk.ValueType.Number, description: "The requested page, starting at 1." },
    hasMore: {
      type: sdk.ValueType.Boolean,
      description: "Whether another page is available. In search mode this is an estimate within the 999-result search cap; the next page can still be empty.",
    },
  },
  displayProperty: "summary",
  featuredProperties: ["icons", "collections", "page", "hasMore"],
});
