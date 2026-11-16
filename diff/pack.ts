import * as sdk from "@superhuman/plugins-sdk";
const Diff = require("diff");

const ByOptions = ["character", "line", "word"];
const DefaultDiffBy = "word";
const DefaultContext = 3;

const OldParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "old",
  description: "The old value.",
});

const NewParam = sdk.makeParameter({
  type: sdk.ParameterType.String,
  name: "new",
  description: "The new value.",
});

export const pack = sdk.newPack();

pack.addFormula({
  name: "Diff",
  description: "Show the differences between two text values.",
  parameters: [
    OldParam,
    NewParam,
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "by",
      description: `At what level to calculate the differences (${ByOptions.join(", ")}). Default: ${DefaultDiffBy}`,
      autocomplete: ByOptions,
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Html,
  execute: async function (args, context) {
    let [
      oldText,
      newText,
      by=DefaultDiffBy,
    ] = args;

    let func;
    switch (by) {
      case "line":
        func = Diff.diffLines;
        break;
      case "word":
        func = Diff.diffWords;
        break;
      case "character":
        func = Diff.diffChars;
        break;
      default:
        throw new sdk.UserVisibleError(`Invalid diff by option: ${by}`);
    }
    return format(func(oldText, newText));
  },
});

function format(diff): string {
  return diff.map(part => {
    console.log(part.value);
    if (part.added) {
      return `<b>${part.value}</b>`;
    } else if (part.removed ) {
      return `<strike>${part.value}</strike>`;
    } else {
      return part.value;
    }
  }).join("").replace(/\n/g, "<br>");
}

pack.addFormula({
  name: "UnixDiff",
  description: "Show the differences between two text values, using the format of the Unix diff command.",
  parameters: [
    OldParam,
    NewParam,
    sdk.makeParameter({
      type: sdk.ParameterType.Number,
      name: "context",
      description: `How many lines of context to show before and after a difference. Default: ${DefaultContext}`,
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Markdown,
  execute: async function (args, context) {
    let [
      oldText,
      newText,
      contextLines = DefaultContext,
    ] = args;
    let patch = Diff.createPatch("file", oldText, newText, "", "", {
      context: contextLines,
    });
    let lines = patch.split(/\n/);
    let content = lines.slice(4).join("\n");
    return "```\n" + content + "\n```";
  },
});
