import * as sdk from "@superhuman/plugins-sdk";

export const pack = sdk.newPack();

pack.addFormula({
  name: "TriggerWebhook",
  description: "Trigger a webhook created in Integrately.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "webhookUrl",
      description: "The URL of the webhook. Ex: https://webhooks.integrately.com/a/webhooks/...",
    }),
  ],
  resultType: sdk.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    // TODO: Unpack the parameter values.
    let [] = args;
    // TODO: Do something.
    return "OK";
  },
});
