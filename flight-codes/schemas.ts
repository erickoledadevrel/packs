import * as coda from "@codahq/packs-sdk";

const AttributionNodes: coda.AttributionNode[] = [
  {
    type: coda.AttributionNodeType.Image,
    imageUrl: "https://openflights.org/img/icon_favicon.png",
    anchorUrl: "https://openflights.org/",
  },
  {
    type: coda.AttributionNodeType.Link,
    anchorText: "OpenFlights",
    anchorUrl: "https://openflights.org/",
  }
];

export const AirportSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the airport.",
    },
    city: {
      type: coda.ValueType.String,
      description: "The city the airport is located in.",
    },
    country: {
      type: coda.ValueType.String,
      description: "The country the airport is located in.",
    },
    IATA: {
      type: coda.ValueType.String,
      description: "The IATA code for the airport.",
    },
    ICAO: {
      type: coda.ValueType.String,
      description: "The ICAO code for the airport.",
    },
    latitude: {
      type: coda.ValueType.Number,
      description: "The latitude of the airport.",
    },
    longitude: {
      type: coda.ValueType.Number,
      description: "The longitude of the airport.",
    },
    altitude: {
      type: coda.ValueType.Number,
      description: "The altitude (in feet) of the airport.",
    },
    timezone: {
      type: coda.ValueType.String,
      description: "The timezone idenfier of the timezone the airport is located in.",
    },
  },
  displayProperty: "name",
  attribution: AttributionNodes,
});

export const AirlineSchema = coda.makeObjectSchema({
  properties: {
    name: {
      type: coda.ValueType.String,
      description: "The name of the airline.",
    },
    alias: {
      type: coda.ValueType.String,
      description: "An alternative name for the airline, if one exists.",
    },
    country: {
      type: coda.ValueType.String,
      description: "The country the airline is based out of.",
    },
    IATA: {
      type: coda.ValueType.String,
      description: "The IATA code for the airline.",
    },
    ICAO: {
      type: coda.ValueType.String,
      description: "The ICAO code for the airline.",
    },
    callsign: {
      type: coda.ValueType.String,
      description: "The callsign of the airline.",
    },
  },
  displayProperty: "name",
  attribution: AttributionNodes,
});

export const FlightSchema = coda.makeObjectSchema({
  properties: {
    designator: {
      type: coda.ValueType.String,
      description: "The designator (flight number) for the flight. This value will be formatted, and so may not match the input extactly.",
    },
    airline: AirlineSchema,
    number: {
      type: coda.ValueType.Number,
      description: "The flight number.",
    },
    suffix: {
      type: coda.ValueType.String,
      description: "The operation suffix for the flight, if it exists.",
    },
  },
  displayProperty: "designator",
});
