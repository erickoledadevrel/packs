import * as sdk from "@superhuman/plugins-sdk";

const AttributionNodes: sdk.AttributionNode[] = [
  {
    type: sdk.AttributionNodeType.Image,
    imageUrl: "https://openflights.org/img/icon_favicon.png",
    anchorUrl: "https://openflights.org/",
  },
  {
    type: sdk.AttributionNodeType.Link,
    anchorText: "OpenFlights",
    anchorUrl: "https://openflights.org/",
  }
];

export const AirportSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the airport.",
    },
    city: {
      type: sdk.ValueType.String,
      description: "The city the airport is located in.",
    },
    country: {
      type: sdk.ValueType.String,
      description: "The country the airport is located in.",
    },
    IATA: {
      type: sdk.ValueType.String,
      description: "The IATA code for the airport.",
    },
    ICAO: {
      type: sdk.ValueType.String,
      description: "The ICAO code for the airport.",
    },
    latitude: {
      type: sdk.ValueType.Number,
      description: "The latitude of the airport.",
    },
    longitude: {
      type: sdk.ValueType.Number,
      description: "The longitude of the airport.",
    },
    altitude: {
      type: sdk.ValueType.Number,
      description: "The altitude (in feet) of the airport.",
    },
    timezone: {
      type: sdk.ValueType.String,
      description: "The timezone idenfier of the timezone the airport is located in.",
    },
    airportID: {
      type: sdk.ValueType.String,
      description: "The internal ID for the airport.",
    },
  },
  displayProperty: "name",
  idProperty: "airportID",
  featuredProperties: ["city", "country", "IATA", "ICAO"],
  attribution: AttributionNodes,
});

export const AirlineSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the airline.",
    },
    alias: {
      type: sdk.ValueType.String,
      description: "An alternative name for the airline, if one exists.",
    },
    country: {
      type: sdk.ValueType.String,
      description: "The country the airline is based out of.",
    },
    IATA: {
      type: sdk.ValueType.String,
      description: "The IATA code for the airline.",
    },
    ICAO: {
      type: sdk.ValueType.String,
      description: "The ICAO code for the airline.",
    },
    callsign: {
      type: sdk.ValueType.String,
      description: "The callsign of the airline.",
    },
    airlineID: {
      type: sdk.ValueType.String,
      description: "The internal ID for the airline.",
    },
  },
  displayProperty: "name",
  idProperty: "airlineID",
  featuredProperties: ["country", "IATA", "ICAO"],
  attribution: AttributionNodes,
});

export const FlightSchema = sdk.makeObjectSchema({
  properties: {
    designator: {
      type: sdk.ValueType.String,
      description: "The designator code (flight number) for the flight. This value will be formatted, and so may not match the input extactly.",
    },
    airline: AirlineSchema,
    number: {
      type: sdk.ValueType.Number,
      description: "The flight number.",
    },
    suffix: {
      type: sdk.ValueType.String,
      description: "The operation suffix for the flight, if it exists.",
    },
  },
  displayProperty: "designator",
});
