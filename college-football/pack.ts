import * as coda from "@codahq/packs-sdk";

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

const Attribution: coda.AttributionNode[] = [
  {
    type: coda.AttributionNodeType.Image,
    imageUrl: "https://collegefootballdata.com/LetterLogo.png",
    anchorUrl: "https://collegefootballdata.com"
  },
  {
    type: coda.AttributionNodeType.Link,
    anchorText: "CollegeFootballData.com",
    anchorUrl: "https://collegefootballdata.com",
  },
];

const TeamSchema = coda.makeObjectSchema({
  properties: {
    school: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.Number, required: true },
    mascot: { type: coda.ValueType.String },
    abbreviation: { type: coda.ValueType.String },
    division: { type: coda.ValueType.String, fromKey: "classification" },
    conference: { type: coda.ValueType.String },
    color: { type: coda.ValueType.String },
    alt_color: { type: coda.ValueType.String },
    logo: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    // TODO: location
  },
  displayProperty: "school",
  idProperty: "id",
  featuredProperties: [
    "logo", "abbreviation", "conference", "mascot"
  ],
  attribution: Attribution,
});

const TeamReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(TeamSchema, "Team");

const GameSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String },
    id: { type: coda.ValueType.Number },
    home: TeamReferenceSchema,
    away: TeamReferenceSchema,
    start: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime, fromKey: "start_date" },
    week: { type: coda.ValueType.String },
    completed: { type: coda.ValueType.Boolean },
    conference_game: { type: coda.ValueType.Boolean },
    // TODO: venue
    home_points: { type: coda.ValueType.Number },
    home_line_scores: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.Number },
    },
    away_points: { type: coda.ValueType.Number },
    away_line_scores: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.Number },
    },
  },
  displayProperty: "title",
  idProperty: "id",
  featuredProperties: [
    "week", "away", "away_points", "home", "home_points"
  ],
  attribution: Attribution,
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
      let url = coda.withQueryParams("https://api.collegefootballdata.com/games", {
        year: year,
        division: division?.toLocaleLowerCase(),
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let games = response.body;
      if (conferences) {
        games = games.filter(game => conferences.includes(game.home_conference) || conferences.includes(game.away_conference));
      }
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

async function getConferences(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.collegefootballdata.com/conferences",
  });
  let conferences = response.body;
  return conferences;
}
