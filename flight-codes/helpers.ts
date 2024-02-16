import * as coda from "@codahq/packs-sdk";
import { parse } from "but-csv";
import { OneDaySecs } from "./constants";

const AirportDataUrl = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";
const AirportColumns = [
  "airportID", // Not used.
  "name",
  "city",
  "country",
  "IATA",
  "ICAO",
  "latitude",
  "longitude",
  "altitude",
  "tz_offset", // Not used.
  "DST", // Not used.
  "timezone",
  "type", // Not used.
  "source", // Not used.
];
const AirportNumberColumns = ["latitude", "longitude", "altitude"];

const AirlineDataUrl = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";
const AirlineColumns = [
  "airlineID", // Not used.
  "name",
  "alias",
  "IATA",
  "ICAO",
  "callsign",
  "country",
  "active",
];
const AirlineBooleanColumns = ["active"];

export async function getAirports(context: coda.ExecutionContext): Promise<any> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: AirportDataUrl,
    cacheTtlSecs: OneDaySecs,
  });
  let csv = response.body.trim();
  let rows = parse(csv);
  return rows.map(row => {
    let result = {};
    for (let [i, column] of AirportColumns.entries()) {
      result[column] = row[i];
      if (AirportNumberColumns.includes(column)) {
        result[column] = Number(result[column]);
      }
    }
    return result;
  });
}

export async function getAirlines(context: coda.ExecutionContext): Promise<any> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: AirlineDataUrl,
    cacheTtlSecs: OneDaySecs,
  });
  let csv = response.body;
  csv = csv.replace(/\\\N/g, "").trim();
  let rows = parse(csv);
  return rows.map(row => {
    let result = {};
    for (let [i, column] of AirlineColumns.entries()) {
      result[column] = row[i];
      if (AirlineBooleanColumns.includes(column)) {
        result[column] = Boolean(result[column]);
      }
    }
    return result;
  });
}

export async function getAirline(context: coda.ExecutionContext, code: string): Promise<any> {
  code = code.toUpperCase();
  let airlines = await getAirlines(context);
  let result;
  if (code.length == 2) {
    result = airlines.find(airline => airline.IATA == code);
  } else if (code.length == 3) {
    result = airlines.find(airline => airline.ICAO == code);
  }
  if (!result) {
    throw new coda.UserVisibleError(`Invalid airline code: ${code}`);
  }
  return result;
}
