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

const ParameterSchema = coda.makeObjectSchema({
  properties: {
    name: {type: coda.ValueType.String},
    description: {type: coda.ValueType.String},
    type: {
      type: coda.ValueType.String,
      description: "The data type of the parameter.",
    },
    isOptional: {type: coda.ValueType.Boolean},
    hasAutocomplete: {type: coda.ValueType.Boolean},
    hasSuggestedValue: {type: coda.ValueType.Boolean},
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
    parameters: {type: coda.ValueType.Array, items: ParameterSchema},
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
    },
    hasDynamicSchema: {
      type: coda.ValueType.Boolean,
      description: "If the sync table has a dynamic schema.",
    },
    parameters: {
      type: coda.ValueType.Array, 
      items: ParameterSchema,
      description: "The parameters of the sync table."
    },
    supportsRowPermissions: { 
      type: coda.ValueType.Boolean, 
      fromKey: "supportsGetPermissions",
      description: "If the sync table can return per-row permissions."
    },
    schemaJSON: {
      type: coda.ValueType.String,
      description: "The schema the sync table uses, as a JSON string.",
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
    sdkVersion: {
      type: coda.ValueType.String,
      description: "The version of the SDK this release of the Pack was built with.",
    }
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
      required: true,
    },
    name: {
      type: coda.ValueType.String,
      description: "The name of the Pack.",
      mutable: true,
      required: true,
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
    sdkVersion: {
      type: coda.ValueType.String,
      description: "The version of the SDK the current release of the Pack was built with.",
    }
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

const SimpleStatsSchema = coda.makeObjectSchema({
  properties: {
    since: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    until: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    docInstalls: {
      type: coda.ValueType.Number,
    },
    workspaceInstalls: {
      type: coda.ValueType.Number,
    },
  },
  displayProperty: "until",
});

export const MyPackSchema = coda.makeObjectSchema({
  ...BasePackSchema,
  properties: {
    ...BasePackSchema.properties,
    stats: SimpleStatsSchema,
  },
  featuredProperties: ["logo", "tagline", "description", "categories"],
});

const MyPackReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(MyPackSchema, "MyPack");

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

export const StatsSchema = coda.makeObjectSchema({
  properties: {
    label: {
      type: coda.ValueType.String,
    },
    statsId: {
      type: coda.ValueType.String,
    },
    pack: MyPackReferenceSchema,
    numFormulaInvocations: {
      type: coda.ValueType.Number,
    },
    numActionInvocations: {
      type: coda.ValueType.Number,
    },
    numSyncInvocations: {
      type: coda.ValueType.Number,
    },
    numMetadataInvocations: {
      type: coda.ValueType.Number,
    },
    revenueUsd: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
    },
    date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    docInstalls: {
      type: coda.ValueType.Number,
    },
    workspaceInstalls: {
      type: coda.ValueType.Number,
    },
    docsActivelyUsing: {
      type: coda.ValueType.Number,
    },
    docsActivelyUsing7Day: {
      type: coda.ValueType.Number,
    },
    docsActivelyUsing30Day: {
      type: coda.ValueType.Number,
    },
    docsActivelyUsing90Day: {
      type: coda.ValueType.Number,
    },
    docsActivelyUsingAllTime: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyUsing: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyUsing7Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyUsing30Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyUsing90Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyUsingAllTime: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyTrialing: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyTrialing7Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyTrialing30Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyTrialing90Day: {
      type: coda.ValueType.Number,
    },
    workspacesActivelyTrialingAllTime: {
      type: coda.ValueType.Number,
    },
    workspacesWithActiveSubscriptions: {
      type: coda.ValueType.Number,
    },
    workspacesNewlySubscribed: {
      type: coda.ValueType.Number,
    },
    workspacesWithSuccessfulTrials: {
      type: coda.ValueType.Number,
    },
  },
  displayProperty: "label",
  idProperty: "statsId",
  featuredProperties: ["date", "pack", "docInstalls", "docsActivelyUsing", "workspaceInstalls", "workspacesActivelyUsing"],
});
