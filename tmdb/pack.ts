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
      name: "name",
      description: "The name of the movie.",
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
    let [name, country = constants.DefaultCountryCode] = args;
    let api = new Api(context);

    let movieId = name.match(constants.MovieUrlRegex)?.[1];
    if (!movieId) {
      let {results} = await api.searchMovies(name);
      movieId = results?.[0]?.id;
    }
    if (!movieId) {
      throw new coda.UserVisibleError("Movie not found.");
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
  instructions: "Type the name of the movie.",
  formulaName: "Movie",
  matchers: [constants.MovieUrlRegex],
});

pack.addFormula({
  name: "TVShow",
  description: "Get the details of a TV show.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the TV show.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.ShowSchema,
  cacheTtlSecs: constants.OneDaySecs,
  execute: async function (args, context) {
    let [name, country = constants.DefaultCountryCode] = args;
    let api = new Api(context);

    let id = name.match(constants.ShowUrlRegex)?.[1];
    if (!id) {
      let {results} = await api.searchShows(name);
      id = results?.[0]?.id;
    }
    if (!id) {
      throw new coda.UserVisibleError("TV show not found.");
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
