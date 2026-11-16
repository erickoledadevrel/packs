import * as sdk from "@superhuman/plugins-sdk";

const MakerSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the maker.",
    },
    picture: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "pictureLink",
      description: "The picture of the maker.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "A description of the maker.",
    },
    profileLink: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "A link to the maker's profile.",
    },
  },
  displayProperty: "name",
});

const ParameterSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    description: { type: sdk.ValueType.String },
    type: {
      type: sdk.ValueType.String,
      description: "The data type of the parameter.",
    },
    isOptional: { type: sdk.ValueType.Boolean },
    hasAutocomplete: { type: sdk.ValueType.Boolean },
    hasSuggestedValue: { type: sdk.ValueType.Boolean },
  },
  displayProperty: "name",
});

const FormulaSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the formula.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "A description of the formula.",
    },
    isAction: {
      type: sdk.ValueType.Boolean,
      description: "If the formula is an action.",
    },
    isCard: {
      type: sdk.ValueType.Boolean,
      description: "If the formula returns a card.",
    },
    parameters: { type: sdk.ValueType.Array, items: ParameterSchema },
  },
  displayProperty: "name",
});

const SyncTableSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the sync table.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "A description of the sync table.",
    },
    isDynamic: {
      type: sdk.ValueType.Boolean,
      description: "If the sync table is a dynamic sync table.",
    },
    canBrowseDatasets: {
      type: sdk.ValueType.Boolean,
      description: "For dynamic sync tables, if the user can browser the available datasets (has listDynamicUrls).",
    },
    canSearchDatasets: {
      type: sdk.ValueType.Boolean,
      description: "For dynamic sync tables, if the user can search for their dataset (has searchDynamicUrls).",
    },
    canEdit: {
      type: sdk.ValueType.Boolean,
      description: "If it supports edits (two-way sync).",
    },
    hasDynamicSchema: {
      type: sdk.ValueType.Boolean,
      description: "If the sync table has a dynamic schema.",
    },
    parameters: {
      type: sdk.ValueType.Array,
      items: ParameterSchema,
      description: "The parameters of the sync table."
    },
    supportsRowPermissions: {
      type: sdk.ValueType.Boolean,
      fromKey: "supportsGetPermissions",
      description: "If the sync table can return per-row permissions."
    },
    schemaJSON: {
      type: sdk.ValueType.String,
      description: "The schema the sync table uses, as a JSON string.",
    },
  },
  displayProperty: "name",
});

const ColumnFormatSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the column format.",
    },
    instructions: {
      type: sdk.ValueType.String,
      description: "The instructions for the column format.",
    },
    formulaName: {
      type: sdk.ValueType.String,
      description: "Which formula in this Pack is run on the column input.",
    },
    hasMatchers: {
      type: sdk.ValueType.Boolean,
      description: "If the column format defines a matching URL pattern.",
    },
  },
  displayProperty: "name",
});

const ToolSchema = sdk.makeObjectSchema({
  properties: {
    type: {
      type: sdk.ValueType.String,
      description: "The type of tool.",
    },
  },
  displayProperty: "type",
});

const SkillSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the skill.",
    },
    displayName: {
      type: sdk.ValueType.String,
      description: "The user-visible name of the skill.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "The description of the skill.",
    },
    tools: {
      type: sdk.ValueType.Array,
      items: ToolSchema,
      description: "The tools the skill can use.",
    },
  },
  displayProperty: "name",
});

const ReleaseSchema = sdk.makeObjectSchema({
  properties: {
    created: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.DateTime,
      fromKey: "createdAt",
      description: "When the release was created.",
    },
    number: {
      type: sdk.ValueType.Number,
      fromKey: "releaseId",
      description: "The release number."
    },
    notes: {
      type: sdk.ValueType.String,
      fromKey: "releaseNotes",
      description: "The notes describing the release.",
    },
    sdkVersion: {
      type: sdk.ValueType.String,
      description: "The version of the SDK this release of the Pack was built with.",
    }
  },
  displayProperty: "number",
});

const FeaturedDocSchema = sdk.makeObjectSchema({
  properties: {
    publishedUrl: {
      type: sdk.ValueType.String,
      description: "The published URL of the doc.",
    },
    isPinned: {
      type: sdk.ValueType.Boolean,
      description: "If the doc is pinned.",
    },
  },
  displayProperty: "publishedUrl",
});

const AuthenticationSchema = sdk.makeObjectSchema({
  properties: {
    type: {
      type: sdk.ValueType.String,
      description: "The type of authentication.",
    },
    oauthScopes: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String },
      description: "For OAuth2 types, the scopes being requested.",
    },
  },
  displayProperty: "type",
});

const AdminAuthenticationSchema = sdk.makeObjectSchema({
  properties: {
    authentication: AuthenticationSchema,
    name: {
      type: sdk.ValueType.String,
      description: "The unique identifier for the admin authentication.",
    },
    displayName: {
      type: sdk.ValueType.String,
      description: "The user-visible name of the authentication.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "The user-visible description of the authentication.",
    },
  },
  displayProperty: "name",
});

const McpServerSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The unique identifier for the MCP server.",
    },
    endpointUrl: {
      type: sdk.ValueType.String,
      description: "The URL where the MCP server is hosted.",
    },
  },
  displayProperty: "name",
});

export const BasePackSchema = sdk.makeObjectSchema({
  properties: {
    packId: {
      type: sdk.ValueType.Number,
      description: "The ID of the Pack.",
      required: true,
    },
    name: {
      type: sdk.ValueType.String,
      description: "The name of the Pack.",
      mutable: true,
      required: true,
    },
    tagline: {
      type: sdk.ValueType.String,
      fromKey: "shortDescription",
      description: "A short description of the Pack.",
      mutable: true,
    },
    description: {
      type: sdk.ValueType.String,
      description: "A longer description of the Pack.",
      mutable: true,
    },
    logo: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "logoUrl",
      description: "The logo image of the Pack.",
    },
    cover: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "coverUrl",
      description: "The cover image of the Pack.",
    },
    categories: {
      type: sdk.ValueType.Array,
      items: {
        type: sdk.ValueType.String,
        codaType: sdk.ValueHintType.SelectList,
        options: sdk.OptionsType.Dynamic,
      },
      description: "Which categories (of the Coda Gallery) the Pack applies to.",
      mutable: true,
    },
    supportEmail: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Email,
      description: "The email address to contact for support questions about the Pack.",
      mutable: true,
    },
    listingUrl: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "The URL of the Pack's listing page in the Coda Gallery.",
    },
    studioUrl: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "The URL to open the Pack in the Pack Studio editor.",
    },
  },
  displayProperty: "name",
  idProperty: "packId",
});

export const PackSchema = sdk.makeObjectSchema({
  ...BasePackSchema,
  properties: {
    ...BasePackSchema.properties,
    release: {
      type: sdk.ValueType.Number,
      fromKey: "releaseId",
      description: "The current release of the Pack.",
    },
    certified: {
      type: sdk.ValueType.Boolean,
      description: "Whether the Pack has been marked as Certified by sdk.",
    },
    certifiedAgent: {
      type: sdk.ValueType.Boolean,
      description: "Whether the Pack has been marked as a verified agent.",
    },
    makers: {
      type: sdk.ValueType.Array,
      items: MakerSchema,
      description: "The authors of the Pack.",
    },
    price: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Currency,
      currencyCode: "USD",
      description: "The price of the Pack (blank if free).",
    },
    bundledWithPlan: {
      type: sdk.ValueType.String,
      description: "Which Coda pricing plan the Pack is bundled with, if any.",
    },
    sdkVersion: {
      type: sdk.ValueType.String,
      description: "The version of the SDK the current release of the Pack was built with.",
    },
    manifestUrl: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "A link to the Pack's manifest file. It's an internal format that is subject to change without warning.",
      fromKey: "externalMetadataUrl",
    },
    packVersion: {
      type: sdk.ValueType.String,
      description: "The version of the Pack's current release.",
    },
    lastReleasedAt: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.DateTime,
      description: "When the Pack was last released.",
    },
    packCategoryType: {
      type: sdk.ValueType.String,
      description: "The category type of the Pack.",
    },
    distributionMode: {
      type: sdk.ValueType.String,
      description: "The distribution mode of the Pack.",
    },
    entryPoints: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String },
      description: "In which products the Pack will be shown.",
      fromKey: "packEntrypoints",
    },
  },
  featuredProperties: ["logo", "tagline", "makers"],
  linkProperty: "listingUrl",
  snippetProperty: "description",
  subtitleProperties: [
    { property: "tagline", label: "" },
    { property: "makers[*].name", label: `By ${sdk.PropertyLabelValueTemplate}` },
  ],
  imageProperty: "logo",
});

const SimpleStatsSchema = sdk.makeObjectSchema({
  properties: {
    since: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    until: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    docInstalls: {
      type: sdk.ValueType.Number,
    },
    workspaceInstalls: {
      type: sdk.ValueType.Number,
    },
  },
  displayProperty: "until",
});

export const MyPackSchema = sdk.makeObjectSchema({
  ...BasePackSchema,
  properties: {
    ...BasePackSchema.properties,
    stats: SimpleStatsSchema,
  },
  featuredProperties: ["logo", "tagline", "description", "categories"],
});

const MyPackReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(MyPackSchema, "MyPack");

export const BuildingBlockPoperties: sdk.ObjectSchemaProperties = {
  formulas: {
    type: sdk.ValueType.Array,
    items: FormulaSchema,
    description: "The formulas in the Pack.",
  },
  columnFormats: {
    type: sdk.ValueType.Array,
    items: ColumnFormatSchema,
    description: "The column formats in the Pack.",
  },
  syncTables: {
    type: sdk.ValueType.Array,
    items: SyncTableSchema,
    description: "The sync tables in the Pack.",
  },
  skills: {
    type: sdk.ValueType.Array,
    items: SkillSchema,
    description: "The skills in the Pack.",
  },
  authentication: {
    ...AuthenticationSchema,
    description: "The authentication the Pack uses.",
  },
  adminAuthentications: {
    type: sdk.ValueType.Array,
    items: AdminAuthenticationSchema,
    description: "The admin authentication types that the Pack supports.",
  },
  networkDomains: {
    type: sdk.ValueType.Array,
    items: { type: sdk.ValueType.String },
    description: "The network domains that the Pack can make requests to.",
  },
  mcpServers: {
    type: sdk.ValueType.Array,
    items: McpServerSchema,
    description: "The MCP servers the Pack can connect to.",
  },
}

export const PublishedProperties: sdk.ObjectSchemaProperties = {
  published: {
    type: sdk.ValueType.Boolean,
    description: "If the Pack has been published to the gallery.",
  },
  verifiedVersion: {
    type: sdk.ValueType.String,
    description: "The version of the Pack that was last marked as verified.",
  },
  storeUrl: {
    type: sdk.ValueType.String,
    codaType: sdk.ValueHintType.Url,
    description: "The URL of the Pack's listing page in the Superhuman Store.",
  },
}

export const ReleasesProperties: sdk.ObjectSchemaProperties = {
  releases: {
    type: sdk.ValueType.Array,
    items: ReleaseSchema,
    description: "The list of releases for the Pack.",
  },
}

export const FeaturedDocsProperties: sdk.ObjectSchemaProperties = {
  featuredDocs: {
    type: sdk.ValueType.Array,
    items: FeaturedDocSchema,
    description: "The published docs featured in the Pack listing page.",
  }
}

export const ManifestProperty: sdk.Schema & sdk.ObjectSchemaProperty = {
  type: sdk.ValueType.String,
  description: "The raw JSON contents of the Pack's manifest. Use the ParseJSON formula to extract information. It's an internal format that is subject to change without warning.",
}

export const StatsSchema = sdk.makeObjectSchema({
  properties: {
    label: {
      type: sdk.ValueType.String,
    },
    statsId: {
      type: sdk.ValueType.String,
    },
    pack: MyPackReferenceSchema,
    numFormulaInvocations: {
      type: sdk.ValueType.Number,
    },
    numActionInvocations: {
      type: sdk.ValueType.Number,
    },
    numSyncInvocations: {
      type: sdk.ValueType.Number,
    },
    numMetadataInvocations: {
      type: sdk.ValueType.Number,
    },
    revenueUsd: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Currency,
    },
    date: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    docInstalls: {
      type: sdk.ValueType.Number,
    },
    workspaceInstalls: {
      type: sdk.ValueType.Number,
    },
    docsActivelyUsing: {
      type: sdk.ValueType.Number,
    },
    docsActivelyUsing7Day: {
      type: sdk.ValueType.Number,
    },
    docsActivelyUsing30Day: {
      type: sdk.ValueType.Number,
    },
    docsActivelyUsing90Day: {
      type: sdk.ValueType.Number,
    },
    docsActivelyUsingAllTime: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyUsing: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyUsing7Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyUsing30Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyUsing90Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyUsingAllTime: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyTrialing: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyTrialing7Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyTrialing30Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyTrialing90Day: {
      type: sdk.ValueType.Number,
    },
    workspacesActivelyTrialingAllTime: {
      type: sdk.ValueType.Number,
    },
    workspacesWithActiveSubscriptions: {
      type: sdk.ValueType.Number,
    },
    workspacesNewlySubscribed: {
      type: sdk.ValueType.Number,
    },
    workspacesWithSuccessfulTrials: {
      type: sdk.ValueType.Number,
    },
  },
  displayProperty: "label",
  idProperty: "statsId",
  featuredProperties: ["date", "pack", "docInstalls", "docsActivelyUsing", "workspaceInstalls", "workspacesActivelyUsing"],
});
