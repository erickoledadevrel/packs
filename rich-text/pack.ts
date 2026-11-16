import * as sdk from "@superhuman/plugins-sdk";
import * as emojidict from "emoji-dictionary";

export const pack = sdk.newPack();

pack.addFormula({
  name: "ToHTML",
  description: "Convert rich text to HTML.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.Html,
      name: "text",
      description: "The rich text to convert.",
    }),
  ],
  resultType: sdk.ValueType.String,
  execute: async function ([text], context) {
    return text;
  },
});

pack.addFormula({
  name: "ToMarkdown",
  description: "Convert rich text to markdown.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.Markdown,
      name: "text",
      description: "The rich text to convert.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "preserveBlankLines",
      description: "Preserve blank lines in the text. Default: false.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  execute: async function ([text, preserveBlankLines], context) {
    let result = text;
    if (preserveBlankLines) {
      let previous;
      do {
        previous = result;
        result = result.replace(/\n\n/g, "\n&nbsp;\n");
      } while (previous != result)
    }
    return result;
  },
});

pack.addFormula({
  name: "RenderHTML",
  description: "Render HTML as rich text.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "html",
      description: "The HTML markup to render.",
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Html,
  execute: async function ([html], context) {
    return html;
  },
});

pack.addFormula({
  name: "RenderMarkdown",
  description: "Render markdown as rich text.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "markdown",
      description: "The markdown to render.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "supportEmojiShortcodes",
      description: `Render emoji shortcodes as the equivalent emoji. For example, :heart_eyes: => 😍.  Default: false.`,
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Markdown,
  execute: async function ([markdown, supportEmojiShortcodes = false], context) {
    if (supportEmojiShortcodes) {
      for (let name of emojidict.names) {
        markdown = markdown.replaceAll(`:${name}:`, emojidict.getUnicode(name))
      }
    }
    return markdown;
  },
});
