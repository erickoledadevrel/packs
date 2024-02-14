import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

pack.addFormula({
  name: "TriggerWebhook",
  description: "Trigger a webhook created in Integrately.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "webhookUrl",
      description: "The URL of the webhook. Ex: https://webhooks.integrately.com/a/webhooks/...",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    // TODO: Unpack the parameter values.
    let [] = args;
    // TODO: Do something.
    return "OK";
  },
});
