import * as sdk from "@superhuman/plugins-sdk";
import * as addrs from "email-addresses";

export const pack = sdk.newPack();

const EmailSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, description: "The display name, if any." },
    address: { type: sdk.ValueType.String, description: "The full email address." },
    local: { type: sdk.ValueType.String, description: "The part of the email address before the @." },
    domain: { type: sdk.ValueType.String, description: "The domain of the email address." },
  },
  displayProperty: "address",
});

pack.addFormula({
  name: "IsEmail",
  description: "Determine if the input is a valid email.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The input to check.",
    }),
  ],
  resultType: sdk.ValueType.Boolean,
  examples: [
    { params: ["alice@example.com"], result: true },
    { params: ["Alice <alice@example.com>"], result: true },
    { params: ["Chair"], result: false },
  ],
  execute: async function ([input], context) {
    return parse(input) !== null;
  },
});

pack.addFormula({
  name: "IsEmailList",
  description: "Determine if the input is a valid list of emails.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The input to check.",
    }),
  ],
  resultType: sdk.ValueType.Boolean,
  examples: [
    { params: ["alice@example.com, bob@example.com"], result: true },
    { params: ["Alice <alice@example.com>, Bob <bob@example.com>"], result: true },
    { params: ["Chair, Desk"], result: false },
  ],
  execute: async function ([input], context) {
    return parseList(input) !== null;
  },
});

pack.addFormula({
  name: "EmailAddress",
  description: "Gets the email address from an email string. Returns an error if the input is not a single email.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The email string.",
    }),
  ],
  resultType: sdk.ValueType.String,
  examples: [
    { params: ["alice@example.com"], result: "alice@example.com" },
    { params: ["Alice <alice@example.com>"], result: "alice@example.com" },
  ],
  execute: async function ([input], context) {
    let parsed = parse(input);
    if (parsed === null) {
      throw new sdk.UserVisibleError("Invalid email address");
    }
    return parsed.address;
  },
});

pack.addColumnFormat({
  name: "Email Address",
  formulaName: "EmailAddress",
  instructions: "Enter an email address and it will be formatted into a standard form."
});

pack.addFormula({
  name: "EmailAddresses",
  description: "Gets the list of email addresses from an email string. Return an error if the input is not an email list.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The email string.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: { type: sdk.ValueType.String },
  examples: [
    { params: ["alice@example.com, bob@example.com"], result: ["alice@example.com", "bob@example.com"] },
    { params: ["Alice <alice@example.com>, Bob <bob@example.com>"], result: ["alice@example.com", "bob@example.com"] },
  ],
  execute: async function ([input], context) {
    let parsed = parseList(input);
    if (parsed === null) {
      throw new sdk.UserVisibleError("Invalid email address list");
    }
    return parsed.map(email => email.address);
  },
});

pack.addFormula({
  name: "EmailParts",
  description: "Breaks an email down into it's parts. The result include the Name, Address, Local (part before the @), and Domain of the email. Returns an error if the input is not a single email.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The email to parse.",
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: EmailSchema,
  examples: [
    { 
      params: ["alice@example.com"], 
      result: { Name: null, Address: "alice@example.com", Local: "alice", Domain: "example.com" },
    },
    {
      params: ["Alice <alice@example.com>"], 
      result: { Name: "Alice", Address: "alice@example.com", Local: "alice", Domain: "example.com" },
    },
  ],
  execute: async function ([input], context) {
    let parsed = parse(input);
    if (parsed === null) {
      throw new sdk.UserVisibleError("Invalid email address");
    }
    return parsed;
  },
});

pack.addFormula({
  name: "EmailListParts",
  description: "Breaks a list of emails down into their parts. Each result includes the Name, Address, Local (part before the @), and Domain of the email. Returns an error if the input is not an email list.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "input",
      description: "The input to parse.",
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: EmailSchema,
  examples: [
    { 
      params: ["alice@example.com, bob@example.com"], 
      result: [
        { Name: null, Address: "alice@example.com", Local: "alice", Domain: "example.com" },
        { Name: null, Address: "bob@example.com", Local: "bob", Domain: "example.com" },
      ] 
    },
    { 
      params: ["Alice <alice@example.com>, Bob <bob@example.com>"], 
      result: [
        { Name: "Alice", Address: "alice@example.com", Local: "alice", Domain: "example.com" },
        { Name: "Bob", Address: "bob@example.com", Local: "bob", Domain: "example.com" },
      ] 
    },
  ],
  execute: async function ([input], context) {
    let parsed = parseList(input);
    if (parsed === null) {
      throw new sdk.UserVisibleError("Invalid email address list");
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