import * as sdk from "@superhuman/plugins-sdk";
import figlet from "figlet";
import {fonts} from "./fonts";

const DefaultPreviewText = "Coda";
const PaddingAmount = 6;
const FontNames = fonts.map(font => font.name);

const FontSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, description: "The name of the font." },
    preview: { 
      type: sdk.ValueType.String, 
      codaType: sdk.ValueHintType.Html,
      description: "A preview of the font."
    },
  },
  displayProperty: "name",
  idProperty: "name",
  featuredProperties: ["preview"],
});

const PreviewTextParameter = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "previewText",
  description: "The text to use when rendering the font preview.",
  optional: true,
});

export const pack = sdk.newPack();

pack.addFormula({
  name: "ASCIIfy",
  description: "Convert text into ASCII art.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "text",
      description: "The text to render.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "font",
      description: "The font to use.",
      optional: true,
      autocomplete: async function (context, search) {
        return FontNames.filter(font => !search || font.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
      },
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Html,
  examples: [
    { params: ["Hello"], result: "" },
    { params: ["Hello", "DOS Rebel"], result: "" },
  ],
  execute: async function ([text, font="Standard"], context) {
    let art = await render(text, font);
    let padding = " ".repeat(PaddingAmount);
    return `<pre>${art + padding}</pre>`;
  },
});

pack.addColumnFormat({
  name: "ASCIIfy",
  formulaName: "ASCIIfy",
  instructions: "Enter text and it will be rendered as ASCII art.",
});

pack.addFormula({
  name: "Fonts",
  description: "Lists the available fonts.",
  parameters: [PreviewTextParameter],
  resultType: sdk.ValueType.Array,
  items: FontSchema,
  execute: async function ([previewText], context) {
    return await getFonts(previewText);
  },
});

pack.addSyncTable({
  name: "Fonts",
  description: "Preview text in all of the available fonts.",
  schema: FontSchema,
  identityName: "Font",
  formula: {
    name: "SyncFonts",
    description: "Syncs the fonts.",
    parameters: [PreviewTextParameter],
    execute: async function ([previewText], context) {
      let results = await getFonts(previewText);
      return {
        result: results,
      };
    }
  }
});

async function render(text: string, font: string): Promise<string> {
  if (!FontNames.includes(font)) {
    throw new sdk.UserVisibleError("Unknown font: " + font);
  }
  let definition = fonts.find(f => f.name == font).definition;
  figlet.parseFont(font, definition);
  return new Promise((resolve, reject) => {
    figlet.text(text, {
      font: font,
    }, function(err, data) {
      if (err) reject(err);
      resolve(data);
    });
  });
}

async function getFonts(text=DefaultPreviewText) {
  let jobs = FontNames.map(font => render(text, font));
  let rendered = await Promise.all(jobs);
  return rendered.map((render, i) => {
    return {
      name: FontNames[i],
      preview: `<pre>${render}</pre>`,
    };
  });
}