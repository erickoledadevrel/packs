import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

pack.addFormula({
  name: "ToHTML",
  description: "Convert rich text to HTML.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "text",
      description: "The rich text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([text], context) {
    return text;
  },
});

pack.addFormula({
  name: "ToMarkdown",
  description: "Convert rich text to markdown.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Markdown,
      name: "text",
      description: "The rich text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([text], context) {
    return text;
  },
});

pack.addFormula({
  name: "RenderHTML",
  description: "Render HTML as rich text.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "html",
      description: "The HTML markup to render.",
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Html,
  execute: async function ([html], context) {
    return html;
  },
});

pack.addFormula({
  name: "RenderMarkdown",
  description: "Render markdown as rich text.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "markdown",
      description: "The markdown to render.",
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Markdown,
  execute: async function ([markdown], context) {
    return markdown;
  },
});
