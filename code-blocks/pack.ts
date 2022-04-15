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
      type: coda.ParameterType.String,
      name: "language",
      description: "The programming language of the code. If not specified it will be detected automatically.",
      optional: true,
      autocomplete: async function (context, search) {
        return SupportedLanguages.filter((language => !search || language.includes(search)));
      }
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
    { params: ["console.log('Hello World');", "javascript"], result: "" },
  ],
  execute: async function ([code, language], context) {
    return coda.withQueryParams(BaseEmbedUrl, {
      cb: Buffer.from(code).toString("base64"),
      l: language,
    });
  },
});

pack.addColumnFormat({
  name: "Code Block",
  instructions: "Enter code into the cell to have it displayed with syntax highlighting.",
  formulaName: "CodeBlock",
});