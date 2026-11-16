import * as coda from "@codahq/packs-sdk";

const AuthorSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "name",
});

const LicenseSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String },
    spdx: { type: coda.ValueType.String },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "title",
});

export const CollectionSchema = coda.makeObjectSchema({
  properties: {
    id: { type: coda.ValueType.String, description: "The collection prefix, such as mdi." },
    name: { type: coda.ValueType.String },
    total: { type: coda.ValueType.Number, description: "Number of icons in this collection." },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url, description: "The collection's page on Iconify." },
    version: { type: coda.ValueType.String },
    author: AuthorSchema,
    license: LicenseSchema,
    samples: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
    category: { type: coda.ValueType.String },
    tags: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
    palette: { type: coda.ValueType.Boolean, description: "Whether icons have hardcoded colors." },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["id", "total", "author", "license"],
});

export const IconSchema = coda.makeObjectSchema({
  properties: {
    id: { type: coda.ValueType.String, description: "The full icon ID, such as mdi:home." },
    collectionId: { type: coda.ValueType.String, description: "The collection prefix, such as mdi." },
    image: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference, width: 48 },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url, description: "The icon's page on Iconify." },
  },
  displayProperty: "id",
  idProperty: "id",
  featuredProperties: ["collectionId", "image"],
});

export const SyncIconSchema = coda.makeObjectSchema({
  ...IconSchema,
  properties: {
    ...IconSchema.properties,
    collection: coda.makeObjectSchema({
      codaType: coda.ValueHintType.Reference,
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

export const SearchResultSchema = coda.makeObjectSchema({
  properties: {
    summary: { type: coda.ValueType.String, description: "The page, query, and/or collection used to find these icons." },
    icons: { type: coda.ValueType.Array, items: IconSchema },
    collections: { type: coda.ValueType.Array, items: CollectionSchema },
    page: { type: coda.ValueType.Number, description: "The requested page, starting at 1." },
    hasMore: {
      type: coda.ValueType.Boolean,
      description: "Whether another page is available. In search mode this is an estimate within the 999-result search cap; the next page can still be empty.",
    },
  },
  displayProperty: "summary",
  featuredProperties: ["icons", "collections", "page", "hasMore"],
});
