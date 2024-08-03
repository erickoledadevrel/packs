import * as coda from "@codahq/packs-sdk";
import * as LZString from 'lz-string'

const BaseUrl = "https://packs.erickoleda.com/orgchart/index.html";
const OneDaySecs = 24 * 60 * 60;

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
        name: "titleColumn",
        description: "The column containing the their title.",
        optional: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.SparseStringArray,
        name: "departmentColumn",
        description: "The column containing the department they are in.",
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
      titles = new Array(names.length), 
      departments = new Array(names.length)
    ] = args;
    [names, titles, managers, departments].reduce((result, list) => {
      if (!result) return list.length;
      if (result != list.length) throw new coda.UserVisibleError("All lists must be the same length.");
      return result;
    }, 0);
    let rows = names.map((name, i) => {
      let manager = managers[i];
      let title = titles[i];
      let department = departments[i];
      return [name, manager, title, department];
    });
    let json = JSON.stringify(rows);
    let input = LZString.compressToEncodedURIComponent(json);
    return coda.withQueryParams(BaseUrl, {
      i: input,
    });
  },
});