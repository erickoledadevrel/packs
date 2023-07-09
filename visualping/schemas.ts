import * as coda from "@codahq/packs-sdk";

export const JobSchema = coda.makeObjectSchema({
  properties: {
    jobId: {
      type: coda.ValueType.Number,
      description: "The ID of the job.",
      fromKey: "id",
      required: true,
    },
    name: {
      type: coda.ValueType.String,
      description: "The name of the job.",
      fromKey: "description",
      required: true,
    },
    active: {
      type: coda.ValueType.Boolean,
      description: "If the job is active.",
      fromKey: "isActive",
    },
    url: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      display: coda.LinkDisplayType.Url,
      description: "The URL that the job is configured to monitor.",
    },
    icon: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "The icon associated with the website being monitored.",
      fromKey: "faviconPath",
    },
    mode: {
      type: coda.ValueType.String,
      description: "The mode of the comparison between changes.",
    },
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "A link to the job in the Visualping app.",
    },
  },
  displayProperty: "name",
  idProperty: "jobId",
  featuredProperties: ["url", "icon"],
});

const JobReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(JobSchema, "Job");

export const ChangeSchema = coda.makeObjectSchema({
  properties: {
    changeId: {
      type: coda.ValueType.String,
      description: "The ID of the change.",
      fromKey: "id",
    },
    created: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      description: "When the change was detected.",
    },
    difference: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Percent,
      precision: 1,
      fromKey: "PercentDifference",
      description: "How much the URL has changed.",
    },
    preview: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      fromKey: "thumb_diff_full",
      description: "A visual preview of the change.",
    },
    link: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      fromKey: "ccache_snapshot",
      description: "A link to more information about the change.",
    },
    job: JobReferenceSchema,
  },
  displayProperty: "created",
  idProperty: "changeId",
  featuredProperties: ["difference", "preview", "link"],
});
