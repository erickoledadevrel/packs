import * as coda from "@codahq/packs-sdk";
import { GamesOptions } from "./types";

const ShortCacheSecs = 5 * 60;
const LongCacheSecs = 24 * 60 * 60;

export async function getConferences(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.collegefootballdata.com/conferences",
    cacheTtlSecs: LongCacheSecs,
  });
  let conferences = response.body;
  return conferences;
}

export async function getGames(context: coda.ExecutionContext, options: GamesOptions = {}) {
  let {year, division, conferences, cacheTtlSecs} = options;
  let url = coda.withQueryParams("https://api.collegefootballdata.com/games", {
    year,
    division: division?.toLocaleLowerCase(),
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs,
  });
  let games = response.body;
  if (conferences) {
    games = games.filter(game => conferences.includes(game.home_conference) || conferences.includes(game.away_conference));
  }
  return games;
}

export async function getGameLines(context: coda.ExecutionContext, options: GamesOptions = {}) {
  let {year, division, conferences, cacheTtlSecs} = options;
  let url = coda.withQueryParams("https://api.collegefootballdata.com/lines", {
    year,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs,
  });
  let items = response.body;
  return items;
}


