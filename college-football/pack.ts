import * as coda from "@codahq/packs-sdk";
import { TeamSchema, GameSchema, LineSchema } from "./schemas";
import { getConferences, getGames, getGameLines } from "./helpers";
import { GamesOptions } from "./types";

export const pack = coda.newPack();

pack.addNetworkDomain("collegefootballdata.com");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

const YearParameter = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "year",
  description: "Which year (season) to fetch data for.",
});

const DivisionParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "division",
  description: "If selected, limit the results to this division only.",
  autocomplete: ["FBS", "FCS", "II", "III"],
  optional: true,
});

const ConferencesParameter = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "conferences",
  description: "If selected, limit the results to these conferences only.",
  optional: true,
  autocomplete: async function (context, search, args) {
    let division: string = args.division;
    let conferences = await getConferences(context);
    conferences.sort((a, b) => a.name.localeCompare(b.name));
    if (division) {
      conferences = conferences.filter(conference => conference.classification == division.toLocaleLowerCase());
    }
    return coda.autocompleteSearchObjects(search, conferences, "name", "name");
  }
});

pack.addSyncTable({
  name: "Teams",
  description: "List basic information about the teams.",
  identityName: "Team",
  schema: TeamSchema,
  formula: {
    name: "SyncTeams",
    description: "Syncs the data.",
    parameters: [
      DivisionParameter,
      ConferencesParameter,
    ],
    execute: async function (args, context) {
      let [division, conferences] = args;
      let url = "https://api.collegefootballdata.com/teams";
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let teams = response.body;
      // Remove teams with no division.
      teams = teams.filter(team => team.classification);
      if (division) {
        teams = teams.filter(team => team.classification == division.toLocaleLowerCase());
      }
      if (conferences) {
        teams = teams.filter(team => conferences.includes(team.conference));
      }
      for (let team of teams) {
        team.logo = team.logos?.[0];
        team.classification = team.classification.toUpperCase();
      }
      return {
        result: teams,
      };
    },
  },
});

pack.addSyncTable({
  name: "Games",
  description: "List the scheduled games and their outcomes.",
  identityName: "Game",
  schema: GameSchema,
  formula: {
    name: "SyncGames",
    description: "Syncs the data.",
    parameters: [
      YearParameter,
      DivisionParameter,
      ConferencesParameter,
    ],
    execute: async function (args, context) {
      let [year, division, conferences] = args;
      let games = await getGames(context, {
        year, division, conferences
      });
      for (let game of games) {
        game.title = `${game.away_team} @ ${game.home_team}`;
        game.home = {
          id: game.home_id,
          school: game.home_team,
        };
        game.away = {
          id: game.away_id,
          school: game.away_team,
        };
      }
      return {
        result: games,
      };
    },
  },
});


pack.addSyncTable({
  name: "Odds",
  description: "List the betting odds and money lines for the games.",
  identityName: "Line",
  schema: LineSchema,
  formula: {
    name: "SyncLines",
    description: "Syncs the data.",
    parameters: [
      YearParameter,
      DivisionParameter,
      ConferencesParameter,
    ],
    execute: async function (args, context) {
      let [year, division, conferences] = args;
      let options: GamesOptions = {
        year, division, conferences
      };
      let [games, gameLines] = await Promise.all([
        getGames(context, options),
        getGameLines(context, options),
      ]);
      let gameIds = games.map(game => game.id);
      gameLines = gameLines.filter(item => gameIds.includes(item.id));

      let lines = [];
      for (let item of gameLines) {
        for (let line of item.lines) {
          lines.push({
            ...line,
            spread: Number(line.spread),
            spreadOpen: Number(line.spreadOpen),
            overUnder: Number(line.overUnder),
            overUnderOpen: Number(line.overUnderOpen),
            game: {
              id: item.id,
              title: `${item.awayTeam} @ ${item.homeTeam}`,
            },
            week: item.week,
            id: `${item.id}-${line.provider}`,
          });
        }
      }
      return {
        result: lines,
      };
    },
  },
});
