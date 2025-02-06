import * as coda from "@codahq/packs-sdk";
import * as LZString from 'lz-string'
import { build } from "but-csv";

const BaseUrl = "https://packs.erickoleda.com/orgchart/index.html";
const OneDaySecs = 24 * 60 * 60;
const MaxUrlLength = 8000;

export const pack = coda.newPack();

pack.addFormula({
  name: "OrgChart",
  description: "Draws an org chart using a table of people.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseStringArray,
      name: "nameColumn",
      description: "The column containing the name of the person.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.SparseStringArray,
      name: "reportsToColumn",
      description: "The column containing the name of the person they report to.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.SparseStringArray,
      name: "descriptionColumn",
      description: "Optionally, the column containing a description (title, department, location, etc) of the person.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "color",
      description: "If specified, which CSS color value to use for the background of the nodes.",
      optional: true,
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
    let [
      names, 
      managers, 
      descriptions = new Array(names.length), 
      color,
    ] = args;
    [names, descriptions, managers].reduce((result, list) => {
      if (!result) return list.length;
      if (result != list.length) throw new coda.UserVisibleError("All lists must be the same length.");
      return result;
    }, 0);
    let rows = names.map((name, i) => {
      let manager = managers[i];
      let managerIndex = names.indexOf(manager);
      let description = descriptions[i] ?? "";
      return [name, managerIndex, description];
    });
    let csv = build(rows);
    let input = LZString.compressToEncodedURIComponent(csv);
    let url = coda.withQueryParams(BaseUrl, {
      i: input,
      c: color,
    });
    if (url.length > MaxUrlLength) {
      throw new coda.UserVisibleError("Org chart too large. Try removing data if possible.");
    }
    return url;
  },
});