import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

pack.addNetworkDomain("cataas.com");

// How many cats to fetch with each request.
const PageSize = 1000;

// Tag parameter, shared across multiple formulas.
const TagParameter = coda.makeParameter({
  type: coda.ParameterType.String,
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
    return coda.simpleAutocomplete(search, tags);
  },
});

// Formula that fetches a random cat photo, with various options.
pack.addFormula({
  name: "CatPhoto",
  description: "Gets a random cat photo.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "Text to display over the photo.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "size",
      description: "The size of the text, in pixels.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "color",
      description: "The color of the text. Any valid CSS color can be used.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "width",
      description: "The width of the desired photo, in pixels.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "height",
      description: "The height of the desired photo, in pixels.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "filter",
      description: "A filter to apply to the photo.",
      autocomplete: ["blur", "mono", "sepia", "negative", "paint", "pixel"],
      optional: true,
    }),
    TagParameter,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "catId",
      description: "The ID of the cat photo to use. If this is supplied then the tag parameter will be ignored. ",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  execute: async function ([text, size, color, width, height, filter, tag, catId],
    context) {
    let url = "https://cataas.com/cat";
    if (catId || tag) {
      url += "/" + catId || tag;
    }
    if (text) {
      url += "/says/" + encodeURIComponent(text);
    }
    url = coda.withQueryParams(url, {
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
const CatSchema = coda.makeObjectSchema({
  properties: {
    image: {
      description: "The cat photo.",
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    tags: {
      description: "The tags used to categorize this cat.",
      type: coda.ValueType.Array,
      items: coda.makeSchema({ type: coda.ValueType.String }),
    },
    created: {
      description: "When the cat photo was added.",
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
    },
    catId: { type: coda.ValueType.String },
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
  connectionRequirement: coda.ConnectionRequirement.None,
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

      let url = coda.withQueryParams("https://cataas.com/api/cats", {
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
