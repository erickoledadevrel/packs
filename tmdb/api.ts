import * as coda from "@codahq/packs-sdk";
import * as constants from "./constants";

export class Api {
  context: coda.ExecutionContext;

  constructor(context: coda.ExecutionContext) {
    this.context = context;
  }

  public async searchMovies(query: string) {
    let url = coda.withQueryParams("https://api.themoviedb.org/3/search/movie", {
      query,
      include_adult: false,
      language: "en-US",
    });
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: constants.OneDaySecs,
    });
    let data = response.body;
    return data;
  }

  public async searchShows(query: string) {
    let url = coda.withQueryParams("https://api.themoviedb.org/3/search/tv", {
      query,
      include_adult: false,
      language: "en-US",
    });
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: constants.OneDaySecs,
    });
    let data = response.body;
    return data;
  }

  public async getMovie(id: string) {
    let url = coda.withQueryParams(`https://api.themoviedb.org/3/movie/${id}`, {
      append_to_response: "release_dates",
    });
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: constants.OneDaySecs,
    });
    let movie = response.body;
    return movie;
  }

  public async getShow(id: string) {
    let url = coda.withQueryParams(`https://api.themoviedb.org/3/tv/${id}`, {
      append_to_response: "content_ratings",
    });
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: constants.OneDaySecs,
    });
    let movie = response.body;
    return movie;
  }

  public async getConfiguration() {
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: "https://api.themoviedb.org/3/configuration",
      cacheTtlSecs: constants.OneDaySecs,
    });
    let configuration = response.body;
    return configuration;
  }

  public async getCountries() {
    let response = await this.context.fetcher.fetch({
      method: "GET",
      url: "https://api.themoviedb.org/3/configuration/countries",
      cacheTtlSecs: constants.OneDaySecs,
    });
    let countries = response.body;
    return countries;
  }
}
