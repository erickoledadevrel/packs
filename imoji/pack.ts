import * as coda from "@codahq/packs-sdk";
import * as emojidict from "emoji-dictionary";

export const pack = coda.newPack();

const DefaultImageSize = 200;

pack.addFormula({
  name: "Imoji",
  description: "Create an image from an emoji.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "emoji",
      description: "The emoji to convert into an image. It can be the actual emoji characters, or the name of the emoji.",
      defaultValue: "😃",
      autocomplete: async function(context, search) {
        let options = emojidict.names.map(name => {
          let emoji = emojidict.getUnicode(name);
          return {
            display: `${name} ${emoji}`,
            value: name,
          };
        });
        return coda.autocompleteSearchObjects(search, options, "display", "value");
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "size",
      description: `The desired size of the resulting image, in pixels. Defaults to ${DefaultImageSize}.`,
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  examples: [
    {params: ["😃"], result: ""},
    {params: ["smiley"], result: ""},
    {params: [":smiley:"], result: ""},
  ],
  execute: async function ([emoji, size = DefaultImageSize], context) {
    emoji = emoji.trim();
    if (!emoji?.length) {
      return "";
    }
    // Remove leading and trailing colons, if present.
    emoji = emoji.replace(/^\:(.*)\:$/, "$1");
    
    // Replace emoji name with character.
    if (emojidict.names.includes(emoji)) {
      emoji = emojidict.getUnicode(emoji);
    }
    
    let svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="58%" text-anchor="middle" dominant-baseline="middle" font-size="6">${emoji}</text>
      </svg>
    `.trim();
    let encoded = Buffer.from(svg).toString("base64");
    //return coda.SvgConstants.DataUrlPrefix + encoded;
    return "data:image/svg+xml;base64," + encoded;
  },
});

pack.addColumnFormat({
  name: "Imoji",
  instructions: "Displays the emoji in the column as an image.",
  formulaName: "Imoji",
});