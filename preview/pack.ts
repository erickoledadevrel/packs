import * as coda from "@codahq/packs-sdk";
import * as rs from "jsrsasign";
import { PrivateKeyPEM } from "./credentials";

const BaseUrl = "https://erickoledapacks.netlify.app/preview/";
const OneDaySecs = 24 * 60 * 60;
const MaxUrlLength = Math.pow(2, 31);

export const pack = coda.newPack();

pack.addFormula({
  name: "PreviewHTML",
  description: "Generate a preview of HTML content.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "html",
      description: "The HTML to preview.",
    }),
  ],
  resultType: coda.ValueType.String,
  schema: {
    type: coda.ValueType.String,
    codaType: coda.ValueHintType.Embed,
    force: true,
  },
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [html] = args;
    // Minify JS.
    html = html
      .replace(/\s+/g, " ")
      .replace(/> </g, "><");
    let url = coda.withQueryParams(BaseUrl, {
      h: html,
      s: sign(html),
    });
    if (url.length > MaxUrlLength) {
      throw new coda.UserVisibleError("Too much content to preview.");
    }
    return url;
  },
});

pack.addFormula({
  name: "PreviewMarkdown",
  description: "Generate a preview of markdown content.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "markdown",
      description: "The markdown to preview.",
    }),
  ],
  resultType: coda.ValueType.String,
  schema: {
    type: coda.ValueType.String,
    codaType: coda.ValueHintType.Embed,
    force: true,
  },
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [markdown] = args;
    let url = coda.withQueryParams(BaseUrl, {
      m: markdown,
      s: sign(markdown),
    });
    if (url.length > MaxUrlLength) {
      throw new coda.UserVisibleError("Too much content to preview.");
    }
    return url;
  },
});

function sign(content) {
  let sig = new rs.crypto.Signature({alg: "SHA512withECDSA"});
  sig.init(PrivateKeyPEM);
  sig.updateString(content);
  let hex = sig.sign();
  return Buffer.from(hex, 'hex').toString('base64');
}
