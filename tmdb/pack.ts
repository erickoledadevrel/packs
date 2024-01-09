import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const OneDaySecs = 25 * 60 * 60;
const MovieUrlRegex = new RegExp("^https://www.themoviedb.org/movie/(\\d+)");

pack.addNetworkDomain("themoviedb.org");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

const MovieSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String },
    tagline: { type: coda.ValueType.String },
    overview: { type: coda.ValueType.String },
    poster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "poster_path",
    },
    backdrop: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "backdrop_path",
    },
    release_date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    runtime: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Duration,
    },
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    homepage: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    budget: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
    },
    revenue: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
    },
    status: { type: coda.ValueType.String },
    id: { type: coda.ValueType.String },
  },
  displayProperty: "title",
  titleProperty: "title",
  snippetProperty: "overview",
  imageProperty: "poster",
  linkProperty: "link",
  subtitleProperties: [
    "release_date",
    "runtime",
    "tagline",
  ],
  attribution: [
    {
      type: coda.AttributionNodeType.Image,
      imageUrl: "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg",
      anchorUrl: "https://www.themoviedb.org",
    },
    {
      type: coda.AttributionNodeType.Link,
      anchorText: "The Movie Database (TMDB)",
      anchorUrl: "https://www.themoviedb.org",
    }
  ],
});

const ProviderSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, fromKey: "provider_name" },
    logo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "logo_path",
    }
  },
  displayProperty: "name",
});

const WatchSchema = coda.makeObjectSchema({
  properties: {
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      display: coda.LinkDisplayType.Title,
    },
    stream: {
      type: coda.ValueType.Array,
      items: ProviderSchema,
      fromKey: "flatrate",
    },
    rent: {
      type: coda.ValueType.Array,
      items: ProviderSchema,
    },
    buy: {
      type: coda.ValueType.Array,
      items: ProviderSchema,
    },
  },
  displayProperty: "link",
});

pack.addFormula({
  name: "Movie",
  description: "Get the details of a movie.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the movie.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: MovieSchema,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [name] = args;
    let movieId = name.match(MovieUrlRegex)?.[1];
    if (!movieId) {
      let {results} = await searchMovies(context, name);
      movieId = results?.[0]?.id;
    }
    if (!movieId) {
      throw new coda.UserVisibleError("Movie not found.");
    }
    let [movie, configuration] = await Promise.all([
      getMovie(context, movieId),
      getConfiguration(context),
    ]);
    fixImagePaths(movie, configuration);
    if (movie.runtime) {
      movie.runtime = movie.runtime + " mins";
    }
    movie.link = `https://www.themoviedb.org/movie/${movie.id}`;
    return movie;
  },
});

pack.addColumnFormat({
  name: "Movie",
  instructions: "Type the name of the movie.",
  formulaName: "Movie",
  matchers: [MovieUrlRegex],
});

pack.addFormula({
  name: "WhereToWatch",
  description: "Get information about where you can watch a movie.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "movieId",
      description: "The ID of the movie.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "region",
      description: "The region/country code where you are located.",
      autocomplete: async function (context, search) {
        let regions = await getWatchProviderRegions(context);
        return coda.autocompleteSearchObjects(search, regions, "english_name", "iso_3166_1");
      },
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: WatchSchema,
  execute: async function (args, context) {
    let [movieId, region] = args;
    if (!movieId) throw new coda.UserVisibleError("The movie ID must be specified.");
    if (!region) throw new coda.UserVisibleError("The region must be specified.");
    let providersByRegion = await getMovieWatchProviders(context, movieId);
    let providers = providersByRegion[region];
    if (!providers) {
      throw new coda.UserVisibleError("No providers in this region.");
    }
    return providers;
  },
});

async function searchMovies(context: coda.ExecutionContext, query: string) {
  let url = coda.withQueryParams("https://api.themoviedb.org/3/search/movie", {
    query,
    include_adult: false,
    language: "en-US",
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: OneDaySecs,
  });
  let data = response.body;
  return data;
}

async function getMovie(context: coda.ExecutionContext, id: string) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.themoviedb.org/3/movie/${id}`,
    cacheTtlSecs: OneDaySecs,
  });
  let movie = response.body;
  return movie;
}

async function getMovieWatchProviders(context: coda.ExecutionContext, id: string) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.themoviedb.org/3/movie/${id}/watch/providers`,
    cacheTtlSecs: OneDaySecs,
  });
  let providersByRegion = response.body.results;
  return providersByRegion;
}

async function getConfiguration(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.themoviedb.org/3/configuration",
    cacheTtlSecs: OneDaySecs,
  });
  let configuration = response.body;
  return configuration;
}

async function getWatchProviderRegions(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.themoviedb.org/3/watch/providers/regions",
  });
  let regions = response.body.results;
  return regions;
}

function fixImagePaths(movie, configuration) {
  let baseUrl = configuration.images.base_url;
  if (movie.poster_path) {
    movie.poster_path = coda.joinUrl(baseUrl, getLargestStandardSize(configuration.images.poster_sizes), movie.poster_path);
  }
  if (movie.backdrop_path) {
    movie.backdrop_path = coda.joinUrl(baseUrl, getLargestStandardSize(configuration.images.backdrop_sizes), movie.backdrop_path);
  }
}

function getLargestStandardSize(sizes: string[]): string {
  return sizes.filter(s => s != "original").pop();
}
