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
    brightness: { type: coda.ValueType.Number, fromKey: "bri" },
    color: { type: coda.ValueType.String },
    colorSwatch: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    reachable: { type: coda.ValueType.Boolean },
  },
  displayProperty: "name",
});

const LightReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(LightSchema, "Light");

export const RoomSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String, fromKey: "class" },
    lights: { 
      type: coda.ValueType.Array,
      items: LightReferenceSchema,
    },
    roomId: { type: coda.ValueType.String, fromKey: "id" },
  },
  displayProperty: "name",
  idProperty: "roomId",
  featuredProperties: ["lights", "roomId"],
});
