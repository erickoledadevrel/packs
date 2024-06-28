import * as coda from "@codahq/packs-sdk";
import * as nomnoml from "nomnoml";

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
  codaType: coda.ValueHintType.ImageReference,
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
    let people: Person[] = names.map((name, i) => {
      let title = titles[i];
      let department = departments[i];
      return {name, title, department};
    });
    for (let person of people) {
      
    }
    let blocks = names.map((name, i) => {
      let title = titles[i];
      if (!name) return "";
      if (title) {
        return `[${name}|${title}]`
      } else {
        return `[${name}]`;
      }
    });
    let reports = names.map((name, i) => {
      return Array.from(managers.entries())
        .filter(([i, manager]) => manager == name)
        .map(([i, manager]) => names[i]);
    });
    let teams = departments
    let departmentHeads
    let lines = blocks.map((block, i) => {
      let manager = managers[i];
      if (!block) return "";
      if (manager) {
        let managerBlock = blocks[names.indexOf(manager)];
        return `${managerBlock} -> ${block}`;
      } else {
        return block;
      }
    });
    lines = [
      "#ranker: longest-path",
    ].concat(lines);
    let code = lines.filter(Boolean).join("\n");
    let svg = nomnoml.renderSvg(code);
    let encoded = Buffer.from(svg).toString("base64");
    return coda.SvgConstants.DataUrlPrefix + encoded;
  },
});

interface Person {
  name: string;
  reportsTo?: Person;
  title?: string;
  department?: string;
}