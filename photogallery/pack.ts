import * as sdk from "@superhuman/plugins-sdk";
import * as lzma1 from 'lzma1';

const EmbedUrl = "https://packs.erickoleda.com/gallery/";

export const pack = sdk.newPack();

pack.addFormula({
  name: "PhotoGallery",
  description: "Embeds a photo gallery from a list of images.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.SparseImageArray,
      name: "photos",
      description: "The list of photos to display in the gallery.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "backgroundColor",
      description: "The background color of the gallery. Default: #1a1a1a.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "foregroundColor",
      description: "The foreground color of the gallery (text, buttons). Default: white.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  schema: {
    type: sdk.ValueType.String,
    codaType: sdk.ValueHintType.Embed,
    force: true,
  },
  execute: async function (args, context) {
    let [photos, backgroundColor, foregroundColor] = args;
    let urls = photos.filter(Boolean).join(",");
    let encoded = lzma1.compressString(urls);
    let base64 = base64EncodeWebSafe(encoded);
    return sdk.withQueryParams(EmbedUrl, {
      l: base64,
      bc: backgroundColor,
      fc: foregroundColor,
    });
  },
});

function base64EncodeWebSafe(data) {
  return Buffer.from(data).toString("base64")
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Remove padding
}