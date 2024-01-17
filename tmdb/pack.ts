import * as coda from "@codahq/packs-sdk";
import * as schemas from "./schemas";
import { Api } from "./api";
import * as helpers from "./helpers";
import * as constants from "./constants";

export const pack = coda.newPack();

pack.addNetworkDomain("themoviedb.org");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

pack.addFormula({
  name: "Movie",
  description: "Get the details of a movie.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "titleOrUrl",
      description: "The title of the movie, or its URL on TMDB.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "country",
      description: `The country code to use when retrieving certain information (ex: rating). Default: ${constants.DefaultCountryCode}`,
      optional: true,
      autocomplete: async function (context, search) {
        let api = new Api(context);
        let countries = await api.getCountries();
        return coda.autocompleteSearchObjects(search, countries, "english_name", "iso_3166_1");
      },
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.MovieSchema,
  cacheTtlSecs: constants.OneDaySecs,
  execute: async function (args, context) {
    let [titleOrUrl, country = constants.DefaultCountryCode] = args;
    let api = new Api(context);

    let movieId = titleOrUrl.match(constants.MovieUrlRegex)?.[1];
    if (!movieId) {
      let {results} = await api.searchMovies(titleOrUrl);
      movieId = results?.[0]?.id;
    }
    if (!movieId) {
      return {
        title: "Movie not found",
      };
    }
    let [movie, configuration] = await Promise.all([
      api.getMovie(movieId),
      api.getConfiguration(),
    ]);
    helpers.formatMovieForSchema(movie, country, configuration);
    return movie;
  },
});

pack.addColumnFormat({
  name: "Movie",
  instructions: "Enter the title of the movie, or its URL on TMDB.",
  formulaName: "Movie",
  matchers: [constants.MovieUrlRegex],
});

pack.addFormula({
  name: "SearchMovies",
  description: "Find a movie in the database.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "title",
      description: "The title of the movie.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: schemas.MovieSchema,
  cacheTtlSecs: constants.OneDaySecs,
  execute: async function (args, context) {
    let [name] = args;
    let api = new Api(context);
    let [search, configuration] = await Promise.all([
      api.searchMovies(name),
      api.getConfiguration(),
    ]);
    return search.results.map(movie => helpers.formatMovieForSchema(movie, constants.DefaultCountryCode, configuration));
  },
});

pack.addFormula({
  name: "TVShow",
  description: "Get the details of a TV show.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "nameOrUrl",
      description: "The name of the TV show, or its URL on TMDB.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.ShowSchema,
  cacheTtlSecs: constants.OneDaySecs,
  execute: async function (args, context) {
    let [nameOrUrl, country = constants.DefaultCountryCode] = args;
    let api = new Api(context);

    let id = nameOrUrl.match(constants.ShowUrlRegex)?.[1];
    if (!id) {
      let {results} = await api.searchShows(nameOrUrl);
      id = results?.[0]?.id;
    }
    if (!id) {
      return {
        name: "TV Show not found",
      };
    }
    let [show, configuration] = await Promise.all([
      api.getShow(id),
      api.getConfiguration(),
    ]);
    helpers.formatShowForSchema(show, country, configuration);
    return show;
  },
});

pack.addColumnFormat({
  name: "TV Show",
  instructions: "Type the name of the TV show.",
  formulaName: "TVShow",
  matchers: [constants.ShowUrlRegex],
});

pack.addFormula({
  name: "SearchTVShows",
  description: "Find a TV show in the database.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the show.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: schemas.ShowSchema,
  cacheTtlSecs: constants.OneDaySecs,
  execute: async function (args, context) {
    let [name] = args;
    let api = new Api(context);
    let [search, configuration] = await Promise.all([
      api.searchShows(name),
      api.getConfiguration(),
    ]);
    return search.results.map(show => helpers.formatShowForSchema(show, constants.DefaultCountryCode, configuration));
  },
});
