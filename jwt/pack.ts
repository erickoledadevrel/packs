import * as sdk from "@superhuman/plugins-sdk";
import * as rs from "jsrsasign";

const OneDaySecs = 24 * 60 * 60;
const Algorithms = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
];

const JWTSchema = sdk.makeObjectSchema({
  properties: {
    header: { type: sdk.ValueType.String },
    payload: { type: sdk.ValueType.String },
  },
  displayProperty: "payload",
});

export const pack = sdk.newPack();

pack.addFormula({
  name: "JWT",
  description: "Create a JSON Web Token (JWT).",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "header",
      description: "The JSON payload of the JWT.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "payload",
      description: "The JSON payload of the JWT.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "algorithm",
      description: "Which cryptographic algorithm to use to sign the JWT.",
      autocomplete: Algorithms,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "key",
      description: "The private key to use to sign the JWT.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "passcode",
      description: "A passcode to use along with the key (optional).",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let [header, payload, algorithm, key, passcode] = args;
    return rs.jws.JWS.sign(algorithm, header, payload, key, passcode);
  },
});

pack.addFormula({
  name: "VerifyJWT",
  description: "Verifies a JSON Web Token (JWT).",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "jwt",
      description: "The JSON Web Token.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "key",
      description: "The public key to use to verify the JWT.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.StringArray,
      name: "alg",
      description: "A list of acceptable algorithms (alg).",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.StringArray,
      name: "iss",
      description: "A list of acceptable issues (iss).",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.StringArray,
      name: "sub",
      description: "A list of acceptable subject names (sub).",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.StringArray,
      name: "aud",
      description: "A list of acceptable audience names (aud).",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Date,
      name: "verifyAt",
      description: "The date and time used to verify various time-based fields. If not specifies, defaults to the current time.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Date,
      name: "gracePeriod",
      description: "An acceptable time difference (as a duration) between the signing and verifier.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.Boolean,
  onError: onError,
  execute: async function (args, context) {
    let [jwt, key, alg=Algorithms, iss, sub, aud, verifyAt, gracePeriod] = args;
    return rs.jws.JWS.verifyJWT(jwt, key, {
      alg, iss, sub, aud, verifyAt, gracePeriod,
    });
  },
});


pack.addFormula({
  name: "ParseJWT",
  description: "Parses a JSON Web Token (JWT).",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "jwt",
      description: "The JSON Web Token.",
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: JWTSchema,
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let [jwt] = args;
    let parsed = rs.jws.JWS.parse(jwt);
    return {
      header: JSON.stringify(parsed.headerObj),
      payload: JSON.stringify(parsed.payloadObj),
    };
  },
});

pack.addFormula({
  name: "JSONObject",
  description: "Create a JSON object from key value pairs. Can be used as the JWT header or payload.",
  parameters: [],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "key",
      description: "The key in the object.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "value",
      description: "The value to store under that key.",
    }),
  ],
  resultType: sdk.ValueType.String,
  cacheTtlSecs: OneDaySecs,
  onError: onError,
  execute: async function (args, context) {
    let input = [...args];
    let result: Record<string, string> = {};
    while (input.length > 0) {
      let [key, value, ...rest] = input;
      result[key] = value;
      input = rest;
    }
    return JSON.stringify(result);
  },
});

function onError(e) {
  throw new sdk.UserVisibleError(e);
}

