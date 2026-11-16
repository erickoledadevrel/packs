import * as sdk from "@superhuman/plugins-sdk";

export const LightSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    type: { type: sdk.ValueType.String,  fromKey: "archetype" },
    manufacturer: { type: sdk.ValueType.String, fromKey: "manufacturername" },
    model: { type: sdk.ValueType.String, fromKey: "modelid" },
    lightId: { type: sdk.ValueType.String, fromKey: "id", required: true },
  },
  displayProperty: "name",
  idProperty: "lightId",
  featuredProperties: ["type", "lightId"],
});

export const LightStatusSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    lightId: { type: sdk.ValueType.String },
    on: { type: sdk.ValueType.Boolean },
    hue: { type: sdk.ValueType.Number },
    saturation: { type: sdk.ValueType.Number, fromKey: "sat" },
    brightness: { type: sdk.ValueType.Number, fromKey: "bri" },
    color: { type: sdk.ValueType.String },
    swatch: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    reachable: { type: sdk.ValueType.Boolean },
  },
  displayProperty: "name",
});

const LightReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(LightSchema, "Light");

export const RoomSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String, required: true },
    type: { type: sdk.ValueType.String, fromKey: "class" },
    lights: {
      type: sdk.ValueType.Array,
      items: LightReferenceSchema,
    },
    roomId: { type: sdk.ValueType.String, fromKey: "id", required: true },
  },
  displayProperty: "name",
  idProperty: "roomId",
  featuredProperties: ["lights", "roomId"],
});

const RoomReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(RoomSchema, "Room");

export const SceneSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    type: { type: sdk.ValueType.String },
    lights: {
      type: sdk.ValueType.Array,
      items: LightReferenceSchema,
    },
    room: RoomReferenceSchema,
    sceneId: { type: sdk.ValueType.String, fromKey: "id" },
  },
  displayProperty: "name",
  idProperty: "sceneId",
  featuredProperties: ["type", "lights", "room"],
});

const TimePointSchema = sdk.makeObjectSchema({
  properties: {
    summary: { type: sdk.ValueType.String },
    type: { type: sdk.ValueType.String },
    time: { type: sdk.ValueType.String },
    offset: { type: sdk.ValueType.Number },
  },
  displayProperty: "summary",
})

export const AutomationSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    automationId: { type: sdk.ValueType.String, fromKey: "id" },
    enabled: { type: sdk.ValueType.Boolean },
    start: TimePointSchema,
    end: TimePointSchema,
  },
  displayProperty: "name",
  idProperty: "automationId",
  featuredProperties: ["enabled", "start", "end"],
});
