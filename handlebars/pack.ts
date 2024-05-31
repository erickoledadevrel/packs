import * as coda from "@codahq/packs-sdk";
import * as Handlebars from "handlebars";
const cheerio = require('cheerio');
const escape = require('escape-html');

export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;

pack.addFormula({
  name: "TemplateReplace",
  description: "Replace placeholders in a Handlebars template.",
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
      description: `The template text, with placeholders in the Handlesbars syntax. Ex: "Hello {{name}}"`,
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: `The name of a placeholder. Ex: "name"`,
      autocomplete: async function (context, search, args) {
        let {template} = args;
        template = cleanHtml(template);
        return getPlaceholders(template);
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "value",
      description: `The value of the placeholder. Ex: "Alice"`,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Html,
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let [template, ...vars] = args;
    template = cleanHtml(template);
    let variables: Record<string, string> = {};
    while (vars.length > 0) {
      let [key, value, ...more] = vars;
      if (value !== "") {
        variables[key] = cleanHtml(value);
      }
      vars = more;
    }
    let compiled = Handlebars.compile(template, {
      strict: true,
      noEscape: true,
    });
    return compiled(variables);
  },
});

pack.addFormula({
  name: "TemplateReplaceWithJSON",
  description: "Replace placeholders in a Handlebars template, with values passed as JSON.",
  examples: [
    {params: ["Hello {{name}}", `{"name": "World"}`], result: "Hello World"},
    {params: ["{{person.name}} is {{person.feeling}}", `{"person": {"name": "Alice", "feeling": "happy"}}`], result: "Alice is happy"},
  ],
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "template",
      description: `The template text, with placeholders in the Handlesbars syntax. Ex: "Hello {{name}}"`,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "valuesJSON",
      description: `The values to for the replacement, as a JSON string. Ex: '{"name": "Alice"}'`,
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Html,
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let [template, valuesJSON] = args;
    template = cleanHtml(template);

    let variables;
    try {
      variables = JSON.parse(valuesJSON);
    } catch (e) {
      throw new coda.UserVisibleError("The values are not valid JSON: " + e)
    }
    let compiled = Handlebars.compile(template, {
      strict: true,
      noEscape: true,
    });
    return compiled(variables);
  },
});

// Backwards compatibility.
pack.formulas.push({
  ...pack.formulas[0],
  name: "Template",
  isExperimental: true,
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
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let [template] = args;
    template = cleanHtml(template);
    return getPlaceholders(template);
  },
});

function cleanHtml(html: string): string {
  if (!html.startsWith("<")) {
    return convertToHtml(html);
  }
  let $ = cheerio.load(html);

  // Remove the "http://prefix"
  $("a").each((_i, a) => {
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
    }
  });

  // Fix newline spacing.
  $("body > div").each((_i, div) => {
    let children = $(div).contents();
    // For visual parity, "<div><br></div>"" must be replaced with "<div> </div>".
    if (children.length == 1 && children[0].tagName == "br") {
      $(div).html(" ");
    }
  });

  // If there is only one line (outer div) then unwrap it.
  let divs = $("body").contents();
  if (divs.length == 1) {
    return $(divs[0]).html();
  }
  return $("body").html();
}

function convertToHtml(html) {
  let original = html;
  html = html.split("\n").map(line => escape(line)).join("\n");
  if (html.includes("\n")) {
    html = `<div>${html.replace(/\n/g, "</div><div>")}</p>`;
  }
  if (html != original) {
    return html;
  }
  return original;
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

