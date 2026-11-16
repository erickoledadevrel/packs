import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

pack.addNetworkDomain("cataas.com");

// How many cats to fetch with each request.
const PageSize = 1000;

// Tag parameter, shared across multiple formulas.
const TagParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "tag",
  description: "Only cats with this tag will be selected.",
  optional: true,
  // Pull the list of tags to use for autocomplete from the API.
  autocomplete: async function (context, search) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://cataas.com/api/tags",
    });
    let tags = response.body;
    // Convert the tags into a list of autocomplete options.
    return sdk.simpleAutocomplete(search, tags);
  },
});

// Formula that fetches a random cat photo, with various options.
pack.addFormula({
  name: "CatPhoto",
  description: "Gets a random cat photo.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "text",
      description: "Text to display over the photo.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "size",
      description: "The size of the text, in pixels.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "color",
      description: "The color of the text. Any valid CSS color can be used.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "width",
      description: "The width of the desired photo, in pixels.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "height",
      description: "The height of the desired photo, in pixels.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "filter",
      description: "A filter to apply to the photo.",
      autocomplete: ["blur", "mono", "sepia", "negative", "paint", "pixel"],
      optional: true,
    }),
    TagParameter,
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "catId",
      description: "The ID of the cat photo to use. If this is supplied then the tag parameter will be ignored. ",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.ImageReference,
  execute: async function ([text, size, color, width, height, filter, tag, catId],
    context) {
    let url = "https://cataas.com/cat";
    if (catId || tag) {
      url += "/" + catId || tag;
    }
    if (text) {
      url += "/says/" + encodeURIComponent(text);
    }
    url = sdk.withQueryParams(url, {
      size: size,
      color: color,
      width: width,
      height: height,
      filter: filter,
      json: true,
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: 0, // Don't cache the result, so we can get a fresh cat.
    });
    return "https://cataas.com" + response.body.url;
  },
});

// Column format that displays the cell's value within a random cat photo,
// using the CatPhoto() formula defined above.
pack.addColumnFormat({
  name: "Cat Photo",
  instructions: "Displays the text over the photo of a random cat.",
  formulaName: "CatPhoto",
});

// Schema for a Cat photo.
const CatSchema = sdk.makeObjectSchema({
  properties: {
    image: {
      description: "The cat photo.",
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
    },
    tags: {
      description: "The tags used to categorize this cat.",
      type: sdk.ValueType.Array,
      items: sdk.makeSchema({ type: sdk.ValueType.String }),
    },
    created: {
      description: "When the cat photo was added.",
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.DateTime,
    },
    catId: { type: sdk.ValueType.String },
  },
  displayProperty: "catId",
  idProperty: "catId",
  featuredProperties: ["image", "tags"],
  identity: {
    name: "Cat",
  },
});

// Sync table that retrieves all cat photos, optionally filtered by tags.
pack.addSyncTable({
  name: "Cats",
  identityName: "Cat",
  schema: CatSchema,
  connectionRequirement: sdk.ConnectionRequirement.None,
  formula: {
    name: "SyncCats",
    description: "Syncs the cats.",
    parameters: [
      TagParameter,
    ],
    execute: async function ([tag], context) {
      // Load the stored value of "skip" from the last run, or default to zero
      // if this is the first run.
      let skip = context.sync.continuation?.skip as number ?? 0;

      let url = sdk.withQueryParams("https://cataas.com/api/cats", {
        tags: tag,
        limit: PageSize,
        skip: skip,
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let cats = response.body;
      let result = [];
      for (let cat of cats) {
        result.push({
          image: "https://cataas.com/cat/" + cat._id,
          tags: cat.tags,
          created: cat.createdAt,
          catId: cat._id,
        });
      }

      // Start with an empty continuation (end the sync).
      let continuation;
      // If the response contained a full page of cats we should fetch more.
      if (cats.length == PageSize) {
        // Create a continuation object (continue the sync).
        continuation = {
          // Save inside of it the "skip" value the next execution should use.
          skip: skip + PageSize,
        };
      }

      return {
        result: result,
        continuation: continuation,
      };
    },
  },
});
