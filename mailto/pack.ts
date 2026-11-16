import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

pack.addFormula({
  name: "MailtoLink",
  description: "Generate a mailto link, which when clicked will start composing a new email in the user's email program.",
  parameters: [
    makeParameter("To"),
    makeParameter("CC"),
    makeParameter("BCC"),
    makeParameter("Subject"),
    makeParameter("Body"),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.Url,
  examples: [
    {
      params: ["alice@example.com"], 
      result: "mailto:alice@example.com",
    },
    {
      params: ["alice@example.com", "bob@example.com, carol@example.com"], 
      result: "mailto:alice@example.com?cc=bob%40example.com%2C%20carol%40example.com",
    },
    {
      params: ["alice@example.com", null, null, "Free cake!"], 
      result: "mailto:alice@example.com?subject=Free%20cake!",
    },
    {
      params: ["alice@example.com", null, null, "Free cake!", "Yum!"], 
      result: "mailto:alice@example.com?subject=Free%20cake!&body=Yum!",
    },
    {
      params: [null, null, null, "No more cake"], 
      result: "mailto:?subject=No%20more%20cake",
    },
  ],
  execute: async function (args, context) {
    let [to, cc, bcc, subject, body] = args;
    let params = compact({ cc, bcc, subject, body });
    return sdk.withQueryParams(`mailto:${to ?? ""}`, params);
  },
});

function makeParameter(field: string) {
  return sdk.makeParameter({
    type: sdk.ParameterType.String,
    name: field.toLowerCase(),
    description: `The value to pre-fill in the "${field}" field of the email.`,
    optional: true,
  });
}

function compact(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => 
      value !== undefined && value !== null));
}