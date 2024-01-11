import * as coda from "@codahq/packs-sdk";

const CommonSchema = coda.makeObjectSchema({
  properties: {
    // API
    backdrop: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "backdrop_path",
    },
    genres: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    homepage: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    id: { type: coda.ValueType.Number },
    overview: { type: coda.ValueType.String },
    poster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "poster_path",
    },
    status: { type: coda.ValueType.String },
    tagline: { type: coda.ValueType.String },

    // Synthetic
    details: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
    },
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    rating: { type: coda.ValueType.String },
  },
  displayProperty: undefined,
  titleProperty: undefined,
  snippetProperty: "details",
  imageProperty: "poster",
  linkProperty: "link",
  subtitleProperties: undefined,
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

export const MovieSchema = coda.makeObjectSchema({
  ...CommonSchema,
  properties: {
    ...CommonSchema.properties,

    // API
    budget: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
    },
    release_date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    revenue: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Currency,
    },
    runtime: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Duration,
    },
    title: { type: coda.ValueType.String },
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

export const ShowSchema = coda.makeObjectSchema({
  ...CommonSchema,
  properties: {
    ...CommonSchema.properties,

    // API
    first_air_date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    last_air_date: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    name: { type: coda.ValueType.String },
    number_of_episodes: { type: coda.ValueType.Number },
    number_of_seasons: { type: coda.ValueType.Number },
    type: { type: coda.ValueType.String },
  },
  displayProperty: "name",
  titleProperty: "name",
  subtitleProperties: [
    { property: "rating", label: "" },
    { property: "genres", label: "" },
  ],
});
