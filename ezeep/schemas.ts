import * as sdk from "@superhuman/plugins-sdk";

const PaperFormatSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, fromKey: "Name" },
    id: { type: sdk.ValueType.String, fromKey: "Id" },
    /*
    XRes:2159
    YRes:2794
    */
  },
  displayProperty: "name",
});

const OrientationSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    id: { type: sdk.ValueType.String },
  },
  displayProperty: "name",
});

export const PrinterSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    id: { type: sdk.ValueType.String, required: true },
    //collate: { type: sdk.ValueType.Boolean, fromKey: "Collate" },
    colorSupported: { type: sdk.ValueType.Boolean, fromKey: "Color" },
    duplexSupported: { type: sdk.ValueType.Boolean, fromKey: "DuplexSupported" },
    location: { type: sdk.ValueType.String, fromKey: "Location" },
    paperSizes: {
      type: sdk.ValueType.Array,
      items: PaperFormatSchema,
      fromKey: "PaperFormats",
    },
    orientations: {
      type: sdk.ValueType.Array,
      items: OrientationSchema,
    },
    resolutions: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String },
    },
  },
  displayProperty: "name",
  idProperty: "id",
  featuredProperties: ["location", "paperSizes", "colorSupported"],
});

const PrinterReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(PrinterSchema, "Printer");

const UserSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    id: { type: sdk.ValueType.String },
    email: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Email },
  },
  displayProperty: "name",
});

export const PrintJobStatusSchema = sdk.makeObjectSchema({
  properties: {
    status: { type: sdk.ValueType.String, fromKey: "jobstatusstring" },
    pagesPrinted: { type: sdk.ValueType.Number, fromKey: "jobpagesprinted" },
    pagesTotal: { type: sdk.ValueType.Number, fromKey: "jobpagestotal" },
    queuePosition: { type: sdk.ValueType.Number, fromKey: "jobposition" },
    timestamp: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
  },
  displayProperty: "status",
});

export const WebhookPrintJobSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, fromKey: "filename" },
    id: { type: sdk.ValueType.String, fromKey: "printjob_id" },
    status: { type: sdk.ValueType.String },
    user: UserSchema,
    printer: {
      ...PrinterReferenceSchema,
      codaType: undefined,
    },
    created: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
    color: { type: sdk.ValueType.Boolean },
    duplex: { type: sdk.ValueType.Boolean },
    copies: { type: sdk.ValueType.Number },
    paperSize: { type: sdk.ValueType.String, fromKey: "paper" },
    pages: { type: sdk.ValueType.Number, fromKey: "total_printed_pages" },
    /*
    "co2_impact": 5,
    "connector_id": "2a612735-db4a-4bbc-bb89-4bd1bea425c0",
    "connector_name": "Print Server DESKTOP-A87ASUV",
    "type": "network",
    */
  },
  displayProperty: "name",
});
