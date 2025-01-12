import * as coda from "@codahq/packs-sdk";
import * as api from "./api";
import * as schemas from "./schemas";
import * as helpers from "./helpers";
import * as images from "./images.json";

export const pack = coda.newPack();

pack.addNetworkDomain("rebrickable.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CustomHeaderToken,
  headerName: "Authorization",
  tokenPrefix: "key"
});

pack.addSyncTable({
  name: "Sets",
  description: "Lists LEGO sets.",
  identityName: schemas.SetSchema.identity.name,
  schema: schemas.SetSchema,
  formula: {
    name: "SyncSets",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "theme",
        description: "Only include sets in this theme.",
        optional: true,
        autocomplete: async function (context, search) {
          let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/themes/", {
            page_size: 1000,
          });
          let response = await context.fetcher.fetch({
            method: "GET",
            url,
          });
          let page = response.body;
          return coda.autocompleteSearchObjects(search, page.results, "name", "id");
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.DateArray,
        name: "years",
        description: "Only include sets released during these years (month and day are ignored).",
        optional: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "search",
        description: "Only include sets that match these search terms.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [themeId, years, search] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/sets/", {
          page_size: 500,
          theme_id: themeId,
          search,
          min_year: years ? helpers.getYear(context, years[0]) : undefined,
          max_year: years ? helpers.getYear(context, years[1]) : undefined,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(set => {
        return {
          ...set,
          theme: { id: set.theme_id, name: "Not synced" },
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addSyncTable({
  name: "Parts",
  description: "Lists LEGO parts.",
  identityName: schemas.PartSchema.identity.name,
  schema: schemas.PartSchema,
  formula: {
    name: "SyncParts",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "category",
        description: "Only include parts in this category.",
        optional: true,
        autocomplete: async function (context, search) {
          let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/part_categories/", {
            page_size: 1000,
          });
          let response = await context.fetcher.fetch({
            method: "GET",
            url,
          });
          let page = response.body;
          return coda.autocompleteSearchObjects(search, page.results, "name", "id");
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "color",
        description: "Only include parts with this color.",
        optional: true,
        autocomplete: async function (context, search) {
          let url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/colors/", {
            page_size: 1000,
          });
          let response = await context.fetcher.fetch({
            method: "GET",
            url,
          });
          let page = response.body;
          return coda.autocompleteSearchObjects(search, page.results, "name", "id");
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "search",
        description: "Only include parts that match these search terms.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [categoryId, colorId, search] = args;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/parts/", {
          page_size: 500,
          part_cat_id: categoryId,
          color_id: colorId,
          search,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(part => {
        return {
          ...part,
          category: { id: part.part_cat_id, name: "Not synced" },
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addDynamicSyncTable({
  name: "SetParts",
  description: "List the parts in a set.",
  identityName: "SetPart",
  entityName: "Part",
  listDynamicUrls: async function (context, themeId) {
    let themes = await api.listThemes(context);
    if (!themeId) {
      return themes
        .filter(theme => !theme.parent_id)
        .map(theme => {
          return {
            display: theme.name,
            value: String(theme.id),
            hasChildren: true,
          };
        });
    } else {
      let results: coda.MetadataFormulaObjectResultType[] = [];
      results = results.concat(themes
        .filter(theme => theme.parent_id == parseInt(themeId))
        .map(theme => {
          return {
            display: theme.name,
            value: String(theme.id),
            hasChildren: true,
          };
        })
      );
      let sets = await api.listSets(context, themeId);
      results = results.concat(sets
        .map(set => {
          return {
            display: set.name,
            value: set.set_num,
          };
        })
      );
      return results;
    }
  },
  getName: async function (context) {
    let setId = context.sync.dynamicUrl;
    let set = await api.getSet(context, setId);
    return `${set.name} Parts`;
  },
  getSchema: async function (context) {
    return schemas.SetPartSchema;
  },
  getDisplayUrl: async function (context) {
    let setId = context.sync.dynamicUrl;
    let set = await api.getSet(context, setId);
    return set.set_url;
  },
  formula: {
    name: "SyncSetParts",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let setId = context.sync.dynamicUrl;
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams(`https://rebrickable.com/api/v3/lego/sets/${setId}/parts`, {
          page_size: 500,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(setPart => {
        return {
          ...setPart,
          ...setPart.part,
          category: { id: setPart.part.part_cat_id, name: "Not synced" },
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addSyncTable({
  name: "Themes",
  description: "Lists LEGO themes.",
  identityName: schemas.ThemeSchema.identity.name,
  schema: schemas.ThemeSchema,
  formula: {
    name: "SyncThemes",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/themes/", {
          page_size: 1000,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(theme => {
        return {
          ...theme,
          parent: theme.parent_id ? {id: theme.parent_id, name: "Not synced"} : undefined,
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addSyncTable({
  name: "PartCategories",
  description: "Lists the various categories of LEGO parts.",
  identityName: schemas.PartCategorySchema.identity.name,
  schema: schemas.PartCategorySchema,
  formula: {
    name: "SyncPartCategories",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let url = context.sync.continuation?.url as string;
      if (!url) {
        url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/part_categories/", {
          page_size: 1000,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(partCategory => {
        return {
          ...partCategory,
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addSyncTable({
  name: "Colors",
  description: "Lists all the colors that LEGO has come in.",
  identityName: schemas.ColorSchema.identity.name,
  schema: schemas.ColorSchema,
  formula: {
    name: "SyncColors",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let url = context.sync.continuation?.url as string;
      let brickSvg = Buffer.from(images.brick, "base64").toString();
      if (!url) {
        url = coda.withQueryParams("https://rebrickable.com/api/v3/lego/colors/", {
          page_size: 1000,
        });
      }
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
      });
      let page = response.body;
      let rows = page.results.map(color => {
        let coloredSvg = brickSvg.replaceAll("#000", "#" + color.rgb);
        let preview = coda.SvgConstants.DataUrlPrefix + Buffer.from(coloredSvg).toString("base64");
        return {
          ...color,
          preview,
        };
      });
      let continuation;
      if (page.next) {
        continuation = {url: page.next};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});