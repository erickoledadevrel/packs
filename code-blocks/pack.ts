import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const BaseEmbedUrl = "https://code-snippets-embed.web.app";
const SupportedLanguages = ['bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'ini', 'java', 'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'xml', 'markdown', 'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python', 'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift', 'typescript', 'vbnet', 'yaml'];

pack.addNetworkDomain("web.app");

pack.addFormula({
  name: "CodeBlock",
  description: "Creates a code block with syntax highlighting.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "code",
      description: "The code to highlight.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "showLineNumbers",
      description: "Whether or not to show line numbers. Default: false.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "lineNumberStart",
      description: "Which line number to start with. Only applies if showLineNumbers is true. Default: 1.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "highlightLines",
      description: "Which lines to highlight, as a comma-separated list of line numbers. Ranges of lines can be specified using a dash (ex: 2-5). If lineNumberStart has been set the line numbers must be relative to that start.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "language",
      description: "The programming language of the code. If not specified it will be detected automatically.",
      optional: true,
      autocomplete: async function (context, search) {
        return SupportedLanguages.filter((language => !search || language.includes(search)));
      }
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "showButton",
      description: "Whether or not to show the \"Select All\" button. Default: true.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Embed,
  schema: {
    type: coda.ValueType.String,
    codaType: coda.ValueHintType.Embed,
    force: true,
  },
  examples: [
    { params: ["console.log('Hello World');"], result: "" },
    { params: ["console.log('Hello World');", true], result: "" },
    { params: ["console.log('Hello World');", true, 10], result: "" },
    { params: ["console.log('Hello World');", undefined, undefined, "1,3-5,10"], result: "" },
    { params: ["console.log('Hello World');", undefined, undefined, undefined, "javascript"], result: "" },
    { params: ["console.log('Hello World');", undefined, undefined, undefined, undefined, false], result: "" },
  ],
  execute: async function ([code, showLineNumbers, lineNumberStart, highlightLines, language, showButton=true], context) {
    let params: Record<string, any> = {
      cb: Buffer.from(code).toString("base64"),
    };
    if (language) {
      params["l"] = language;
    }
    if (showLineNumbers) {
      params["ln"] = 1;
      if (lineNumberStart) {
        params["ls"] = lineNumberStart;
      }
    }
    if (highlightLines) {
      params["hl"] = highlightLines;
    }
    if (showButton === false) {
      params["dc"] = 1;
    }
    return coda.withQueryParams(BaseEmbedUrl, params);
  },
});

pack.addColumnFormat({
  name: "Code Block",
  instructions: "Enter code into the cell to have it displayed with syntax highlighting.",
  formulaName: "CodeBlock",
});