import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

pack.addNetworkDomain("sdk.io");

const DaySecs = 24 * 60 * 60;
const FormulaUrlRegex = new RegExp("https://sdk.io/formulas#(.*)");

const InputSchema = sdk.makeObjectSchema({
  properties: {
    name: {
      type: sdk.ValueType.String,
      description: "The name of the input.",
    },
    description: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Markdown,
      description: "The description of the input.",
    },
    optional: {
      type: sdk.ValueType.Boolean,
      description: "If the input is optional.",
      fromKey: "isOptional",
    },
    repeating: {
      type: sdk.ValueType.Boolean,
      description: "If the input can be repeated. If there is more than one repeating input they must be repeated together in sets.",
      fromKey: "isVararg",
    },
  },
  displayProperty: "name",
});

const ExampleSchema = sdk.makeObjectSchema({
  properties: {
    input: {
      type: sdk.ValueType.String,
      description: "An example usage of the formula.",
    },
    output: {
      type: sdk.ValueType.String,
      description: "The expected output.",
    },
  },
  displayProperty: "input",
});

const FormulaSchema = sdk.makeObjectSchema({
  properties: {
    label: {
      type: sdk.ValueType.String,
      description: "A label for the formula, including it's name and required parameters.",
    },
    name: {
      type: sdk.ValueType.String,
      description: "The name of the formula.",
    },
    description: {
      type: sdk.ValueType.String,
      description: "A description of the formula.",
    },
    category: {
      type: sdk.ValueType.String,
      fromKey: "groupName",
      description: "The category the formula belongs to.",
    },
    action: {
      type: sdk.ValueType.Boolean,
      fromKey: "isAction",
      description: "If the formula is an action. Action formulas can be used in buttons and automations.",
    },
    inputs: {
      type: sdk.ValueType.Array,
      items: InputSchema,
      fromKey: "parameters",
      description: "The inputs to the formula.",
    },
    output: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Markdown,
      description: "A description of the output of the formula.",
    },
    link: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "A link to the documentation for this formula.",
    },
    examples: {
      type: sdk.ValueType.Array,
      items: ExampleSchema,
      description: "Examples of how the formula works.",
    }
  },
  displayProperty: "label",
  idProperty: "name",
  snippetProperty: "output",
  linkProperty: "link",
  subtitleProperties: [
    { property: "description", label: "" },
    "category",
  ]
});

pack.addFormula({
  name: "Formula",
  description: "Get information about a formula in the Coda formula language.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "name",
      description: "The name of the formula.",
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: FormulaSchema,
  cacheTtlSecs: DaySecs,
  execute: async function (args, context) {
    let [name] = args;
    let match = name.match(FormulaUrlRegex);
    if (match) {
      name = match[1];
    }
    let formulas = await getFormulas(context);
    let formula = formulas.find(formula => formula.name == name);
    if (!formula) {
      throw new sdk.UserVisibleError(`Unknown formula: ${name}`);
    }
    return formula;
  },
});

pack.addColumnFormat({
  name: "Formula",
  formulaName: "Formula",
  instructions: "Enter the name of a Coda formula to get information about it.",
  matchers: [FormulaUrlRegex],
});

pack.addSyncTable({
  name: "Formulas",
  description: "A table of all of the formulas in the Coda formula language.",
  identityName: "Formula",
  schema: FormulaSchema,
  formula: {
    name: "SyncFormulas",
    description: "Sync the formulas.",
    parameters: [],
    execute: async function ([], context) {
      let formulas = await getFormulas(context);
      return {
        result: formulas,
      };
    },
  },
});

async function getFormulas(context: sdk.ExecutionContext): Promise<any[]> {
  let url = "https://sdk.io/api/formulaMetadata";
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: DaySecs,
  });
  return response.body.map(formula => {
    return formatFormula(formula);
  });
}

function formatFormula(formula: any): any {
  let paramString = formula.parameters
    ?.filter(param => !param.isOptional)
    .map(param => {
      let result = param.name;
      if (param.isVararg) {
        result += "...";
      }
      return result;
    })
    .join(", ");
  return {
    ...formula,
    label: `${formula.name}(${paramString})`,
    isAction: formula.badges.isAction,
    link: `https://sdk.io/formulas#${formula.name}`,
    output: parseDescription(formula.outputDescription, formula.parameters),
    parameters: (formula.parameters || []).map(param => {
      return {
        ...param,
        description: parseDescription(param.description, formula.parameters),
      };
    }),
  };
}

function parseDescription(description: any[], parameters) {
  return description.map(node => {
    let value;
    let code = false;
    switch (node.type) {
      case "String":
        value = node.msg;
        break;
      case "Parameter":
        value = parameters[node.index].name;
        code = true;
        break;
      case "Formula":
        value = node.formulaName;
        code = true;
        break;
      case "Reference":
        value = node.reference;
        code = true;
        break;
      case "Value":
        value = node.value;
        code = true;
        break;
      default:
        console.error(`Unknown description node type: ${node.type}`);
        value = "";
    }
    if (code) {
      value = `\`${value}\``;
    }
    return value;
  }).join("");
}
