import * as coda from "@codahq/packs-sdk";
import type * as ct from "./types/coda";
import type * as sst from "./types/smartsuite";
import { getReferenceSchema, MemberSchema } from "./schemas";
import { getSharedFile, getTable } from "./api";
import { ConversionSettings } from "./types";

const SyntheticDisplayPropertyKey = "_display";
const SyntheticDisplayPropertyName = "Display";
const SecondsPerDay = 60 * 60 * 24;
const NotSyncedMessage = "Not synced";

export function getConverter(settings: ConversionSettings, column: sst.Column): ColumnConverter<any, any> {
  switch (column.field_type) {
    /*
      TODO:
      * countfield
      * durationfield
      * formulafield
      * lookupfield
      * rollupfield
      * signaturefield
      * recordidfield
      * subitemsfield
    */

    // Text
    case "textfield":
    case "recordtitlefield":
    case "textareafield":
      return new TextColumnConverter(settings, column);
    case "richtextareafield":
      return new HtmlColumnConverter(settings, column);
    case "linkfield":
      return new LinkColumnConverter(settings, column);
    case "emailfield":
      return new EmailColumnConverter(settings, column);
    case "fullnamefield":
      return new NestedColumnConverter(settings, column, " ");

    // Numbers
    case "numberfield":
      return new NumberColumnConverter(settings, column);
    case "numbersliderfield":
      return new SliderColumnConverter(settings, column);
    case "percentfield":
      return new PercentColumnConverter(settings, column);
    case "currencyfield":
      return new CurrencyColumnConverter(settings, column);
    case "percentcompletefield":
      return new ProgressColumnConverter(settings, column);
    case "ratingfield":
      return new ScaleColumnConverter(settings, column);

    // Boolean
    case "yesnofield":
      return new BooleanColumnConverter(settings, column);

    // Dates and times
    case "datefield":
      // TODO: Handle date + time.
      return new DateColumnConverter(settings, column);
    case "timefield":
      return new TimeColumnConverter(settings, column);
    case "duedatefield":
      return new DueDateColumnConverter(settings, column);
    case "daterangefield":
      return new NestedColumnConverter(settings, column, " - ");
    case "durationfield":
      return new DurationColumnConverter(settings, column);

    // Select lists
    case "singleselectfield":
    case "multipleselectfield":
    case "statusfield":
    case "tagsfield":
      return new SelectListColumnConverter(settings, column);

    // Relations
    case "linkedrecordfield":
      return new LinkedRecordColumnConverter(settings, column);
    case "dependencyfield":
      return new DependencyColumnConverter(settings, column);

    // People and contacts
    case "userfield":
      return new MemberColumnConverter(settings, column);
    case "phonefield":
      return new PhoneColumnConverter(settings, column);
    case "addressfield":
      return new NestedColumnConverter(settings, column, ", ");
    case "votefield":
      return new VoteColumnConverter(settings, column);
    case "socialnetworkfield":
      // It doesn't really allow multiple entries.
      column.params.entries_allowed = "single";
      return new NestedColumnConverter(settings, column, ", ");

    // Media
    case "filefield":
      return new FileColumnConverter(settings, column);

    // Metadata
    case "firstcreatedfield":
    case "lastupdatedfield":
      return new MemberDatePairColumnConverter(settings, column);
    case "commentscountfield":
    case "autonumberfield":
      return new NumberColumnConverter(settings, column);

    // Structured
    case "checklistfield":
      return new ChecklistColumnConverter(settings, column);
    case "timetrackingfield":
      return new TimeTrackkingLogColumnConverter(settings, column);
    case "colorpickerfield":
      return new ColorColumnConverter(settings, column);
    case "ipaddressfield":
      return new IpAddressColumnConverter(settings, column);

    default:
      // Composites
      if (column.nested) {
        return new NestedColumnConverter(settings, column);
      }
      console.error(`No converter found for column type: ${column.field_type}`);
      return new UnknownColumnConverter(settings, column);
  }
}

// Abstract class that all converter classes extend.
abstract class ColumnConverter<T, C> {
  settings: ConversionSettings
  column: sst.Column;

  constructor(settings: ConversionSettings, column: sst.Column) {
    this.settings = settings;
    this.column = column;
  }

  async getSchema(): Promise<coda.Schema & coda.ObjectSchemaProperty> {
    let schema = await this._getSchema();
    let propertyKey = this.getPropertyKey();
    let columnName = this.getColumnName();
    schema.fixedId = propertyKey;
    schema.fromKey = propertyKey;
    if (schema.mutable === undefined) {
      schema.mutable = !this.column.params.system
        && !this.column.params.is_auto_generated;
    }
    schema.displayName = columnName;
    schema.description = this.column.params.help_text;
    if (this.column.params.entries_allowed == "multiple") {
      schema = coda.makeSchema({
        type: coda.ValueType.Array,
        items: {
          ...schema,
        },
        fromKey: schema.fromKey,
        fixedId: schema.fixedId,
        displayName: schema.displayName,
        description: schema.description,
        mutable: schema.mutable,
      });
    }
    return schema;
  }

  // Each implementation must define the base property schema.
  abstract _getSchema(): Promise<coda.Schema & coda.ObjectSchemaProperty>;

  getPropertyKey(): string {
    return this.column.slug;
  }

  getPropertyName(): string {
    return this.column.label;
  }

  getColumnName(): string {
    return this.column.label;
  }

  async formatValueForSchema(value: T | T[]): Promise<C | C[]> {
    if (isEmpty(value)) {
      return undefined;
    }
    if (Array.isArray(value)) {
      if (this.column.params.entries_allowed == "multiple") {
        return Promise.all(value.map(v => this._formatValueForSchema(v)));
      } else if (this.column.params.entries_allowed == "single") {
        return this._formatValueForSchema(value[0]);  
      }
    }
    return this._formatValueForSchema(value as T);
  }

  async formatValueForApi(value: C | C[]): Promise<T | T[]> {
    if (this.column.params.entries_allowed == "multiple" && Array.isArray(value)) {
      return Promise.all(value.map(v => this._formatValueForApi(v)));
    } else if (this.column.params.entries_allowed == "single") {
      return Promise.all([this._formatValueForApi(value as C)]);
    }
    return this._formatValueForApi(value as C);
  }

  // Default to passing through the value as-is, in both directions.
  async _formatValueForSchema(value: T): Promise<C> {
    return value as any;
  }

  async _formatValueForApi(value: C): Promise<T> {
    return value as any;
  }
}

class TextColumnConverter extends ColumnConverter<string, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }
}

class NumberColumnConverter extends ColumnConverter<string, number> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      precision: this.column.params.precision,
      useThousandsSeparator: this.column.params.separator,
    });
  }

  async _formatValueForSchema(value: string): Promise<number> {
    return Number(value);
  }

  async _formatValueForApi(value: number): Promise<string> {
    return String(value);
  }
}

class SliderColumnConverter extends ColumnConverter<number, number> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Slider,
      minimum: this.column.params.min_value,
      maximum: this.column.params.max_value,
      step: this.column.params.value_increment,
    });
  }
}

class ProgressColumnConverter extends ColumnConverter<number, number> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.ProgressBar,
      minimum: this.column.params.min_value,
      maximum: this.column.params.max_value,
      step: this.column.params.value_increment,
    });
  }
}

class ScaleColumnConverter extends ColumnConverter<number, number> {
  async _getSchema() {
    let icon = undefined;
    switch(this.column.params.display_format) {
      case "star":
        icon = coda.ScaleIconSet.Star;
        break;
      case "heart":
        icon = coda.ScaleIconSet.Heart;
        break;
      case "smiley":
        icon = coda.ScaleIconSet.Smiley;
        break;
      case "flag":
        // Approximation.
        icon = coda.ScaleIconSet.Lightning;
        break;
      case "thumb_up":
        icon = coda.ScaleIconSet.ThumbsUp;
        break;
      case "rectangles":
        icon = coda.ScaleIconSet.Battery;
        break;
    }
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Scale,
      maximum: this.column.params.scale,
      icon: icon,
    });
  }
}

class PercentColumnConverter extends NumberColumnConverter {
  async _getSchema() {
    let baseSchema = await super._getSchema();
    return coda.makeSchema({
      ...baseSchema,
      codaType: coda.ValueHintType.Percent,
    });
  }

  async _formatValueForSchema(value: string): Promise<number> {
    return Number(value) / 100;
  }

  async _formatValueForApi(value: number): Promise<string> {
    return String(value * 100);
  }
}

class CurrencyColumnConverter extends NumberColumnConverter {
  async _getSchema() {
    let baseSchema = await super._getSchema();
    return coda.makeSchema({
      ...baseSchema,
      codaType: coda.ValueHintType.Currency,
      currencyCode: this.column.params.currency,
      // For some reason this field doesn't exist on the CurrencySchema,
      // so we need to unset it.
      useThousandsSeparator: undefined,
    });
  }
}

class BooleanColumnConverter extends ColumnConverter<boolean, boolean> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Boolean,
      codaType: this.column.params.display_format.includes("toggle") ? coda.ValueHintType.Toggle : undefined,
    });
  }
}

class DateColumnConverter extends ColumnConverter<sst.Date, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    });
  }

  async _formatValueForSchema(value: sst.Date): Promise<string> {
    if (!value || !value.date) return undefined;
    if (value.include_time) {
      return value.date;
    } else {
      return value.date.split("T")[0];
    }
  }

  // Pass the date back as a string.
  async _formatValueForApi(value: string): Promise<sst.Date> {
    let hasTime = true;
    if (!value.includes("T")) {
      value += "T00:00:00Z";
      hasTime = false;
    }
    return {
      date: value,
      include_time: hasTime,
    };
  }
}

class TimeColumnConverter extends ColumnConverter<string, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Time,
    });
  }
}

class DurationColumnConverter extends ColumnConverter<number, number> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Duration,
    });
  }

  async _formatValueForSchema(value: number): Promise<number> {
    return value / SecondsPerDay;
  }

  async _formatValueForApi(value: number): Promise<number> {
    return value * SecondsPerDay;
  }
}

class PhoneColumnConverter extends ColumnConverter<sst.PhoneField | string, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  async _formatValueForSchema(value: sst.PhoneField): Promise<string> {
    return value.sys_title;
  }

  async _formatValueForApi(value: string): Promise<string> {
    if (!value.trim().startsWith("+")) {
      throw new coda.UserVisibleError("Phone number doesn't start with a plus and country code: " + value);
    }
    return value;
  }
}

class MemberDatePairColumnConverter extends ColumnConverter<sst.DatePersonField, ct.DatePersonField> {
  async _getSchema() {
    return coda.makeObjectSchema({
      properties: {
        by: coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member"),
        on: {
          type: coda.ValueType.String,
          codaType: coda.ValueHintType.DateTime,
          mutable: false,
        },
      },
      displayProperty: "on",
    });
  }

  async _formatValueForSchema(value: sst.DatePersonField): Promise<ct.DatePersonField> {
    let person: ct.MemberReference = {
      name: "Not synced",
      id: value.by,
    };
    return {by: person, on: value.on};
  }
}

class SelectListColumnConverter extends ColumnConverter<string | string[] | sst.Status, ct.Option | ct.Option[]> {
  async _getSchema() {
    let schema: coda.Schema = coda.makeObjectSchema({
      properties: {
        label: { type: coda.ValueType.String },
        value: { type: coda.ValueType.String },
      },
      codaType: coda.ValueHintType.SelectList,
      options: coda.OptionsType.Dynamic,
      allowNewValues: this.column.params.new_choices_allowed || this.column.field_type == "tagsfield",
    });
    if (["multipleselectfield", "tagsfield"].includes(this.column.field_type)) {
      schema = coda.makeSchema({
        type: coda.ValueType.Array,
        items: schema,
      });
    }
    return schema;
  }

  async _formatValueForSchema(value: string | string[] | sst.Status): Promise<ct.Option | ct.Option[]> {
    if (value instanceof Array) {
      return value.map(val => this.toOption(val));
    } else if (typeof(value) == "string") {
        return this.toOption(value);
    } else {
      // Status column.
      return this.toOption(value.value);
    }
  }

  private toOption(value: string) {
    let choice = this.column.params.choices.find(choice => choice.value == value);
    return {
      label: choice?.label ?? "Unknown",
      value: value,
    };
  }

  async _formatValueForApi(value: ct.Option | ct.Option[]): Promise<string | string[]> {
    if (value instanceof Array) {
      return value.map(val => val.value);
    } else {
      return value.value;
    }
  }
}

class HtmlColumnConverter extends ColumnConverter<sst.RichTextField, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      // All formatting is lost on edit.
      mutable: false,
    });
  }

  async _formatValueForSchema(value: sst.RichTextField): Promise<string> {
    return value.html.replaceAll("\n", "").trim();
  }
}

class LinkColumnConverter extends ColumnConverter<string, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      display: this.column.params.display_format == "favicon_only" ? coda.LinkDisplayType.IconOnly : coda.LinkDisplayType.Url,
    });
  }
}

class EmailColumnConverter extends ColumnConverter<string, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Email,
    });
  }
}

class MemberColumnConverter extends ColumnConverter<string, ct.MemberReference> {
  async _getSchema() {
    return coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member");
  }

  async _formatValueForSchema(value: string): Promise<ct.MemberReference> {
    return {
      name: "Not synced",
      id: value,
    };
  }

  async _formatValueForApi(value: ct.MemberReference): Promise<string> {
    return value.id;
  }
}

class VoteColumnConverter extends ColumnConverter<sst.Vote, ct.Vote> {
  async _getSchema() {
    return coda.makeObjectSchema({
      properties: {
        total_votes: { type: coda.ValueType.Number },
        votes: {
          type: coda.ValueType.Array,
          items: coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member"),
        },
      },
      displayProperty: "total_votes",
      mutable: false,
    });
  }

  async _formatValueForSchema(value: sst.Vote): Promise<ct.Vote> {
    return {
      ...value,
      votes: value.votes.map(vote => {
        return {
          id: vote.user_id,
          name: "Not synced"
        };
      }),
    }
  }
}

class NestedColumnConverter extends ColumnConverter<any, any> {
  private converters: ColumnConverter<any, any>[] = [];
  private syntheticDisplayValueSeparator: string;

  constructor(context: ConversionSettings, column: sst.Column, syntheticDisplayValueSeparator?: string) {
    super(context, column);
    this.syntheticDisplayValueSeparator = syntheticDisplayValueSeparator;
  }

  async _getSchema() {
    let schema = coda.makeObjectSchema({
      properties: {},
      displayProperty: undefined,
      mutable: false,
    });
    for (let column of this.column.nested) {
      if (column.field_type == "hidden_textfield") continue;
      let converter = getConverter(this.settings, column);
      let propertySchema = await converter.getSchema();
      let propertyName = propertySchema.displayName;
      schema.properties[propertyName] = propertySchema;
      if (column.params.primary) {
        schema.displayProperty = propertyName;
      }
    }
    if (!schema.displayProperty && this.syntheticDisplayValueSeparator) {
      schema.properties[SyntheticDisplayPropertyName] = {
        type: coda.ValueType.String,
        fromKey: SyntheticDisplayPropertyKey,
        fixedId: SyntheticDisplayPropertyKey,
        displayName: SyntheticDisplayPropertyName,
        mutable: false,
      };
      schema.displayProperty = SyntheticDisplayPropertyName;
    }
    return schema;
  }

  async _formatValueForSchema(value: any): Promise<any> {
    let result: Record<string, any> = {};
    let values = [];
    for (let column of this.column.nested) {
      if (column.field_type == "hidden_textfield") continue;
      let converter = getConverter(this.settings, column);
      let key = converter.getPropertyKey();
      if (value[key] != null && value[key] != "") {
        let val = await converter.formatValueForSchema(value[key]);
        result[key] = val;
        values.push(val);
      }
    }
    if (this.syntheticDisplayValueSeparator) {
      result[SyntheticDisplayPropertyKey] = values.filter(Boolean).join(this.syntheticDisplayValueSeparator);
    }
    return result;
  }

  async _formatValueForApi(value: any): Promise<any> {
    let result: Record<string, any> = {};
    for (let column of this.column.nested) {
      if (column.field_type == "hidden_textfield") continue;
      let converter = getConverter(this.settings, column);
      let key = converter.getPropertyKey();
      result[key] = await converter.formatValueForApi(value[key]);
    }
    return result;
  }
}

class DueDateColumnConverter extends NestedColumnConverter {
  async _getSchema() {
    let baseSchema = await super._getSchema();
    let result = {
      ...baseSchema,
    }
    result.displayProperty = "End Date";
    return result;
  }
}

class FileColumnConverter extends ColumnConverter<sst.File[], string[]> {
  fileUrls: Record<string, string>;

  constructor(context: ConversionSettings, column: sst.Column) {
    super(context, column);
    this.fileUrls = {};
  }

  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Array,
      items: {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Attachment,
      },
    });
  }

  async _formatValueForSchema(value: sst.File[]): Promise<string[]> {
    return Promise.all(value.map(async file => {
      let sharedFile = await getSharedFile(this.settings.context, file.handle);
      return sharedFile.url;
    }));
  }
}

class LinkedRecordColumnConverter extends ColumnConverter<string, ct.Row> {
  async _getSchema() {
    let linkedTable = await this.getLinkedTable();
    return getReferenceSchema(linkedTable);
  }

  async _formatValueForSchema(value: string): Promise<ct.Row> {
    let linkedTable = await this.getLinkedTable();
    let primaryKey = linkedTable.primary_field;
    return {
      id: value,
      [primaryKey]: NotSyncedMessage,
    };
  }

  async _formatValueForApi(value: ct.Row): Promise<string> {
    return value.id;
  }

  async getLinkedTable() {
    let tableId = this.column.params.linked_application;
    if (!this.settings.relatedTables[tableId]) {
      this.settings.relatedTables[tableId] = await getTable(this.settings.context, tableId);
    }
    return this.settings.relatedTables[tableId];
  }
}

class DependencyColumnConverter extends ColumnConverter<sst.Dependency, ct.Row[]> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Array,
      items: getReferenceSchema(this.settings.table),
    });
  }

  async _formatValueForSchema(value: sst.Dependency): Promise<ct.Row[]> {
    let schema = getReferenceSchema(this.settings.table);
    let propertyKey = schema.properties[schema.displayProperty].fromKey;
    return value?.predecessor?.map(dep => {
      let label = "Not synced";
      if (dep.application != this.settings.context.sync.dynamicUrl) {
        label = "Incompatible: Dependency from another table"
      }
      return {
        id: dep.record,
        [propertyKey]: "Not synced",
      };
    });
  }

  async _formatValueForApi(value: ct.Row[]): Promise<sst.Dependency> {
    return {
      predecessor: value.map(row => {
        return {
          type: "fs",
          lag: 0,
          application: this.settings.context.sync.dynamicUrl,
          record: row.id,
        };
      })
    }
  }
}

class ChecklistColumnConverter extends ColumnConverter<sst.Checklist, ct.Checklist> {
  async _getSchema() {
    let itemSchema = coda.makeObjectSchema({
      properties: {
        preview: { type: coda.ValueType.String, codaType: coda.ValueHintType.Markdown },
        label: { type: coda.ValueType.String },
        completed: { type: coda.ValueType.Boolean },
        assignee: coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member"),
        due_date: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
        completed_at: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
      },
      displayProperty: "preview",
    });
    return coda.makeObjectSchema({
      properties: {
        summary: { type: coda.ValueType.String },
        items: { type: coda.ValueType.Array, items: itemSchema },
      },
      displayProperty: "summary",
      mutable: false,
    });
  }

  async _formatValueForSchema(value: sst.Checklist): Promise<ct.Checklist> {
    return {
      summary: `${value.completed_items} of ${value.total_items}`,
      items: value.items?.map(item => {
        let assignee = item.assignee ? { name: 'Not synced', id: item.assignee } : undefined;
        return {
          preview: `- [${item.completed ? "X": ""}] ${item.content.preview} `,
          label: item.content.preview,
          completed: item.completed,
          assignee: assignee,
          due_date: item.due_date,
          completed_at: item.completed_at,
        };
      }),
    };
  }
}

class TimeTrackkingLogColumnConverter extends ColumnConverter<sst.TimeTrackingLog, ct.TimeTrackingLog> {
  async _getSchema() {
    let entrySchema = coda.makeObjectSchema({
      properties: {
        user: coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member"),
        created: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        duration: { type: coda.ValueType.String, codaType: coda.ValueHintType.Duration },
        note: { type: coda.ValueType.String },
      },
      displayProperty: "created",
    });
    return coda.makeObjectSchema({
      properties: {
        total: { type: coda.ValueType.String, codaType: coda.ValueHintType.Duration },
        entries: { type: coda.ValueType.Array, items: entrySchema },
      },
      displayProperty: "total",
      mutable: false,
    });
  }

  async _formatValueForSchema(value: sst.TimeTrackingLog): Promise<ct.TimeTrackingLog> {
    let entries = value.time_track_logs?.map(item => {
      let user = item.user_id ? { name: 'Not synced', id: item.user_id } : undefined;
      return {
        user: user,
        created: item.date_time,
        duration: `${item.duration} seconds`,
        note: item.note,
      };
    });
    return {
      total: `${value.total_duration} seconds`,
      entries: entries,
    };
  }
}

class ColorColumnConverter extends ColumnConverter<sst.Color, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  async _formatValueForSchema(value: sst.Color): Promise<string> {
    return value.value;
  }

  async _formatValueForApi(value: string): Promise<sst.Color> {
    return {
      value: value,
    };
  }
}

class IpAddressColumnConverter extends ColumnConverter<sst.IpAddress, sst.IpAddress> {
  async _getSchema() {
    return coda.makeObjectSchema({
      properties: {
        address: { type: coda.ValueType.String },
        country_code: { type: coda.ValueType.String },
      },
      displayProperty: "address",
    });
  }
}

class UnknownColumnConverter extends ColumnConverter<any, string> {
  async _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      mutable: false,
    });
  }

  async _formatValueForSchema(value: any): Promise<string> {
    return String(value);
  }
}

function isEmpty(value: any) {
  if (value == undefined || value == null) {
    return true;
  }
  if (typeof value == "object") {
    return Object.values(value).map(val => {
      return !val || isEmpty(val);
    }).every(empty => empty);
  }
  return false;
}