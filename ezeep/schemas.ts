import * as coda from "@codahq/packs-sdk";

const PaperFormatSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, fromKey: "Name" },
    id: { type: coda.ValueType.String, fromKey: "Id" },
    /*
    XRes:2159
    YRes:2794
    */
  },
  displayProperty: "name",
});

const OrientationSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    id: { type: coda.ValueType.String },
  },
  displayProperty: "name",
});

export const PrinterSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, required: true },
    id: { type: coda.ValueType.String, required: true },
    //collate: { type: coda.ValueType.Boolean, fromKey: "Collate" },
    colorSupported: { type: coda.ValueType.Boolean, fromKey: "Color" },
    duplexSupported: { type: coda.ValueType.Boolean, fromKey: "DuplexSupported" },
    location: { type: coda.ValueType.String, fromKey: "Location" },
    paperSizes: {
      type: coda.ValueType.Array,
      items: PaperFormatSchema,
      fromKey: "PaperFormats",
    },
    orientations: {
      type: coda.ValueType.Array,
      items: OrientationSchema,
    },
    resolutions: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["location", "paperSizes", "colorSupported"],
});

const PrinterReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(PrinterSchema, "Printer");

const UserSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    id: { type: coda.ValueType.String },
    email: { type: coda.ValueType.String, codaType: coda.ValueHintType.Email },
  },
  displayProperty: "name",
});

export const PrintJobStatusSchema = coda.makeObjectSchema({
  properties: {
    status: { type: coda.ValueType.String, fromKey: "jobstatusstring" },
    pagesPrinted: { type: coda.ValueType.Number, fromKey: "jobpagesprinted" },
    pagesTotal: { type: coda.ValueType.Number, fromKey: "jobpagestotal" },
    queuePosition: { type: coda.ValueType.Number, fromKey: "jobposition" },
    timestamp: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
  },
  displayProperty: "status",
});

export const WebhookPrintJobSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, fromKey: "filename" },
    id: { type: coda.ValueType.String, fromKey: "printjob_id" },
    status: { type: coda.ValueType.String },
    user: UserSchema,
    printer: {
      ...PrinterReferenceSchema,
      codaType: undefined,
    },
    created: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
    color: { type: coda.ValueType.Boolean },
    duplex: { type: coda.ValueType.Boolean },
    copies: { type: coda.ValueType.Number },
    paperSize: { type: coda.ValueType.String, fromKey: "paper" },
    pages: { type: coda.ValueType.Number, fromKey: "total_printed_pages" },
    /*
    "co2_impact": 5,
    "connector_id": "2a612735-db4a-4bbc-bb89-4bd1bea425c0",
    "connector_name": "Print Server DESKTOP-A87ASUV",
    "type": "network",
    */
  },
  displayProperty: "name",
});
