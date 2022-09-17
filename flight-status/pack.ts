import * as coda from "@codahq/packs-sdk";
import * as FlightDesignator from 'flight-designator';

export const pack = coda.newPack();

const BaseUrl = "https://us-central1-erickoleda-flight-status.cloudfunctions.net/flightStatus";
const DocIdHeader = "X-DocId";
const HourCacheTimeSecs = 60 * 60;
const DayCacheTimeSecs = HourCacheTimeSecs * 24;

const FlightPoint = coda.makeObjectSchema({
  properties: {
    airport: { type: coda.ValueType.String, fromKey: "iataCode" },
    localDate: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
    localTime: { type: coda.ValueType.String, codaType: coda.ValueHintType.Time },
    exactMoment: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
  },
  displayProperty: "airport",
});

const FlightSchema = coda.makeObjectSchema({
  properties: {
    summary: { type: coda.ValueType.String },
    scheduledDepartureDate: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
    from: FlightPoint,
    to: FlightPoint,
    duration: { type: coda.ValueType.String, codaType: coda.ValueHintType.Duration },
  },
  displayProperty: "summary",
});

// TODO: Deploy to dedicated hostname.
pack.addNetworkDomain("cloudfunctions.net");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

pack.addFormula({
  name: "FlightInfo",
  description: "Get information about a flight.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "flightNumber",
      description: "The flight number, including the carrier code. For example, B61497.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Date,
      name: "date",
      description: "The date of the flight.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: FlightSchema,
  execute: async function (args, context) {
    let [flightNumber, date] = args;
    if (!FlightDesignator.isValid(flightNumber)) {
      throw new coda.UserVisibleError("Invalid flight number: " + flightNumber);
    }
    let parts = FlightDesignator.parse(flightNumber);
    let localDate = formatDate(date, context.timezone);
    let url = coda.withQueryParams(BaseUrl, {
      carrierCode: parts.airlineCode,
      flightNumber: parts.flightNumber,
      scheduledDepartureDate: localDate,
    });
    let response;
    try {
      response = await context.fetcher.fetch({
        method: "GET",
        url,
        headers: {
          [DocIdHeader]: context.invocationLocation.docId || "123",
        },
        cacheTtlSecs: HourCacheTimeSecs,
      });
    } catch (error) {
      if (error.statusCode) {
        let statusError = error as coda.StatusCodeError;
        let detail = statusError.body?.errors?.[0]?.detail;
        if (detail) throw new coda.UserVisibleError(detail);
      }
      throw error;
    }
    let flights = response.body.data;
    if (!flights?.length) {
      throw new coda.UserVisibleError("No matching flight found.");
    }
    if (flights.length > 1) {
      throw new coda.UserVisibleError("More than one matching flight found.");
    }
    let flight = flights[0];
    console.log(JSON.stringify(flight.flightPoints));
    let from = formatFlightPoint(flight.flightPoints.shift());
    from = {
      ...from,
      ...await getAirport(from.aitaCode, context),
    };
    let to = formatFlightPoint(flight.flightPoints.pop());
    let durationMs = Date.parse(to.exactMoment) - Date.parse(from.exactMoment);
    let duration = `${Math.round(durationMs / 1000)} seconds`;
    // let diff = to.localDate > from.localDate ? "+" : to.localDate < from.localDate ? "-" : "";
    let summary = `${from.iataCode} -> ${to.iataCode}`;
    return {
      ...flight,
      from,
      to,
      duration,
      summary,
    };
  },
});

function formatDate(date, timezone) {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  let parts = formatter.formatToParts(date);
  let day = parts.find(part => part.type === "day").value;
  let month = parts.find(part => part.type === "month").value;
  let year = parts.find(part => part.type === "year").value;
  return `${year}-${month}-${day}`;
}

function formatFlightPoint(flightPoint) {
  let time = (flightPoint.departure || flightPoint.arrival)
    .timings
    .find(timing => timing.qualifier.startsWith("ST"))
    .value;
  let [localDate, localRest] = time.split("T");
  let localTime = localRest.split(/[+-]/)[0];

  return {
    ...flightPoint,
    localDate,
    localTime,
    exactMoment: time,
  };
}