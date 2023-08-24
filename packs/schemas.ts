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
    canEdit: {
      type: coda.ValueType.Boolean,
      description: "If it supports edits (two-way sync).",
    }
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

const ReleaseSchema = coda.makeObjectSchema({
  properties: {
    created: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      fromKey: "createdAt",
      description: "When the release was created.",
    },
    number: {
      type: coda.ValueType.Number,
      fromKey: "releaseId",
      description: "The release number."
    },
    notes: {
      type: coda.ValueType.String,
      fromKey: "releaseNotes",
      description: "The notes describing the release.",
    },
  },
  displayProperty: "number",
});

const FeaturedDocSchema = coda.makeObjectSchema({
  properties: {
    publishedUrl: {
      type: coda.ValueType.String,
      description: "The published URL of the doc.",
    },
    isPinned: {
      type: coda.ValueType.Boolean,
      description: "If the doc is pinned.",
    },
  },
  displayProperty: "publishedUrl",
});

const AuthenticationSchema = coda.makeObjectSchema({
  properties: {
    type: {
      type: coda.ValueType.String,
      description: "The type of authentication.",
    },
  },
  displayProperty: "type",
});

export const BasePackSchema = coda.makeObjectSchema({
  properties: {
    packId: {
      type: coda.ValueType.Number,
      description: "The ID of the Pack.",
    },
    name: {
      type: coda.ValueType.String,
      description: "The name of the Pack.",
      mutable: true,
    },
    tagline: {
      type: coda.ValueType.String,
      fromKey: "shortDescription",
      description: "A short description of the Pack.",
      mutable: true,
    },
    description: {
      type: coda.ValueType.String,
      description: "A longer description of the Pack.",
      mutable: true,
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
    categories: {
      type: coda.ValueType.Array,
      items: { 
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.SelectList,
        options: coda.OptionsType.Dynamic,
      },
      description: "Which categories (of the Coda Gallery) the Pack applies to.",
      mutable: true,
    },
    supportEmail: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Email,
      description: "The email address to contact for support questions about the Pack.",
      mutable: true,
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
  },
  displayProperty: "name",
  idProperty: "packId",
});

export const PackSchema = coda.makeObjectSchema({
  ...BasePackSchema,
  properties: {
    ...BasePackSchema.properties,
    release: {
      type: coda.ValueType.Number,
      fromKey: "releaseId",
      description: "The current release of the Pack.",
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
  },
  featuredProperties: ["logo", "tagline", "makers"],
  linkProperty: "listingUrl",
  snippetProperty: "description",
  subtitleProperties: [
    { property: "tagline", label: "" },
    { property: "makers[*].name", label: `By ${coda.PropertyLabelValueTemplate}` },
  ],
  imageProperty: "logo",
});

export const MyPackSchema = coda.makeObjectSchema({
  ...BasePackSchema,
  featuredProperties: ["logo", "tagline", "description", "categories"],
});

export const BuildingBlockPoperties: coda.ObjectSchemaProperties = {
  formulas: {
    type: coda.ValueType.Array,
    items: FormulaSchema,
    description: "The formulas in the Pack.",
  },
  columnFormats: {
    type: coda.ValueType.Array,
    items: ColumnFormatSchema,
    description: "The column formats in the Pack.",
  },
  syncTables: {
    type: coda.ValueType.Array,
    items: SyncTableSchema,
    description: "The sync tables in the Pack.",
  },
  authentication: {
    ...AuthenticationSchema,
    description: "The authentication the Pack uses.",
  },
}

export const PublishedProperties: coda.ObjectSchemaProperties = {
  published: {
    type: coda.ValueType.Boolean,
    description: "If the Pack has been published to the gallery.",
  },
}

export const ReleasesProperties: coda.ObjectSchemaProperties = {
  releases: {
    type: coda.ValueType.Array,
    items: ReleaseSchema,
    description: "The list of releases for the Pack.",
  },
}

export const FeaturedDocsProperties: coda.ObjectSchemaProperties = {
  featuredDocs: {
    type: coda.ValueType.Array,
    items: FeaturedDocSchema,
    description: "The published docs featured in the Pack listing page.",
  }
}
