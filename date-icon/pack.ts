import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const DefaultIncludeDayOfWeek = false;
const DefaultHeaderColor = "#E64C3C";
const DefaultSize = 800;
const DaySecs = 24 * 60 * 60;

const DateParameter = coda.makeParameter({
  type: coda.ParameterType.Date,
  name: "date",
  description: "The date to use to populate the icon.",
});

const HeaderColorParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "headerColor",
  description: `The color of the icon header (where the month is), as a CSS color value ("blue" or "#EE5A29"). Default: ${DefaultHeaderColor}`,
  optional: true,
});

const SizeParameter = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "size",
  description: `The size of the image (width and height) in pixels. Default: ${DefaultSize}`,
  optional: true,
});

pack.addFormula({
  name: "DateIcon",
  description: "Generate an icon for the given date, including the month, day, and optionally day of the week.",
  parameters: [
    DateParameter,
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "includeDayOfWeek",
      description: `Whether or not to include the day of the week at the bottom. Default: ${DefaultIncludeDayOfWeek}`,
      optional: true,
    }),
    HeaderColorParameter,
    SizeParameter,
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  cacheTtlSecs: DaySecs,
  execute: async function (args, context) {
    let [
      date,
      includeDayOfWeek = DefaultIncludeDayOfWeek,
      headerColor = DefaultHeaderColor,
      size = DefaultSize,
    ] = args;

    // Create a formatter that outputs a numeric day, month, and year.
    let formatter = new Intl.DateTimeFormat("en", {
      timeZone: context.timezone, // Use the doc's timezone (important!)
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    // Format the date into individual parts.
    let parts = formatter.formatToParts(date);

    // Find the parts.
    let day = parts.find(part => part.type === "day").value;
    let month = parts.find(part => part.type === "month").value;
    let weekday = parts.find(part => part.type === "weekday").value;

    let svg = getSvg({
      header: month,
      content: day,
      footer: includeDayOfWeek ? weekday : undefined,
      headerColor: headerColor,
      size: size,
    });
    // Encode the markup as base64.
    let encoded = Buffer.from(svg.trim()).toString("base64");
    // Return the SVG as a data URL.
    return coda.SvgConstants.DataUrlPrefix + encoded;
  },
});

pack.addFormula({
  name: "MonthIcon",
  description: "Generate an icon for the given month, including the month and year.",
  parameters: [
    DateParameter,
    HeaderColorParameter,
    SizeParameter,
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  cacheTtlSecs: DaySecs,
  execute: async function (args, context) {
    let [
      date,
      headerColor = DefaultHeaderColor,
      size = DefaultSize,
    ] = args;

    // Create a formatter that outputs a numeric day, month, and year.
    let formatter = new Intl.DateTimeFormat("en", {
      timeZone: context.timezone, // Use the doc's timezone (important!)
      month: "long",
      year: "numeric",
    });

    // Format the date into individual parts.
    let parts = formatter.formatToParts(date);

    // Find the parts.
    let month = parts.find(part => part.type === "month").value;
    let year = parts.find(part => part.type === "year").value;

    let svg = getSvg({
      header: month,
      content: year,
      headerColor: headerColor,
      size: size,
    });
    // Encode the markup as base64.
    let encoded = Buffer.from(svg.trim()).toString("base64");
    // Return the SVG as a data URL.
    return coda.SvgConstants.DataUrlPrefix + encoded;
  },
});

function getSvg(options: SvgOptions): string {
  let {
    header,
    content,
    footer,
    headerColor,
    size = 800,
  } = options;
  let y = 80;
  let fontSize = 45;
  if (content.length > 2) {
    y -= 5;
    fontSize = 35;
  }
  if (footer) {
    y -= 5;
  }
  if (!headerColor) {
    headerColor = DefaultHeaderColor;
  }
  return `
    <?xml version="1.0" encoding="utf-8"?>
    <svg width="${size}px" height="${size}px" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EBEDED" d="M100 95a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5h90a5 5 0 0 1 5 5v90z"/>
      <path fill="#D4D7DA" d="M95 97H5a5 5 0 0 1-5-5v3a5 5 0 0 0 5 5h90a5 5 0 0 0 5-5v-3a5 5 0 0 1-5 5z"/>
      <path fill="${headerColor}" d="M0 31V5a5 5 0 0 1 5-5h90a5 5 0 0 1 5 5v26H0z"/>
      <path fill="#000000" opacity="20%" d="M0 28h100v2.75H0z"/>
      <text fill="#FFFFFF" text-anchor="middle" x="50" y="20" font-family="Arial" font-weight="bold">${header}</text>
      <text fill="#35495E" text-anchor="middle" x="50" y="${y}" font-size="${fontSize}" font-family="Arial" font-weight="bold">${content}</text>
      <text fill="#35495E" text-anchor="middle" x="50" y="90" font-size="10" font-family="Arial" font-weight="bold">${footer ?? ""}</text>
    </svg>
  `;
}

interface SvgOptions {
  header: string;
  content: string;
  footer?: string;
  headerColor?: string;
  size?: number;
}
