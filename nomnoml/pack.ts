import * as sdk from "@superhuman/plugins-sdk";
import * as nomnoml from "nomnoml";

const OneDaySecs = 24 * 60 * 60;

export const pack = sdk.newPack();

pack.addFormula({
  name: "Diagram",
  description: "Draws a diagram from nomnoml markup.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "markup",
      description: "The nomnoml diagram markup (see the language reference at nomnoml.com).",
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.ImageReference,
  cacheTtlSecs: OneDaySecs,
  onError: async function (e) {
    throw new sdk.UserVisibleError(e);
  },
  execute: async function (args, context) {
    let [code] = args;
    let svg = nomnoml.renderSvg(code);
    let encoded = Buffer.from(svg).toString("base64");
    return sdk.SvgConstants.DataUrlPrefix + encoded;
  },
});

pack.addColumnFormat({
  name: "Diagram",
  instructions: "Enter nomnoml markup and it will be rendered as a diagram.",
  formulaName: "Diagram",
});

pack.addFormula({
  name: "GenerateMarkup",
  description: "Generate nomnoml markup from a table that has a parent-child relationship.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "labelColumn",
      description: "The entire column of the table that contains the label for each row.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "parentColumn",
      description: "The entire column of the table that contains the parent for each row, if any.",
    }),
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [labels, parents] = args;
    [labels, parents].reduce((result, list) => {
      if (!result) return list.length;
      if (result != list.length) throw new sdk.UserVisibleError("All lists must be the same length.");
      return result;
    }, 0);
    for (let label of labels) {
      try {
        nomnoml.parse(label);
      } catch (e) {
        throw new sdk.UserVisibleError(`Invalid label: ${label}`);
      }
    }
    let lines = labels.map((label, i) => {
      let parent = parents[i];
      if (!label) return "";
      if (parent) {
        return `[${parent}] -> [${label}]`;
      } else {
        return `[${label}]`;
      }
    });
    return lines.filter(Boolean).join("\n");
  },
});