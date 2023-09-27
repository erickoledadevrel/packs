import * as coda from "@codahq/packs-sdk";

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

export const TeamSchema = coda.makeObjectSchema({
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

export const GameSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.Number, required: true },
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

const GameReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(GameSchema, "Game");

export const LineSchema = coda.makeObjectSchema({
  properties: {
    label: { type: coda.ValueType.String, fromKey: "formattedSpread" },
    id: { type: coda.ValueType.String },
    provider: { type: coda.ValueType.String },
    game: GameReferenceSchema,
    week: { type: coda.ValueType.Number },
    spread: { type: coda.ValueType.Number },
    overUnder: { type: coda.ValueType.Number },
    overUnderOpen: { type: coda.ValueType.Number },
    homeMoneyline: { type: coda.ValueType.Number },
    awayMoneyline: { type: coda.ValueType.Number },
  },
  displayProperty: "label",
  idProperty: "id",
  featuredProperties: [
    "provider", "week", "game", "spread", "overUnder", "homeMoneyline", "awayMoneyline"
  ],
  attribution: Attribution,
});
