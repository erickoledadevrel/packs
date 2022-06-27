import * as coda from "@codahq/packs-sdk";
import { BaseUrl, PageSize, ProfileImageSizes } from "./constants";
import { getUrl, formatDate, extractId, wait } from "./helpers";
import { UserSchema, QuestionSchema, formatQuestion } from "./schemas";

export const pack = coda.newPack();

pack.addNetworkDomain("stackexchange.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  // The following two URLs are will be found in the API's documentation.
  authorizationUrl: "https://stackoverflow.com/oauth",
  tokenUrl: "https://stackoverflow.com/oauth/access_token/json",
  tokenQueryParam: "access_token",
  scopes: ["no_expiry"],
  getConnectionName: async function (context) {
    if (!context.endpoint) {
      return "Incomplete";
    }
    let response = await context.fetcher.fetch({
      method: "GET",
      url: getUrl("/me", context),
    });
    let user = response.body.items[0];
    return user.display_name;
  },
  postSetup: [
    {
      type: coda.PostSetupType.SetEndpoint,
      name: "Select Site",
      description: "Select the Stack Exchange site.",
      getOptions: async function (context, search) {
        let response = await context.fetcher.fetch({
          method: "GET",
          url: getUrl("/sites", context),
          disableAuthentication: true,
        });
        let sites = response.body.items;
        return sites.map(site => {
          return {
            display: site.name,
            value: coda.withQueryParams(BaseUrl, {
              site: site.api_site_parameter,
            }),
          };
        })
      }
    }
  ]
});

pack.addFormula({
  name: "User",
  description: "Gets information about the authenticated user.",
  parameters: [],
  resultType: coda.ValueType.Object,
  schema: UserSchema,
  execute: async function ([], context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: getUrl("/me", context),
    });
    let user = response.body.items[0];
    return user;
  },
});

pack.addFormula({
  name: "Question",
  description: "Get information about a question.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL or ID of the question.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: QuestionSchema,
  execute: async function ([urlOrId], context) {
    let extracted = extractId("/questions", urlOrId);
    if (!extracted) {
      throw new coda.UserVisibleError(`Invalid URL: ${urlOrId}`);
    }
    let {site, id} = extracted;
    let params = {};
    if (site) {
      params["site"] = site;
    }
    let url = getUrl("/questions/" + id, context, params);
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let data = response.body;
    let question = data.items[0];
    return formatQuestion(question);
  },
});

pack.addSyncTable({
  name: "Questions",
  description: "The questions on the site, optionally filtered by tag.",
  identityName: "Question",
  schema: QuestionSchema,
  formula: {
    name: "SyncQuestions",
    description: "Sync the questions.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.DateArray,
        name: "dateRange",
        description: "If specified, only questions created within the date range will be included.",
        suggestedValue: coda.PrecannedDateRange.Last30Days,
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "tags",
        description: "If specified, only questions with all of these tags will be included.",
        optional: true,
      }),
      // TODO: Remove?
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "sortBy",
        description: "What property to sort by.",
        autocomplete: ["activity", "creation", "votes"],
        optional: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "sortOrder",
        description: "Which direction to sort by.",
        autocomplete: [
          { display: "ascending", value: "asc" },
          { display: "descending", value: "desc" },
        ],
        optional: true,
      }),
    ],
    execute: async function ([dateRange, tags, sortBy, sortOrder], context) {
      let backoff = context.sync.continuation?.backoff as number || 0;
      if (backoff) {
        console.log(`Waiting for ${backoff} seconds.`)
        await wait(backoff);
      }
      let page = context.sync.continuation?.page as number || 1;
      let url = getUrl("/questions", context, {
        tagged: tags?.join(";"),
        fromdate: formatDate(dateRange[0]),
        todate: formatDate(dateRange[1]),
        sort: sortBy,
        order: sortOrder,
        pagesize: PageSize,
        page: page,
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let data = response.body;
      let questions = data.items;
      let continuation;
      if (data.has_more) {
        continuation = {
          page: page + 1,
          backoff: data.backoff,
        };
      }
      return {
        result: questions.map(formatQuestion),
        continuation: continuation,
      };
    },
  },
});

pack.addFormula({
  name: "ResizeProfileImage",
  description: "Resizes a Stack Exchange profile image.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Image,
      name: "image",
      description: "The profile image to resize.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "size",
      description: "The size, in pixels.",
      autocomplete: ProfileImageSizes,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  connectionRequirement: coda.ConnectionRequirement.None,
  execute: async function ([imageUrl, size], context) {
    if (!ProfileImageSizes.includes(size)) {
      throw new coda.UserVisibleError(`Invalid size: ${size}`);
    }
    return coda.withQueryParams(imageUrl, {
      s: size
    });
  },
});