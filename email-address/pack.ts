import * as coda from "@codahq/packs-sdk";
import * as addrs from "email-addresses";

export const pack = coda.newPack();

const EmailSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, description: "The display name, if any." },
    address: { type: coda.ValueType.String, description: "The full email address." },
    local: { type: coda.ValueType.String, description: "The part of the email address before the @." },
    domain: { type: coda.ValueType.String, description: "The domain of the email address." },
  },
  primary: "address",
});

pack.addFormula({
  name: "IsEmail",
  description: "Determine if the input is a valid email.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The input to check.",
    }),
  ],
  resultType: coda.ValueType.Boolean,
  examples: [
    { params: ["alice@example.com"], result: true },
    { params: ["Alice Smith <alice@example.com>"], result: true },
    { params: ["nope@"], result: false },
    { params: ["Nuh uh"], result: false },
  ],
  execute: async function ([input], context) {
    return parse(input) !== null;
  },
});

pack.addFormula({
  name: "IsEmailList",
  description: "Determine if the input is a valid list of emails.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The input to check.",
    }),
  ],
  resultType: coda.ValueType.Boolean,
  execute: async function ([input], context) {
    return parseList(input) !== null;
  },
});

pack.addFormula({
  name: "EmailAddress",
  description: "Gets the email address from an email string.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The email string.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([input], context) {
    let parsed = parse(input);
    if (parsed === null) {
      throw new coda.UserVisibleError("Invalid email address");
    }
    return parsed.address;
  },
});

pack.addFormula({
  name: "EmailAddresses",
  description: "Gets the email addresses from an email string.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The email string.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },
  execute: async function ([input], context) {
    let parsed = parseList(input);
    if (parsed === null) {
      throw new coda.UserVisibleError("Invalid email address list");
    }
    return parsed.map(email => email.address);
  },
});

pack.addFormula({
  name: "EmailParts",
  description: "Breaks an email down into it's parts.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The email to parse.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: EmailSchema,
  execute: async function ([input], context) {
    let parsed = parse(input);
    if (parsed === null) {
      throw new coda.UserVisibleError("Invalid email address");
    }
    return parsed;
  },
});

pack.addFormula({
  name: "EmailListParts",
  description: "Breaks a list of emails down into their parts.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "The input to parse.",
    }),
  ],
  resultType: coda.ValueType.Array,
  items: EmailSchema,
  execute: async function ([input], context) {
    let parsed = parseList(input);
    if (parsed === null) {
      throw new coda.UserVisibleError("Invalid email address list");
    }
    return parsed;
  },
});

function parse(input): addrs.ParsedMailbox {
  let parsed = addrs.parseOneAddress(input);
  if (parsed === null) {
    return null;
  }
  if (parsed.type === "group") {
    return null;
  }
  return parsed;
}

function parseList(input): addrs.ParsedMailbox[] {
  let parsed = addrs.parseAddressList(input);
  if (parsed === null) {
    return null;
  }
  return parsed
    .reduce((result, email) => {
      if (email.type === "group") {
        let group = email as addrs.ParsedGroup;
        return result.concat(group.addresses);
      }
      return result.concat([email]);
    }, []);
}