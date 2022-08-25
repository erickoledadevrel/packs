import * as coda from "@codahq/packs-sdk";

const UserSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    email: { type: coda.ValueType.String, codaType: coda.ValueHintType.Email },
    photo: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference, fromKey: "photoUrl" },
  },
  displayProperty: "name",
});

const FileSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    content: { type: coda.ValueType.String, fromKey: "source" },
    createTime: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
    updateTime: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
    lastModifyUser: UserSchema,
  }
});

const MetricsSchema = coda.makeObjectSchema({
  properties: {
    summary: { type: coda.ValueType.String },
    activeUsers: { type: coda.ValueType.Number },
    totalExecutions: { type: coda.ValueType.Number },
    failedExecutions: { type: coda.ValueType.Number },
  },
  displayProperty: "summary",
});

export const ScriptSchema = coda.makeObjectSchema({
  properties: {
    scriptId: { type: coda.ValueType.String },
    title: { type: coda.ValueType.String },
    files: { type: coda.ValueType.Array, items: FileSchema },
    metrics: MetricsSchema,
    createTime: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
    updateTime: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
    creator: UserSchema,
    lastModifyUser: UserSchema,
  },
  displayProperty: "title",
  idProperty: "scriptId",
  featuredProperties: ["files", "metrics"],
});