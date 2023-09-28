import * as coda from "@codahq/packs-sdk";
import { data } from "cheerio/lib/api/attributes";
import * as Handlebars from "handlebars";
const cheerio = require('cheerio');

export const pack = coda.newPack();

pack.addFormula({
  name: "Template",
  description: "Replace placeholders in a template.",
  examples: [
    {params: ["Hello {{name}}", "name", "World"], result: "Hello World"},
    {params: ["{{name}} is {{feeling}}", "name", "Alice", "feeling", "happy"], result: "Alice is happy"},
    {params: ["It is {{time}}{{#if location}} in {{location}}{{/if}}", "time", "3pm"], result: "It is 3pm"},
    {params: ["It is {{time}}{{#if location}} in {{location}}{{/if}}", "time", "3pm", "location", "London"], result: "It is 3pm in London"},
  ],
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "template",
      description: "The template text (Handlebars syntax).",
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the placeholder.",
      autocomplete: async function (context, search, args) {
        let {template} = args;
        template = cleanHtml(template);
        return getPlaceholders(template);
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value of the placeholder.",
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Html,
  onError: onError,
  execute: async function (args, context) {
    let [template, ...vars] = args;
    template = cleanHtml(template);
    let variables: Record<string, string> = {};
    while (vars.length > 0) {
      let [key, value, ...more] = vars;
      if (value !== "") {
        variables[key] = value;
      }
      vars = more;
    }
    let compiled = Handlebars.compile(template, {
      strict: true,
    });
    return compiled(variables);
  },
});

pack.addFormula({
  name: "Placeholders",
  description: "Get the list of placeholders in a template.",
  examples: [
    {params: ["Hello {{name}}"], result: ["name"]},
    {params: ["{{name}} is {{feeling}}"], result: ["name", "feeling"]},
  ],
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "template",
      description: "The Handlebars template.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: {
    type: coda.ValueType.String,
  },
  onError: onError,
  execute: async function (args, context) {
    let [template] = args;
    template = cleanHtml(template);
    return getPlaceholders(template);
  },
});

function cleanHtml(html: string): string {
  let $ = cheerio.load(html);
  let changed = false;
  // Remove the "http://prefix"
  $("a").each((i, a) => {
    let href = $(a).attr("href");
    let regex = /^http\:\/\/($|\{)/;
    if (href.match(regex)) {
      href = href.replace(regex, "$1");
      if (!href) {
        // Remove the link.
        $(a).replaceWith($(a).html());
      } else {
        $(a).attr("href", href.replace(regex, "$1"));
      }
      changed = true;
    }
  });
  if (changed) {
    return $.html();
  }
  return html;
}

function getPlaceholders(template: string): string[] {
  let vars = new Set<string>();
  let data = new Proxy({}, {
    get(_target, name) {
      vars.add(name as string);
    },
  });
  let compiled = Handlebars.compile(template);
  compiled(data);
  return [...vars];
}

function onError(e: Error) {
  console.error(e);
  let match;
  if (e.message.match(/^Parse error/)) {
    throw new coda.UserVisibleError(e.message.split("\n").slice(0, 2).join(" "));
  }
  if (match = e.message.match(/"(.*?)" not defined in/)) {
    let [_, variable] = match;
    throw new coda.UserVisibleError(`Missing a value for the variable "${variable}".`);
  }
  throw e;
}

