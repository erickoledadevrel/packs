import * as coda from "@codahq/packs-sdk";
import { getPrinters, getPrinterProperties } from "./helpers";

export const PrinterParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "printer",
  description: "The ID of the printer.",
  autocomplete: async function (context, search) {
    let printers = await getPrinters(context);
    return coda.autocompleteSearchObjects(search, printers, "name", "id");
  },
});

export const PaperSizeParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "paperSize",
  description: "The size of the paper to print on.",
  optional: true,
  autocomplete: async function (context, search, args) {
    let { printer } = args;
    if (!printer) return [];
    let properties = await getPrinterProperties(context, printer);
    return properties.PaperFormats.map(format => `${format.Name} (${format.Id})`);
  },
});

export const PaperWidthParameter = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "paperWidth",
  description: "The width of the paper (in tenths of a millimeter). Only used if the custom paper size (256) is selected.",
  optional: true,
});

export const PaperLengthParameter = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "paperLength",
  description: "The length of the paper (in tenths of a millimeter). Only used if the custom paper size (256) is selected.",
  optional: true,
});

export const ColorParameter = coda.makeParameter({
  type: coda.ParameterType.Boolean,
  name: "color",
  description: "If true (and the printer supports it), print in color. Default: false",
  optional: true,
});

export const DuplexParameter = coda.makeParameter({
  type: coda.ParameterType.Boolean,
  name: "duplex",
  description: "If true (and the printer supports it), print on both sides of the paper. Default: false",
  optional: true,
});

export const OrientationParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "orientation",
  description: "The orientation (portrait, landscape) to print with.",
  optional: true,
  autocomplete: async function (context, search, args) {
    let { printer } = args;
    if (!printer) return [];
    let properties = await getPrinterProperties(context, printer);
    return properties.OrientationsSupported.map((name, i) => {
      let id = properties.OrientationsSupportedId[i];
      return `${name} (${id})`;
    });
  },
});

export const CopiesParameter = coda.makeParameter({
  type: coda.ParameterType.Number,
  name: "copies",
  description: "How many copies to print. Default: 1",
  optional: true,
});

export const ResolutionParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "resolution",
  description: "The resolution (DPI/quality) to print at. Default: Auto",
  optional: true,
  autocomplete: async function (context, search, args) {
    let { printer } = args;
    if (!printer) return [];
    let properties = await getPrinterProperties(context, printer);
    return properties.Resolutions;
  },
});
