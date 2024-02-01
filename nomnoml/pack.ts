import * as coda from "@codahq/packs-sdk";
import * as nomnoml from "nomnoml";

const OneDaySecs = 24 * 60 * 60;

export const pack = coda.newPack();

pack.addFormula({
  name: "Diagram",
  description: "Draws a diagram from nomnoml markup.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "markup",
      description: "The nomnoml diagram markup (see the language reference at nomnoml.com).",
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [code] = args;
    let svg = nomnoml.renderSvg(code);
    let encoded = Buffer.from(svg).toString("base64");
    return coda.SvgConstants.DataUrlPrefix + encoded;
  },
});
