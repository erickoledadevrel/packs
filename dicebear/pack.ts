import * as sdk from "@superhuman/plugins-sdk";
import * as dicebear from '@dicebear/core';
import * as styles from '@dicebear/collection';
import * as c from "case";
// import CSSColorList from "css-named-colors";
import Ajv from "ajv";

export const pack = sdk.newPack();

const ApiVersion = "7.x";
const DefaultStyle = "initials";
const DefaultImageFormat = "svg";
const OneDaySecs = 24 * 60 * 60;
const HiddenOptions = ["seed"];
const DefaultOptions = {
  size: "128",
};
const ColorPattern = '^(transparent|[a-fA-F0-9]{6})$';
const StyleDocumentationBaseUrl = "https://www.dicebear.com/styles/";
const ImageFormats = ["svg", "png", "jpg"];

const LicenseSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    url: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "name",
});

const OptionSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    type: { type: sdk.ValueType.String },
    minimum: { type: sdk.ValueType.Number },
    maximum: { type: sdk.ValueType.Number },
    pattern: { type: sdk.ValueType.String },
    enum: { type: sdk.ValueType.Array, items: { type: sdk.ValueType.String } },
    multipleAllowed: { type: sdk.ValueType.Boolean },
  },
  displayProperty: "name",
});

const StyleSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    title: { type: sdk.ValueType.String },
    example: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    creator: { type: sdk.ValueType.String },
    source: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
    homepage: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
    license: LicenseSchema,
    options: { type: sdk.ValueType.Array, items: OptionSchema },
    documentation: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "name",
  idProperty: "name",
  featuredProperties: ["title", "example", "license", "documentation"],
});

pack.addFormula({
  name: "Avatar",
  description: "Generate an avatar image using one of many styles.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "seed",
      description: "The name, email address, or other unique identifier of the user.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "style",
      description: "Which style to use.",
      suggestedValue: DefaultStyle,
      autocomplete: async function (context) {
        return getStyles()
          .filter(style => style.toLowerCase().includes(style.toLowerCase()));
      },
    }),
  ],
  varargParameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "option",
      description: "The name of an option.",
      autocomplete: async function (context, search, args) {
        let {style} = args;
        let schema = getSchema(style);
        return Object.keys(schema.properties)
          .filter(option => !HiddenOptions.includes(option))
          .filter(option => option.toLowerCase().includes(search.toLowerCase()));
      },
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "value",
      description: "The value of the option.",
      autocomplete: async function (context, search, args) {
        let {style, option} = args;
        if (!option) return [];
        let schema = getSchema(style);
        let definition = schema.properties[option];
        if (!definition) return [];
        return getAutocompleteForOption(definition)
          .filter(value => value.toLowerCase().includes(search.toLowerCase()));
      },
    }),
  ],
  resultType: sdk.ValueType.String,
  codaType: sdk.ValueHintType.ImageReference,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [
      seed,
      style,
      ...vars
    ] = args;
    let options: Record<string, string> = {};
    while (vars.length > 0) {
      let [key, value, ...rest] = vars;
      options[key] = value;
      vars = rest;
    }
    if (!seed) {
      throw new sdk.UserVisibleError("A non-empty seed value is required.");
    }
    let schema = getSchema(style);
    validateOptions(schema, options);
    return getAvatarUrl(seed, style, options);
  },
});

pack.addSyncTable({
  name: "Styles",
  description: "A list of the available avatar styles.",
  identityName: "Style",
  schema: StyleSchema,
  formula: {
    name: "SyncStyles",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let styles = getStyles();
      let rows = styles.map(style => {
        let meta = getMeta(style);
        let schema = getSchema(style, false);
        let options = Object.entries(schema.properties)
          .filter(([option]) => !HiddenOptions.includes(option))
          .map(([name, value]) => {
          let definition = value as any;
          return {
            ...definition,
            ...(definition.items ?? {}),
            name: name,
            multipleAllowed: definition.type == "array",
          };
        });
        return {
          name: style,
          ...meta,
          example: getAvatarUrl("Eric Koleda", style),
          options: options,
          documentation: sdk.joinUrl(StyleDocumentationBaseUrl, style),
        };
      });
      return {
        result: rows,
      };
    },
  },
});

function getAvatarUrl(seed: string, style: string, options?: Record<string, string>) {
  options = {
    ...DefaultOptions,
    ...(options ?? {}),
  };
  let baseUrl = getBaseUrl(style, options);
  let url = sdk.withQueryParams(baseUrl, {
    seed: seed,
  });
  return url;
}

function getBaseUrl(style: string, options: Record<string, string>): string {
  let format = options.format ?? DefaultImageFormat;
  delete options["format"];
  return sdk.withQueryParams(
    sdk.joinUrl("https://api.dicebear.com/", ApiVersion, style, format),
    options);
}

function validateOptions(schema, options) {
  let errors = [];
  let unknownOptions = Object.keys(options).filter(option => !schema.properties[option]);
  if (unknownOptions?.length > 0) {
    errors = errors.concat(unknownOptions.map(option => `unknown option "${option}"`));
  }
  let values = {...options};
  for (let [option, definition] of Object.entries(schema.properties)) {
    let value = values[option];
    if (value !== undefined) {
      values[option] = fixValue(definition, value);
    }
    if (value === undefined || value === "") {
      delete values[option];
    }
  }
  let ajv = new Ajv({
    strict: false,
    allErrors: true,
  });
  let validate = ajv.compile(schema)
  let valid = validate(values);
  if (!valid) {
    errors = errors.concat(validate.errors.map(error => {
      let option = error.instancePath.split("/")[1];
      return `${option} ${error.message}`;
    }));
  }
  if (errors?.length) {
    throw new sdk.UserVisibleError(`Invalid options: ${errors.join(", ")}`);
  }
}

function getStyles() {
  return Object.keys(styles).map(style => c.kebab(style));
}

function getSchema(styleName, includeBaseSchema = true) {
  let styleSchema = styles[c.camel(styleName)]?.schema;
  if (!styleSchema) {
    throw new sdk.UserVisibleError(`Invalid style: ${styleName}`);
  }
  return {
    properties: {
      ...(includeBaseSchema ? dicebear.schema.properties : {}),
      ...styleSchema.properties,
      format: {
        name: "Image format",
        type: "string",
        enum: ImageFormats,
      },
    },
  };
}

function getMeta(styleName) {
  let meta = styles[c.camel(styleName)]?.meta;
  if (!meta) {
    throw new sdk.UserVisibleError(`Invalid style: ${styleName}`);
  }
  return meta;
}

function getAutocompleteForOption(property) {
  let {items, minimum, maximum, pattern} = property;
  let values = property.enum ?? items?.enum;
  if (values) return values;
  if (minimum && maximum) {
    return [{ display: `(min: ${minimum}, max: ${maximum})`, value: '' }];
  }
  pattern ??= items?.pattern;
  if (pattern) {
    return [{ display: `(${pattern})`, value: '' }];
  }
  return [];
}

function fixValue(definition, value: string) {
  switch (definition.type) {
    case "array":
      return value.split(",").map(v => fixValue(definition.items, v));
    case "number":
      return parseFloat(value);
    case "integer":
      return parseInt(value);
    case "boolean":
      return value.toLowerCase() === "true";
    default:
      return value;
  }
}
