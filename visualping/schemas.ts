import * as coda from "@codahq/packs-sdk";

export const JobSchema = coda.makeObjectSchema({
  properties: {
    jobId: {
      type: coda.ValueType.Number,
      description: "",
      fromKey: "id",
      required: true,
    },
    name: {
      type: coda.ValueType.String,
      description: "",
      fromKey: "description",
      required: true,
    },
    active: {
      type: coda.ValueType.Boolean,
      description: "",
      fromKey: "isActive",
    },
    url: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      display: coda.LinkDisplayType.Url,
      description: "",
    },
    icon: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "",
      fromKey: "faviconPath",
    },
    mode: {
      type: coda.ValueType.String,
      description: "",
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
      description: "",
      fromKey: "id",
    },
    created: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      description: "",
    },
    difference: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Percent,
      precision: 1,
      fromKey: "PercentDifference",
    },
    preview: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
      description: "",
      fromKey: "thumb_diff_full",
    },
    details: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      fromKey: "ccache_snapshot",
    },
    job: JobReferenceSchema,
  },
  displayProperty: "created",
  idProperty: "changeId",
  featuredProperties: ["difference", "preview", "details"],
});
