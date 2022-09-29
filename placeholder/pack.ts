import * as coda from "@codahq/packs-sdk";
import CSSColorList from 'css-named-colors';

export const pack = coda.newPack();

const BasicParameters = ["width", "height"];
const AdvancedParameters = ["text", "backgroundColor", "textColor"];

const PlaceholderServices: Record<string, any> = {
  // Generic images.
  "dummyimage.com": {
    supports: ["ratio"].concat(BasicParameters, AdvancedParameters),
    transform: args => getPlaceholderImage("dummyimage.com", args),
  },
  "placeholder.com": {
    supports: [].concat(BasicParameters, AdvancedParameters), 
    transform: args => getPlaceholderImage("via.placeholder.com", args),
  },
  "fakeimg.pl": {
    supports: [].concat(BasicParameters, AdvancedParameters), 
    transform: args => getPlaceholderImage("fakeimg.pl", args),
  },
  
  // Animals
  "placekitten.com": ({width, height}) => `https://placekitten.com/${width}/${height}`,
  "placebear.com": ({width, height}) => `https://placebear.com/${width}/${height}`,
  
   // Photos
  "placeimg.com": ({width, height}) => `https://placeimg.com/${width}/${height}`,
  "picsum.photos": ({width, height}) => `https://picsum.photos/${width}/${height}`,

  // People
  "fillmurray.com": ({width, height}) => `https://www.fillmurray.com/${width}/${height}`,
  "stevensegallery.com": ({width, height}) => `https://www.stevensegallery.com/${width}/${height}`,
  "placecage.com": ({width, height}) => `https://www.placecage.com/${width}/${height}`,

  // Other
  "placebeard.it": ({width, height}) => `https://placebeard.it/${width}/${height}`,
  "baconmockup.com": ({width, height}) => `https://baconmockup.com/${width}/${height}`,
};

const DefaultService = "dummyimage.com";

pack.addFormula({
  name: "Placeholder",
  description: "Create a placeholder image.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "width",
      description: "The width of the placeholder image, in pixels.",
      suggestedValue: "400",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "height",
      description: "The height of the placeholder image, in pixels.",
      suggestedValue: "300",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "service",
      description: `Which placeholder image service to use. Default: ${DefaultService}.`,
      optional: true,
      autocomplete: Object.keys(PlaceholderServices),
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: `The text to show in the placeholder image. Default: the image dimensions. Supported by: ${supportedBy("text")}.`,
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "backgroundColor",
      description: `The background color of the placeholder image, as a 6-digit hex color. Supported by: ${supportedBy("backgroundColor")}.`,
      optional: true,
      autocomplete: async function (context, search, parameters) {
        return coda.autocompleteSearchObjects(search, CSSColorList, "name", "hex");
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "textColor",
      description: `The text color of the placeholder image, as a 6-digit hex color. Supported by: ${supportedBy("textColor")}.`,
      optional: true,
      autocomplete: async function (context, search, parameters) {
        return coda.autocompleteSearchObjects(search, CSSColorList, "name", "hex");
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "ratio",
      description: `The width to height ratio of the placeholder image. Takes precedence over height. Supported by: ${supportedBy("ratio")}`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageAttachment,
  examples: [
    {params: [600, 300], result: "https://dummyimage.com/600x300"},
    {params: [600, 300, undefined, "Product photo here"], result: "https://dummyimage.com/600x300?text=Product%20photo%20here"},
    {params: [600, 300, undefined, undefined, "#ff0000", "#00ff00"], result: "https://dummyimage.com/600x300/ff0000/00ff00"},
    {params: [600, 300, undefined, undefined, undefined, undefined, "4:3"], result: "https://dummyimage.com/600x4:3"},
    {params: [600, 300, "placekitten.com"], result: "https://placekitten.com/600/300"},
  ],
  execute: async function (args, context) {
    let [width, height, service = DefaultService, text, backgroundColor, textColor, ratio] = args;
    let params = {width, height, text, backgroundColor, textColor, ratio};

    let settings = PlaceholderServices[service];
    if (!settings) {
      throw new coda.UserVisibleError("Invalid service: " + service)
    }

    let supports = settings.supports || BasicParameters;
    for (let [key, value] of Object.entries(params)) {
      if (value && !supports.includes(key)) {
        throw new coda.UserVisibleError(`Service ${service} doesn't support the parameter "${key}".`);
      }
    }

    let transform = settings.transform || settings;
    return transform({width, height, text, backgroundColor, textColor, ratio});
  },
});

function getPlaceholderImage(domain, {width, height, ratio, text, backgroundColor, textColor}) {
  if (textColor && !backgroundColor) {
    throw new coda.UserVisibleError("When setting the textColor you must also set the backgroundColor.")
  }
  if (backgroundColor?.startsWith("#")) {
    backgroundColor = backgroundColor.substring(1);
  }
  if (textColor?.startsWith("#")) {
    textColor = textColor.substring(1);
  }

  let url = `https://${domain}/${width}x${ratio || height}`;
  if (backgroundColor) {
    url = coda.joinUrl(url, backgroundColor);
  }
  if (textColor) {
    url = coda.joinUrl(url, textColor);
  }
  url = coda.withQueryParams(url, {
    text,
  });
  return url;
}

function supportedBy(parameter) {
  return Object.entries(PlaceholderServices).filter(([_, settings]) => {
    let supports = settings.supports || BasicParameters;
    return supports.includes(parameter);
  })
  .map(([service]) => service)
  .join(", ");
}