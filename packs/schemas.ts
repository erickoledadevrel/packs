import * as coda from "@codahq/packs-sdk";

const MakerSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the maker.",
    },
    picture: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "pictureLink",
      description: "The picture of the maker.",
    },
    description: {
      type: coda.ValueType.String,
      description: "A description of the maker.",
    },
    profileLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "A link to the maker's profile.",
    },
  },
  displayProperty: "name",
});

const FormulaSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the formula.",
    },
    description: {
      type: coda.ValueType.String,
      description: "A description of the formula.",
    },
    isAction: {
      type: coda.ValueType.Boolean,
      description: "If the formula is an action.",
    },
    isCard: {
      type: coda.ValueType.Boolean,
      description: "If the formula returns a card.",
    },
  },
  displayProperty: "name",
});

const SyncTableSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the sync table.",
    },
    description: {
      type: coda.ValueType.String,
      description: "A description of the sync table.",
    },
    isDynamic: {
      type: coda.ValueType.Boolean,
      description: "If the sync table is a dynamic sync table.",
    },
    canBrowseDatasets: {
      type: coda.ValueType.Boolean,
      description: "For dynamic sync tables, if the user can browser the available datasets (has listDynamicUrls).",
    },
    canSearchDatasets: {
      type: coda.ValueType.Boolean,
      description: "For dynamic sync tables, if the user can search for their dataset (has searchDynamicUrls).",
    },
  },
  displayProperty: "name",
});

const ColumnFormatSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the column format.",
    },
    instructions: {
      type: coda.ValueType.String,
      description: "The instructions for the column format.",
    },
    formulaName: {
      type: coda.ValueType.String,
      description: "Which formula in this Pack is run on the column input.",
    },
    hasMatchers: {
      type: coda.ValueType.Boolean,
      description: "If the column format defines a matching URL pattern.",
    },
  },
  displayProperty: "name",
});

export const PackSchema = coda.makeObjectSchema({
  properties: {
    packId: {
      type: coda.ValueType.Number,
      description: "The ID of the Pack.",
    },
    name: {
      type: coda.ValueType.String,
      description: "The name of the Pack.",
    },
    tagline: {
      type: coda.ValueType.String,
      fromKey: "shortDescription",
      description: "A short description of the Pack.",
    },
    description: {
      type: coda.ValueType.String,
      description: "A longer description of the Pack.",
    },
    logo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "logoUrl",
      description: "The logo image of the Pack.",
    },
    cover: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "coverUrl",
      description: "The cover image of the Pack.",
    },
    release: {
      type: coda.ValueType.Number,
      fromKey: "releaseId",
      description: "The current release of the Pack.",
    },
    categories: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
      description: "Which categories (of the Coda Gallery) the Pack applies to.",
    },
    supportEmail: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Email,
      description: "The email address to contact for support questions about the Pack.",
    },
    certified: {
      type: coda.ValueType.Boolean,
      description: "Whether the Pack has been marked as Certified by Coda.",
    },
    makers: {
      type: coda.ValueType.Array,
      items: MakerSchema,
      description: "The authors of the Pack.",
    },
    price: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
      currencyCode: "USD",
      description: "The price of the Pack (blank if free).",
    },
    bundledWithPlan: {
      type: coda.ValueType.String,
      description: "Which Coda pricing plan the Pack is bundled with, if any.",
    },
    listingUrl: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "The URL of the Pack's listing page.",
    },
    studioUrl: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "The URL to open the Pack in the Pack Studio editor.",
    },
    formulas: {
      type: coda.ValueType.Array,
      items: FormulaSchema,
      description: "The formulas in the Pack.",
    },
    syncTables: {
      type: coda.ValueType.Array,
      items: SyncTableSchema,
      description: "The sync tables in the Pack.",
    },
    columnFormats: {
      type: coda.ValueType.Array,
      items: ColumnFormatSchema,
      description: "The column formats in the Pack.",
    },
    published: {
      type: coda.ValueType.Boolean,
      description: "If the Pack has been published to the gallery.",
    },
  },
  displayProperty: "name",
  idProperty: "packId",
  featuredProperties: ["tagline", "logo", "makers"],
  linkProperty: "listingUrl",
  snippetProperty: "description",
  subtitleProperties: [
    { property: "tagline", label: "" },
    { property: "makers[*].name", label: `By ${coda.PropertyLabelValueTemplate}` },
  ],
  imageProperty: "logo",
});
