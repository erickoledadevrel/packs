import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

const DefaultSize = 16;

pack.addFormula({
  name: "Favicon",
  description: "Get the favicon (tab icon) for the provided website.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "url",
      description: "The URL or domain of the website.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "size",
      description: [
        "The size of the image to return, in pixels.",
        "Available sizes are 16, 32, 64, 128, 256.",
        "Not all sizes are supported for all URLs.",
        "When the URL doesn't support a given size it will fall back to a smaller one.",
        "Default: " + DefaultSize,
      ].join(" "),
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  examples: [
    { params: ["pokemon.com"], result: "<image>" },
    { params: ["https://www.pokemon.com/us/"], result: "<image>" },
    { params: ["pokemon.com", 32], result: "<image>" },
  ],
  execute: async function (args, context) {
    let [url, size = DefaultSize] = args;
    if (!url) {
      url = "_"; // Placeholder to generate generic image.
    }
    return `https://www.google.com/s2/favicons?domain=${url}&sz=${size}`;
  }
});

pack.addColumnFormat({
  name: "Favicon",
  instructions: "Enter a domain or URL to get it's favicon image.",
  formulaName: "Favicon",
});