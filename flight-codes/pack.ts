import * as coda from "@codahq/packs-sdk";
import { OneDaySecs } from "./constants";
import { getAirports, getAirline } from "./helpers";
import { AirportSchema, AirlineSchema, FlightSchema } from "./schemas";
var FlightDesignator = require("flight-designator");

export const pack = coda.newPack();

pack.addNetworkDomain("githubusercontent.com");

pack.addFormula({
  name: "Airport",
  description: "Get information about an airport given it's identification code.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "code",
      description: "The IATA or ICAO code of the airport.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: AirportSchema,
  cacheTtlSecs: OneDaySecs,
  examples: [
    {
      params: ["JFK"],
      result: {
        name: "John F Kennedy International Airport",
        city: "New York",
        country: "United States",
        IATA: "JFK",
        ICAO: "KJFK",
        latitude: 40.63980103,
        longitude: -73.77890015,
        altitude: 13,
        timezone: "America/New_York",
      },
    },
  ],
  execute: async function (args, context) {
    let [code] = args;
    if (!code) {
      throw new coda.UserVisibleError("Airline code cannot be blank.");
    }
    code = code.toUpperCase();
    let airports = await getAirports(context);
    let result;
    if (code.length == 3) {
      result = airports.find(airport => airport.IATA == code);
    } else if (code.length == 4) {
      result = airports.find(airport => airport.ICAO == code);
    }
    if (!result) {
      throw new coda.UserVisibleError(`Invalid airport code: ${code}`);
    }
    return result;
  },
});

pack.addFormula({
  name: "Airline",
  description: "Get information about an airline given it's identification code.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "code",
      description: "The IATA or ICAO code of the airline.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: AirlineSchema,
  cacheTtlSecs: OneDaySecs,
  examples: [
    {
      params: ["B6"],
      result: {
        name: "JetBlue Airways",
        country: "United States",
        IATA: "B6",
        ICAO: "JBU",
        callsign: "JETBLUE",
      },
    },
  ],
  execute: async function (args, context) {
    let [code] = args;
    if (!code) {
      throw new coda.UserVisibleError("Airline code cannot be blank.");
    }
    return await getAirline(context, code);
  },
});

pack.addFormula({
  name: "Flight",
  description: "Parses the flight designator (flight number) into its component parts and gets information about the airline.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "designator",
      description: "The designator code for a flight.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: FlightSchema,
  cacheTtlSecs: OneDaySecs,
  examples: [
    {
      params: ["B61527"],
      result: {
        designator: "B61527",
        airline: {
          name: "JetBlue Airways",
          country: "United States",
          IATA: "B6",
          ICAO: "JBU",
          callsign: "JETBLUE",
        },
        number: 1527,
      },
    },
  ],
  execute: async function (args, context) {
    let [designator] = args;
    if (!designator) {
      throw new coda.UserVisibleError("Flight designator cannot be blank.");
    }
    if (!FlightDesignator.isValid(designator)) {
      throw new coda.UserVisibleError(`Invalid flight designator: ${designator}`);
    }
    let parts = FlightDesignator.parse(designator);
    let airline = await getAirline(context, parts.airlineCode);
    return {
      designator: FlightDesignator.format(designator),
      airline: airline,
      number: parts.flightNumber,
      suffix: parts.operationalSuffix,
    };
  },
});

pack.addColumnFormat({
  name: "Airport",
  formulaName: "Airport",
  instructions: "Enter the IATA or ICAO code of an airport to get information about it.",
});

pack.addColumnFormat({
  name: "Airline",
  formulaName: "Airline",
  instructions: "Enter the IATA or ICAO code of an airline to get information about it.",
});

pack.addColumnFormat({
  name: "Flight",
  formulaName: "Flight",
  instructions: "Enter the designator (AKA flight number) of a flight to get information about it.",
});
