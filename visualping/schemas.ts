import * as sdk from "@superhuman/plugins-sdk";

export const JobSchema = sdk.makeObjectSchema({
  properties: {
    jobId: {
      type: sdk.ValueType.Number,
      description: "The ID of the job.",
      fromKey: "id",
      required: true,
    },
    name: {
      type: sdk.ValueType.String,
      description: "The name of the job.",
      fromKey: "description",
      required: true,
    },
    active: {
      type: sdk.ValueType.Boolean,
      description: "If the job is active.",
      fromKey: "isActive",
    },
    url: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      display: sdk.LinkDisplayType.Url,
      description: "The URL that the job is configured to monitor.",
    },
    icon: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      description: "The icon associated with the website being monitored.",
      fromKey: "faviconPath",
    },
    mode: {
      type: sdk.ValueType.String,
      description: "The mode of the comparison between changes.",
    },
    link: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "A link to the job in the Visualping app.",
    },
  },
  displayProperty: "name",
  idProperty: "jobId",
  featuredProperties: ["url", "icon"],
});

const JobReferenceSchema = sdk.makeReferenceSchemaFromObjectSchema(JobSchema, "Job");

export const ChangeSchema = sdk.makeObjectSchema({
  properties: {
    changeId: {
      type: sdk.ValueType.String,
      description: "The ID of the change.",
      fromKey: "id",
    },
    created: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.DateTime,
      description: "When the change was detected.",
    },
    difference: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Percent,
      precision: 1,
      fromKey: "PercentDifference",
      description: "How much the URL has changed.",
    },
    preview: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.ImageReference,
      fromKey: "thumb_diff_full",
      description: "A visual preview of the change.",
    },
    link: {
      type: sdk.ValueType.String,
      codaType: sdk.ValueHintType.Url,
      description: "A link to more information about the change.",
    },
    summary: {
      type: sdk.ValueType.String,
      description: "An AI-generated summary of the change.",
      fromKey: "englishSummary",
    },
    job: JobReferenceSchema,
  },
  displayProperty: "created",
  idProperty: "changeId",
  featuredProperties: ["difference", "preview", "link", "summary"],
});
