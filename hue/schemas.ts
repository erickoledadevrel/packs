import * as coda from "@codahq/packs-sdk";

export const LightSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, required: true },
    type: { type: coda.ValueType.String,  fromKey: "archetype" },
    manufacturer: { type: coda.ValueType.String, fromKey: "manufacturername" },
    model: { type: coda.ValueType.String, fromKey: "modelid" },
    lightId: { type: coda.ValueType.String, fromKey: "id", required: true },
  },
  displayProperty: "name",
  idProperty: "lightId",
  featuredProperties: ["type", "lightId"],
});

export const LightStatusSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    lightId: { type: coda.ValueType.String },
    on: { type: coda.ValueType.Boolean },
    hue: { type: coda.ValueType.Number },
    saturation: { type: coda.ValueType.Number, fromKey: "sat" },
    brightness: { type: coda.ValueType.Number, fromKey: "bri" },
    color: { type: coda.ValueType.String },
    swatch: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    reachable: { type: coda.ValueType.Boolean },
  },
  displayProperty: "name",
});

const LightReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(LightSchema, "Light");

export const RoomSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, required: true },
    type: { type: coda.ValueType.String, fromKey: "class" },
    lights: {
      type: coda.ValueType.Array,
      items: LightReferenceSchema,
    },
    roomId: { type: coda.ValueType.String, fromKey: "id", required: true },
  },
  displayProperty: "name",
  idProperty: "roomId",
  featuredProperties: ["lights", "roomId"],
});

const RoomReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(RoomSchema, "Room");

export const SceneSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    lights: {
      type: coda.ValueType.Array,
      items: LightReferenceSchema,
    },
    room: RoomReferenceSchema,
    sceneId: { type: coda.ValueType.String, fromKey: "id" },
  },
  displayProperty: "name",
  idProperty: "sceneId",
  featuredProperties: ["type", "lights", "room"],
});

const TimePointSchema = coda.makeObjectSchema({
  properties: {
    summary: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    time: { type: coda.ValueType.String },
    offset: { type: coda.ValueType.Number },
  },
  displayProperty: "summary",
})

export const AutomationSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    automationId: { type: coda.ValueType.String, fromKey: "id" },
    enabled: { type: coda.ValueType.Boolean },
    start: TimePointSchema,
    end: TimePointSchema,
  },
  displayProperty: "name",
  idProperty: "automationId",
  featuredProperties: ["enabled", "start", "end"],
});
