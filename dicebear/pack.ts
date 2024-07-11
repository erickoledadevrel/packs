import * as coda from "@codahq/packs-sdk";
import * as dicebear from '@dicebear/core';
import * as styles from '@dicebear/collection';
import * as c from "case";
// import CSSColorList from "css-named-colors";
import Ajv from "ajv";

export const pack = coda.newPack();

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

const LicenseSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "name",
});

const OptionSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    minimum: { type: coda.ValueType.Number },
    maximum: { type: coda.ValueType.Number },
    pattern: { type: coda.ValueType.String },
    enum: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
    multipleAllowed: { type: coda.ValueType.Boolean },
  },
  displayProperty: "name",
});

const StyleSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    title: { type: coda.ValueType.String },
    example: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    creator: { type: coda.ValueType.String },
    source: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    homepage: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    license: LicenseSchema,
    options: { type: coda.ValueType.Array, items: OptionSchema },
    documentation: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "name",
  idProperty: "name",
  featuredProperties: ["title", "example", "license", "documentation"],
});

pack.addFormula({
  name: "Avatar",
  description: "Generate an avatar image using one of many styles.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "seed",
      description: "The name, email address, or other unique identifier of the user.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
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
    coda.makeParameter({
      type: coda.ParameterType.String,
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
    coda.makeParameter({
      type: coda.ParameterType.String,
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
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.ImageReference,
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
      throw new coda.UserVisibleError("A non-empty seed value is required.");
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
          documentation: coda.joinUrl(StyleDocumentationBaseUrl, style),
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
  let url = coda.withQueryParams(baseUrl, {
    seed: seed,
  });
  return url;
}

function getBaseUrl(style: string, options: Record<string, string>): string {
  let format = options.format ?? DefaultImageFormat;
  delete options["format"];
  return coda.withQueryParams(
    coda.joinUrl("https://api.dicebear.com/", ApiVersion, style, format),
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
    throw new coda.UserVisibleError(`Invalid options: ${errors.join(", ")}`);
  }
}

function getStyles() {
  return Object.keys(styles).map(style => c.kebab(style));
}

function getSchema(styleName, includeBaseSchema = true) {
  let styleSchema = styles[c.camel(styleName)]?.schema;
  if (!styleSchema) {
    throw new coda.UserVisibleError(`Invalid style: ${styleName}`);
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
    throw new coda.UserVisibleError(`Invalid style: ${styleName}`);
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
