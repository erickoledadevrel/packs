import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const ListingsUrl = "https://coda.io/apis/v1/packs/listings";

const PackUrlRegexes = [
  new RegExp("^https://coda.io/p/(\\d+)"),
  new RegExp("^https://coda.io/packs/(?:\\w+-)*(\\d+)"),
];

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
  }
});

const PackSchema = coda.makeObjectSchema({
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
  },
  displayProperty: "name",
  idProperty: "packId",
  featuredProperties: ["tagline", "logo", "makers"],
});

pack.addNetworkDomain("coda.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CodaApiHeaderBearerToken,
  shouldAutoAuthSetup: true,
});

pack.addFormula({
  name: "Pack",
  description: "Load information about a Pack",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "packIdOrUrl",
      description: "The ID or URL of the Pack.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: PackSchema,
  execute: async function (args, context) {
    let [packIdOrUrl] = args;
    let packId = getPackId(packIdOrUrl);
    let url = coda.withQueryParams(ListingsUrl, {
      packIds: packId
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let { items } = response.body;
    let item = items[0];
    formatItem(item);
    return item;
  },
});

pack.addColumnFormat({
  name: "Pack",
  instructions: "Enter the ID or URL of a Pack.",
  formulaName: "Pack",
  matchers: PackUrlRegexes,
});

pack.addSyncTable({
  name: "Packs",
  description: "A list of all of the published Packs.",
  identityName: "Pack",
  schema: PackSchema,
  formula: {
    name: "SyncPacks",
    description: "Sync the Packs.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePublished",
        description: "Include public Packs published in the gallery.",
        suggestedValue: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeWorkspace",
        description: "Include internal Packs shared with everyone in your workspace.",
        suggestedValue: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includePrivate",
        description: "Include private Packs you created or were shared with your directly.",
        suggestedValue: false,
      }),
    ],
    execute: async function (args, context) {
      let [includePublished, includeWorkspace, includePrivate] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams(ListingsUrl, {
          excludePublicPacks: !includePublished,
          excludeWorkspaceAcls: !includeWorkspace,
          excludeIndividualAcls: !includePrivate,
          limit: 50,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let { items, nextPageLink } = response.body;
      for (let item of items) {
       formatItem(item);
      }
      let continuation;
      if (nextPageLink) {
        continuation = { url: nextPageLink };
      }
      return {
        result: items,
        continuation,
      };
    },
  },
});

function formatItem(item:any) {
  item.categories = item.categories.map(category => category.categoryName);
  for (let maker of item.makers) {
    maker.profileLink = `https://coda.io/@${maker.slug}`;
  }
  item.price = item.standardPackPlan?.pricing?.amount;
  item.bundledWithPlan = item.bundledPackPlan?.pricing?.minimumFeatureSet;
  item.listingUrl = `https://coda.io/packs/${item.packId}`;
  item.studioUrl = `https://coda.io/p/${item.packId}`;
}

function getPackId(packIdOrUrl: string): string {
  for (let regex of PackUrlRegexes) {
    let match = packIdOrUrl.match(regex);
    if (match) {
      return match[1];
    }
  }
  if (isNaN(Number.parseInt(packIdOrUrl))) {
    throw new coda.UserVisibleError(`Invalid Pack ID or URL: ${packIdOrUrl}`);
  }
  return packIdOrUrl;
}
