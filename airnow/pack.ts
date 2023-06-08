import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const BaseUrl = "https://www.airnowapi.org/aq/observation/zipCode/current/";
const DefaultParameter = "PM2.5";
const AllParameters = ["PM2.5", "PM10", "O3"];
const DefaultCacheSeconds = 15 * 60;
const CatgegoryColors = {
  // Good
  1: ["#00E400", "black"],

  // Moderate
  2: ["#FFFF00", "black"],

  // Unhealthy for Sensitive Groups
  3: ["#FF7E00", "white"],

  // Unhealthy
  4: ["#FF0000", "white"],

  // Very Unhealthy
  5: ["#8f3f97", "white"],

  // Hazardous
  6: ["#7E0023", "white"],

  // Unavailable
  7: ["#CCC", "black"],
};

pack.addNetworkDomain("airnowapi.org");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.QueryParamToken,
  paramName: "API_KEY",
});

const AQISchema = coda.makeObjectSchema({
  properties: {
    summary: {
      type: coda.ValueType.String,
      description: "A summary of the AQI measurement.",
    },
    location: {
      type: coda.ValueType.String,
      description: "The location where the measurement was made. This will be the closest location to the supplied zip code where data is available.",
    },
    time: {
      type: coda.ValueType.String,
      description: "The hour (local time) that the measurement was made.",
    },
    parameter: {
      type: coda.ValueType.String,
      description: "The parameter measured.",
      fromKey: "ParameterName",
    },
    value: {
      type: coda.ValueType.Number,
      description: "The value of the parameter measured.",
      fromKey: "AQI",
    },
    category: {
      type: coda.ValueType.String,
      description: "The risk category that the value falls within.",
    },
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "A link the AirNow.gov website for this location.",
    },
    icon: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "An icon representing the AQI.",
    },
  },
  displayProperty: "summary",
  titleProperty: "category",
  subtitleProperties: [
    { property: "parameter", label: "" },
    { property: "location", label: "" },
    { property: "time", label: "" },
  ],
  linkProperty: "link",
  imageProperty: "icon",
});

pack.addFormula({
  name: "LatestAQI",
  description: "Gets the latest Air Quality Index (AQI) for the provided zip code.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "zipcode",
      description: "The zip code of the target location.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "parameter",
      description: `Which parameter to retrieve. Default: ${DefaultParameter}`,
      optional: true,
      autocomplete: AllParameters,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "now",
      description: "The current hour, used to refresh the data automatically. Enter the formula: Hour(Now())",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: AQISchema,
  cacheTtlSecs: DefaultCacheSeconds,
  execute: async function (args, context) {
    let [
      zipcode,
      parameter = DefaultParameter,
    ] = args;
    if (!AllParameters.includes(parameter)) {
      throw new coda.UserVisibleError(`Invalid parameter: ${parameter}`);
    }

    let url = coda.withQueryParams(BaseUrl, {
      format: "application/json",
      zipCode: zipcode,
      distance: 100,
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
      cacheTtlSecs: DefaultCacheSeconds,
    });
    let items = response.body;

    if (!items?.length) {
      throw new coda.UserVisibleError(`No data available for zip code: ${zipcode}`);
    }
    let item = items.find(item => item.ParameterName == parameter);

    let hour = item.HourObserved % 12;
    if (hour == 0) hour = 12;
    let ampm = item.HourObserved < 12 ? "am": "pm";
    let link = coda.withQueryParams("https://www.airnow.gov/", {
      reportingArea: item.ReportingArea,
      stateCode: item.StateCode,
    });

    return {
      ...item,
      summary: `${item.AQI} (${item.Category.Name})`,
      location: `${item.ReportingArea}, ${item.StateCode}`,
      time: `${hour}${ampm}`,
      category: item.Category.Name,
      link: link,
      icon: getImageUrl(item.AQI, item.Category.Number),
    };
  },
});

function getImageUrl(value, categoryNumber) {
  let [backgroundColor, textColor] = CatgegoryColors[categoryNumber];
  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="50px">
    <g>
      <circle style="fill:${backgroundColor}" cx="250" cy="250" r="245"></circle>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em"
            font-size="200" font-weight="bold" font-family="monospace"
            fill="${textColor}">
        ${value}
      </text>
    </g>
  </svg>
  `;
  let encoded = Buffer.from(svg).toString("base64");
  return coda.SvgConstants.DataUrlPrefix + encoded;
}
