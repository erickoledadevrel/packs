import * as sdk from "@superhuman/plugins-sdk";

const Attribution: sdk.AttributionNode[] = [
  {
    type: sdk.AttributionNodeType.Image,
    imageUrl: "https://collegefootballdata.com/LetterLogo.png",
    anchorUrl: "https://collegefootballdata.com"
  },
  {
    type: sdk.AttributionNodeType.Link,
    anchorText: "CollegeFootballData.com",
    anchorUrl: "https://collegefootballdata.com",
  },
];

export const TeamSchema = sdk.makeObjectSchema({
  properties: {
    school: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.Number, required: true },
    mascot: { type: sdk.ValueType.String },
    abbreviation: { type: sdk.ValueType.String },
    division: { type: sdk.ValueType.String, fromKey: "classification" },
    conference: { type: sdk.ValueType.String },
    color: { type: sdk.ValueType.String },
    alt_color: { type: sdk.ValueType.String },
    logo: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    // TODO: location
  },
  displayProperty: "school",
  idProperty: "id",
  featuredProperties: [
    "logo", "abbreviation", "conference", "mascot"
  ],
  attribution: Attribution,
});

const TeamReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(TeamSchema, "Team");

export const GameSchema = sdk.makeObjectSchema({
  properties: {
    title: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.Number, required: true },
    home: TeamReferenceSchema,
    away: TeamReferenceSchema,
    start: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime, fromKey: "start_date" },
    week: { type: sdk.ValueType.String },
    completed: { type: sdk.ValueType.Boolean },
    conference_game: { type: sdk.ValueType.Boolean },
    // TODO: venue
    home_points: { type: sdk.ValueType.Number },
    home_line_scores: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.Number },
    },
    away_points: { type: sdk.ValueType.Number },
    away_line_scores: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.Number },
    },
  },
  displayProperty: "title",
  idProperty: "id",
  featuredProperties: [
    "week", "away", "away_points", "home", "home_points"
  ],
  attribution: Attribution,
});

const GameReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(GameSchema, "Game");

export const LineSchema = sdk.makeObjectSchema({
  properties: {
    label: { type: sdk.ValueType.String, fromKey: "formattedSpread" },
    id: { type: sdk.ValueType.String },
    provider: { type: sdk.ValueType.String },
    game: GameReferenceSchema,
    week: { type: sdk.ValueType.Number },
    spread: { type: sdk.ValueType.Number },
    overUnder: { type: sdk.ValueType.Number },
    overUnderOpen: { type: sdk.ValueType.Number },
    homeMoneyline: { type: sdk.ValueType.Number },
    awayMoneyline: { type: sdk.ValueType.Number },
  },
  displayProperty: "label",
  idProperty: "id",
  featuredProperties: [
    "provider", "week", "game", "spread", "overUnder", "homeMoneyline", "awayMoneyline"
  ],
  attribution: Attribution,
});
