import * as coda from "@codahq/packs-sdk";
import * as LZString from 'lz-string';

const EmbedUrl = "https://packs.erickoleda.com/gallery/";

export const pack = coda.newPack();

pack.addFormula({
  name: "PhotoGallery",
  description: "Embeds a photo gallery from a list of images.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseImageArray,
      name: "photos",
      description: "The list of photos to display in the gallery.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "backgroundColor",
      description: "The background color of the gallery. Default: #1a1a1a.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "foregroundColor",
      description: "The foreground color of the gallery (text, buttons). Default: white.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  schema: {
    type: coda.ValueType.String,
    codaType: coda.ValueHintType.Embed,
    force: true,
  },
  execute: async function (args, context) {
    let [photos, backgroundColor, foregroundColor] = args;
    let urls = photos.filter(Boolean).join(",");
    let encoded = LZString.compressToEncodedURIComponent(urls);
    return coda.withQueryParams(EmbedUrl, {
      e: encoded,
      bc: backgroundColor,
      fc: foregroundColor,
    });
  },
});