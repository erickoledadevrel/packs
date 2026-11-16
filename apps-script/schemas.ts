import * as sdk from "@superhuman/plugins-sdk";

const UserSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    email: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Email },
    photo: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference, fromKey: "photoUrl" },
  },
  displayProperty: "name",
});

const FileSchema = sdk.makeObjectSchema({
  properties: {
    name: { type: sdk.ValueType.String },
    type: { type: sdk.ValueType.String },
    content: { type: sdk.ValueType.String, fromKey: "source" },
    createTime: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
    updateTime: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
    lastModifyUser: UserSchema,
  }
});

const MetricsSchema = sdk.makeObjectSchema({
  properties: {
    summary: { type: sdk.ValueType.String },
    activeUsers: { type: sdk.ValueType.Number },
    totalExecutions: { type: sdk.ValueType.Number },
    failedExecutions: { type: sdk.ValueType.Number },
  },
  displayProperty: "summary",
});

export const ScriptSchema = sdk.makeObjectSchema({
  properties: {
    scriptId: { type: sdk.ValueType.String },
    title: { type: sdk.ValueType.String },
    files: { type: sdk.ValueType.Array, items: FileSchema },
    metrics: MetricsSchema,
    createTime: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
    updateTime: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime },
    creator: UserSchema,
    lastModifyUser: UserSchema,
    link: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
  },
  displayProperty: "title",
  idProperty: "scriptId",
  featuredProperties: ["files", "metrics"],
  subtitleProperties: [
    { property: "creator.name", label: `By ${sdk.PropertyLabelValueTemplate}` },
  ],
  linkProperty: "link",
});
