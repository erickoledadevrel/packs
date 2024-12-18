import * as coda from "@codahq/packs-sdk";
import * as xml2js from 'xml2js';
import * as xpath from 'xpath';
import * as xmldom from '@xmldom/xmldom';
import * as xslt from 'xslt-processor';

const OneDaySecs = 24 * 60 * 60;

export const pack = coda.newPack();

const XMLParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "xml",
  description: "The XML contents as a string.",
});

const IndentParam = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "indent",
  description: "The number of spaces to indent by. Default: 2.",
  optional: true,
});

const OmitDeclarationParam = coda.makeParameter({
  type: coda.ParameterType.Boolean,
  name: "omitDeclaration",
  description: "If true, the standard XML declaration is omitted. Default: false.",
  optional: true,
});

pack.addFormula({
  name: "FormatXML",
  description: "Formats XML content using the options provided.",
  parameters: [
    XMLParam,
    IndentParam,
    OmitDeclarationParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { 
      params: [`<foo> <bar a="1">baz</bar> </foo>`], 
      result: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><foo><bar a="1">baz</bar></foo>`,
    },
    { 
      params: [`<foo> <bar a="1">baz</bar> </foo>`, 2], 
      result: trimIndent(`
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <foo>
          <bar a="1">baz</bar>
        </foo>
      `, true),
    },
    { 
      params: [`<foo> <bar a="1">baz</bar> </foo>`, undefined, true], 
      result: `<foo><bar a="1">baz</bar></foo>`,
    },
  ],
  execute: async function (args, context) {
    let [xml, indent, omit] = args;
    let spaces = typeof indent == "number" ? " ".repeat(indent) : undefined;
    let value = await parse(xml);
    let builder = new xml2js.Builder({
      renderOpts: {
        pretty: Boolean(spaces),
        indent: spaces,
      },
      headless: omit,
    });
    return builder.buildObject(value);
  },
});

pack.addFormula({
  name: "IsValidXML",
  description: "Returns true if the content is valid XML, false otherwise.",
  parameters: [
    XMLParam,
  ],
  resultType: coda.ValueType.Boolean,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`<foo>bar</foo>`], result: true },
    { params: [`<foo>bar</foo`, ], result: false },
  ],
  execute: async function (args, context) {
    let [xml] = args;
    try {
      await xml2js.parseStringPromise(xml);
    } catch (e) {
      if (e.toString().startsWith("Error:")) {
        return false;
      }
      throw e;
    }
    return true;
  },
});

pack.addFormula({
  name: "ToJSON",
  description: "Converts a XML string to JSON, using the format defined by xml2js.",
  parameters: [
    XMLParam,
    IndentParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { params: [`<foo a="1">bar</foo>`], result: `{"foo":{"_":"bar","$":{"a":"1"}}}` },
    { 
      params: [`<foo a="1">bar</foo>`, 2], 
      result: trimIndent(`
        {
          "foo": {
            "_": "bar",
            "$": {
              "a": "1"
            }
          }
        }
      `, true)
    },
  ],
  execute: async function (args, context) {
    let [xml, spaces] = args;
    let value = await parse(xml);
    return JSON.stringify(value, null, spaces);
  },
});

pack.addFormula({
  name: "ToXML",
  description: "Converts a JSON string to XML, using the xml2js format.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "json",
      description: "The JSON contents as a string.",
    }),
    IndentParam,
    OmitDeclarationParam,
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  examples: [
    { 
      params: [`{"foo": "bar"}`], 
      result: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><foo>bar</foo>`,
    },
  ],
  execute: async function (args, context) {
    let [json, indent, omit] = args;
    let spaces = typeof indent == "number" ? " ".repeat(indent) : undefined;
    try {
      let value = JSON.parse(json);
      let builder = new xml2js.Builder({
        renderOpts: {
          pretty: Boolean(spaces),
          indent: spaces,
        },
        headless: omit,
      });
      return builder.buildObject(value);
    } catch (e) {
      if (e.toString().startsWith("SyntaxError") || e.toString().startsWith("Error:")) {
        throw new coda.UserVisibleError(e);
      }
      throw e;
    }
  },
});

pack.addFormula({
  name: "XPath",
  description: "Run an XPath query over the XML content. Returns a list of results as text.",
  parameters: [
    XMLParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "query",
      description: "The XPath query to run.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },
  examples: [
    { 
      params: [`<a><b id="1">foo</b><b id="2">bar</b></a>`, '/a/b'],
      result: [`<b id="1">foo</b>`, `<b id="2">bar</b>`],
    },
    { 
      params: [`<a><b id="1">foo</b><b id="2">bar</b></a>`, '/a/b[@id="1"]'],
      result: [`<b id="1">foo</b>`],
    },
    { 
      params: [`<a><b id="1">foo</b><b id="2">bar</b></a>`, '/a/b/text()'],
      result: [`foo`, `bar`],
    },
    { 
      params: [`<a><b id="1">foo</b><b id="2">bar</b></a>`, '/a/b/@id'],
      result: [`1`, `2`],
    },
  ],
  execute: async function (args, context) {
    let [xml, query] = args;
    try {
      let parser = new xmldom.DOMParser({
        onError: () => {}, // Disable logging of errors.
      });
      let doc = parser.parseFromString(xml, 'text/xml');
      let nodes = xpath.select(query, doc as unknown as Node);
      if (nodes instanceof Array) {
        return nodes.map(node => serializeNode(node));
      }
      if (["string", "number", "boolean"].includes(typeof nodes)) {
        return [nodes.toString()];
      }
      return [serializeNode(nodes as Node)];
    } catch (e) {
      throw new coda.UserVisibleError(e);
    }
  },
});

pack.addFormula({
  name: "Transform",
  description: "Use XSLT to transform the XML.",
  parameters: [
    XMLParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "xslt",
      description: "The XSLT transformation to use.",
    }),
  ],
  resultType: coda.ValueType.String,
  isExperimental: true,
  execute: async function (args, context) {
    let [xmlString, xsltString] = args;
    const processor = new xslt.Xslt();
    const parser = new xslt.XmlParser();
    const result = await processor.xsltProcess(
      parser.xmlParse(xmlString),
      parser.xmlParse(xsltString)
    );
    return result;
  },
});

async function parse(xml: string) {
  try {
    return await xml2js.parseStringPromise(xml);
  } catch (e) {
    if (e.toString().startsWith("Error:")) {
      throw new coda.UserVisibleError(e);
    }
    throw e;
  }
}

function trimIndent(str: string, trim = false) {
  let lines = str.split("\n");
  if (lines[0] == "") {
    lines = lines.slice(1);
  }
  if (lines.at(-1) == "") {
    lines = lines.slice(0, -1);
  }
  let indent = lines[0].match(/^\s*/)[0].length;
  let result = lines.map(line => line.substring(indent)).join("\n");
  if (trim) {
    result = result.trim();
  }
  return result;
}

function serializeNode(node: Node) {
  if (node.nodeType == node.ATTRIBUTE_NODE) {
    return node.nodeValue;
  } else {
    return node.toString();
  }
}