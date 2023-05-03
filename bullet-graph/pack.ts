import * as coda from "@codahq/packs-sdk";

const MinLightness = 60;
const MaxLightness = 90;
const DefaultHue = 0;
const DefaultSaturation = 0;

export const pack = coda.newPack();

pack.addFormula({
  name: "BulletGraph",
  description: "Generate an image of a bullet graph.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "min",
      description: "The minimum value of the metric.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "max",
      description: "The maximum value of the metric.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "current",
      description: "The current value of the metric.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "target",
      description: "The target value of the metric.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.NumberArray,
      name: "thresholds",
      description: "A list of values that represent meaningful thresholds for the metric.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "markerDistance",
      description: "The distance between markers on the graph. Default: half of the total range.",
      optional: true,
    }), 
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "hue",
      description: `The hue (color) of the graph background, as a number between 0 and 360. Default: ${DefaultHue}.`,
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "saturation",
      description: `The saturation of the graph background, as a number between 0 and 100. Default: ${DefaultSaturation}.`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  execute: async function (args, context) {
    let [
      min, max, current, target, 
      thresholds = [], 
      markerDistance, 
      hue = DefaultHue, 
      saturation = DefaultSaturation
    ] = args;

    if (min >= max) {
      throw new coda.UserVisibleError("The min value must be less than the max value.");
    }
    if (current > max || current < min) {
      throw new coda.UserVisibleError("The current value must be between the min and max values.");
    }
    if (target > max || target < min) {
      throw new coda.UserVisibleError("The target value must be between the min and max values.");
    }
    if (hue < 0 || hue > 360) {
      throw new coda.UserVisibleError("The hue must be between 0 and 360.");
    }
    if (saturation < 0 || saturation > 100) {
      throw new coda.UserVisibleError("The saturation must be between 0 and 100.");
    }
    if (markerDistance <= 0) {
      throw new coda.UserVisibleError("The market distance must be a positive number.");
    }
    for (let threshold of thresholds) {
      if (threshold > max || threshold < min) {
        throw new coda.UserVisibleError("All thresholds value must be between the min and max values.");
      }
    }
    
    let svg = getSvg(min, max, current, target, thresholds, markerDistance, hue, saturation);
    // Encode the markup as base64.
    let encoded = Buffer.from(svg).toString("base64");
    // Return the SVG as a data URL.
    return coda.SvgConstants.DataUrlPrefix + encoded;
  },
});

function getSvg(min, max, current, target, thresholds, markerDistance, hue, saturation) {
  let currentPercentage = getPercentage(current, min, max);
  let targetPercentage = getPercentage(target, min, max);

  let thresholdRects = getThresholdBars(min, max, thresholds, hue, saturation);
  let scaleMarkers = getScaleMarkers(min, max, markerDistance);

  return `
    <?xml version="1.0" encoding="iso-8859-1"?>
    <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
      viewBox="-5 0 110 18" xml:space="preserve">
      <style>
        text { font-family: Monaco }
      </style>
      <!-- Thresholds -->
      ${thresholdRects.join("")}

      <!-- Current -->
      <rect width="${currentPercentage}" height="3" y="3" fill="#000" />

      <!-- Target -->
      <rect x="${targetPercentage}" width="1" height="7" y="1" fill="#000" />
      
      <!-- Markers -->
      ${scaleMarkers.join("")}
    </svg>
  `.trim();
}

function getThresholdBars(min, max, thresholds, hue, saturation) {
  let rangeRects = [
    `<rect width="100" height="9" fill="hsl(${hue}, ${saturation}%, ${MaxLightness}%)" />`
  ];
  for (let [i, range] of thresholds.sort((a, b) => b - a).entries()) {
    let rangePercentage = getPercentage(range, min, max);
    let lightness = MaxLightness - (((MaxLightness - MinLightness) / thresholds.length) * (i + 1));
    console.log(lightness);
    rangeRects.push(
      `<rect width="${rangePercentage}" height="9" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" />`
    );
  }
  return rangeRects;
}

function getScaleMarkers(min, max, markerDistance) {
  if (!markerDistance) {
    markerDistance = (max - min) / 2;
  }
  let result = [
    // Min
    `
      <rect width="0.2" height="2" x="0" y="10" fill="#000" />
      <text x="${0 - String(min).length}" y="16" baseline="top" font-size="4">${min}</text>
    `,
    // Max
    `
      <rect width="0.2" height="2" x="100" y="10" fill="#000" />
      <text x="${100 - String(max).length}" y="16" baseline="top" font-size="4">${max}</text>
    `,
  ];
  for (let i = min + markerDistance; i < max; i += markerDistance) {
    let markerPercentage = getPercentage(i, min, max);
    let textX = markerPercentage - String(i).length;
    result.push(`
      <rect width="0.2" height="2" x="${markerPercentage}" y="10" fill="#000" />
      <text x="${textX}" y="16" baseline="top" font-size="4">${i}</text>
    `);
  }
  return result;
}

function getPercentage(num, min, max) {
  return Math.round((num - min) / (max - min) * 100);
}