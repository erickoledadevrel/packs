import * as sdk from "@superhuman/plugins-sdk";
import * as LZString from 'lz-string'
import { build } from "but-csv";

const BaseUrl = "https://packs.erickoleda.com/orgchart/v2.html";
const OneDaySecs = 24 * 60 * 60;
const MaxUrlLength = 8000;
const Layouts = ["top", "left", "bottom", "right"];

export const pack = sdk.newPack();

pack.addFormula({
  name: "OrgChart",
  description: "Draws an org chart from a table of people.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "nameColumn",
      description: "The column containing the name of each person. Ex: EmployeesTable.Name",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "reportsToColumn",
      description: "The column containing the name of the person they report to. Ex: EmployeesTable.Manager",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "descriptionColumn",
      description: "Optionally, the column containing a description (title, department, location, etc) of the person. Ex: EmployeesTable.Title",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "backgroundColor",
      description: "If specified, which CSS color value to use for the background of the nodes. Ex: #EE5A29.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "textColor",
      description: "If specified, which CSS color value to use for the text in the nodes. Ex: white",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.SparseStringArray,
      name: "colorsColumn",
      description: "Optionally, the column containing the CSS colors to use for that person's node. The format should be either 'background' or 'background,text'. Ex: EmployeesTable.Colors",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "layout",
      description: `Optionally, which layout to use when drawing the chart. One of: ${Layouts.join(", ")}. Default: top.`,
      optional: true,
      autocomplete: Layouts,
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
    let [
      names, 
      managers, 
      descriptions, 
      backgroundColor,
      textColor,
      colors,
      layout,
    ] = args;
    [names, descriptions, managers, colors].reduce((result, list) => {
      if (!list) return result;
      if (!result) return list.length;
      if (result != list.length) throw new sdk.UserVisibleError("All lists must be the same length.");
      return result;
    }, 0);
    let rows = names.map((name, i) => {
      let manager = managers[i];
      let managerIndex = names.indexOf(manager);
      let description = descriptions?.[i] ?? "";
      let color = colors?.[i] ?? "";
      let row = [name, managerIndex];
      if (descriptions) {
        row.push(description)
      }
      if (colors) {
        row.push(color);
      }
      return row;
    });
    let csv = build(rows);
    let input = LZString.compressToEncodedURIComponent(csv);
    let url = sdk.withQueryParams(BaseUrl, {
      i: input,
      b: backgroundColor,
      t: textColor,
      l: layout,
    });
    if (url.length > MaxUrlLength) {
      throw new sdk.UserVisibleError("Org chart too large. Try removing data if possible.");
    }
    return url;
  },
});