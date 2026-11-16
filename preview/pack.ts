import * as sdk from "@superhuman/plugins-sdk";
import * as rs from "jsrsasign";
import { PrivateKeyPEM } from "./credentials";

const BaseUrl = "https://preview.erickoleda.com/docs/preview/";
const OneDaySecs = 24 * 60 * 60;
const MaxUrlLength = Math.pow(2, 15);

export const pack = sdk.newPack();

pack.addFormula({
  name: "PreviewHTML",
  description: "Generate a preview of HTML content.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "html",
      description: "The HTML to preview.",
    }),
  ],
  resultType: sdk.ValueType.String,
  schema: {
    type: sdk.ValueType.String,
    codaType: sdk.ValueHintType.Embed,
    force: true,
  },
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [html] = args;
    // Minify JS.
    html = html
      .replace(/\s+/g, " ")
      .replace(/> </g, "><");
    let url = sdk.withQueryParams(BaseUrl, {
      h: html,
      s: sign(html),
    });
    if (url.length > MaxUrlLength) {
      throw new sdk.UserVisibleError("Too much content to preview.");
    }
    return url;
  },
});

pack.addFormula({
  name: "PreviewMarkdown",
  description: "Generate a preview of markdown content.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "markdown",
      description: "The markdown to preview.",
    }),
  ],
  resultType: sdk.ValueType.String,
  schema: {
    type: sdk.ValueType.String,
    codaType: sdk.ValueHintType.Embed,
    force: true,
  },
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [markdown] = args;
    let url = sdk.withQueryParams(BaseUrl, {
      m: markdown,
      s: sign(markdown),
    });
    if (url.length > MaxUrlLength) {
      throw new sdk.UserVisibleError("Too much content to preview.");
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
