import * as sdk from "@superhuman/plugins-sdk";

const CommonSchema = sdk.makeObjectSchema({
  properties: {
    // API
    backdrop: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "backdrop_path",
    },
    genres: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String },
    },
    homepage: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
    },
    id: { type: sdk.ValueType.Number },
    overview: { type: sdk.ValueType.String },
    poster: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "poster_path",
    },
    status: { type: sdk.ValueType.String },
    tagline: { type: sdk.ValueType.String },

    // Synthetic
    details: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Html,
    },
    link: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
    },
    rating: { type: sdk.ValueType.String },
  },
  displayProperty: undefined,
  titleProperty: undefined,
  snippetProperty: "details",
  imageProperty: "poster",
  linkProperty: "link",
  subtitleProperties: undefined,
  attribution: [
    {
      type: sdk.AttributionNodeType.Image,
      imageUrl: "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg",
      anchorUrl: "https://www.themoviedb.org",
    },
    {
      type: sdk.AttributionNodeType.Link,
      anchorText: "The Movie Database (TMDB)",
      anchorUrl: "https://www.themoviedb.org",
    }
  ],
});

export const MovieSchema = sdk.makeObjectSchema({
  ...CommonSchema,
  properties: {
    ...CommonSchema.properties,

    // API
    budget: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Currency,
    },
    release_date: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    revenue: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Currency,
    },
    runtime: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Duration,
    },
    title: { type: sdk.ValueType.String },

    // Synthetic
    trailer: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
    },
  },
  displayProperty: "title",
  titleProperty: "title",
  subtitleProperties: [
    { property: "rating", label: "" },
    { property: "release_date", label: "" },
    { property: "genres", label: "" },
    { property: "runtime", label: "" },
  ],
});

export const ShowSchema = sdk.makeObjectSchema({
  ...CommonSchema,
  properties: {
    ...CommonSchema.properties,

    // API
    first_air_date: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    last_air_date: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Date,
    },
    name: { type: sdk.ValueType.String },
    number_of_episodes: { type: sdk.ValueType.Number },
    number_of_seasons: { type: sdk.ValueType.Number },
    type: { type: sdk.ValueType.String },
  },
  displayProperty: "name",
  titleProperty: "name",
  subtitleProperties: [
    { property: "rating", label: "" },
    { property: "genres", label: "" },
  ],
});
