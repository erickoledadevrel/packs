import * as coda from "@codahq/packs-sdk";
import { CodaDatePersonField, CodaMember as CodaMemberReference, CodaOption, CodaPerson, CodaRow, SmartSuiteColumn, SmartSuiteDateField, SmartSuiteDependency, SmartSuiteDueDate, SmartSuiteFile, SmartSuiteDatePersonField as SmartSuiteMemberDateField, SmartSuitePhoneField, SmartSuiteRichTextField, SmartSuiteStatus } from "./types";
import { BaseRowSchema, MemberSchema, TitlePropertyName } from "./schemas";

const SyntheticDisplayPropertyKey = "_display";
const SyntheticDisplayPropertyName = "Display";
const SecondsPerDay = 60 * 60 * 24;

export function getConverter(context: coda.ExecutionContext, column: SmartSuiteColumn): ColumnConverter<any, any> {
  switch (column.field_type) {
    // Text
    case "textfield":
    case "recordtitlefield":
    case "textareafield":
      return new TextColumnConverter(context, column);
    case "richtextareafield":
      return new HtmlColumnConverter(context, column);
    case "linkfield":
      return new LinkColumnConverter(context, column);
    case "emailfield":
      return new EmailColumnConverter(context, column);
    case "fullnamefield":
      return new NestedColumnConverter(context, column, " ");

    // Numbers
    case "numberfield":
      return new NumberColumnConverter(context, column);
    case "numbersliderfield":
      return new SliderColumnConverter(context, column);
    case "percentfield":
      return new PercentColumnConverter(context, column);
    case "currencyfield":
      return new CurrencyColumnConverter(context, column);
    case "percentcompletefield":
      return new ProgressColumnConverter(context, column);
    case "ratingfield":
      return new ScaleColumnConverter(context, column);

    // Dates and times
    case "datefield":
      // TODO: Handle date + time.
      return new DateColumnConverter(context, column);
    case "timefield":
      return new TimeColumnConverter(context, column);
    case "duedatefield":
      return new DueDateColumnConverter(context, column);
    case "daterangefield":
      return new NestedColumnConverter(context, column, " - ");
    case "durationfield":
      return new DurationColumnConverter(context, column);

    // Select lists
    case "singleselectfield":
    case "multipleselectfield":
    case "statusfield":
      return new SelectListColumnConverter(context, column);

    // Relations
    case "linkedrecordfield":
      return new LinkedRecordColumnConverter(context, column);
    case "dependencyfield":
      return new DependencyColumnConverter(context, column);

    // People and contacts
    case "userfield":
      return new MemberColumnConverter(context, column);
    case "phonefield":
      return new PhoneColumnConverter(context, column);
    case "addressfield":
      return new NestedColumnConverter(context, column, ", ");

    // Media
    case "filefield":
      return new FileColumnConverter(context, column);

    // Metadata
    case "firstcreatedfield":
    case "lastupdatedfield":
      return new MemberDatePairColumnConverter(context, column);
    case "commentscountfield":
    case "autonumberfield":
      return new NumberColumnConverter(context, column);

    default:
      // Composites
      if (column.nested) {
        return new NestedColumnConverter(context, column);
      }
      console.error(`No converter found for column type: ${column.field_type}`);
      return new UnknownColumnConverter(context, column);
  }
}

// Abstract class that all converter classes extend.
abstract class ColumnConverter<T, C> {
  context: coda.ExecutionContext;
  column: SmartSuiteColumn;

  constructor(context: coda.ExecutionContext, column: SmartSuiteColumn) {
    this.context = context;
    this.column = column;
  }

  getColumnCount(): number {
    return 1;
  }

  getSchema(): coda.Schema & coda.ObjectSchemaProperty {
    let schema = this._getSchema();
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
  abstract _getSchema(): coda.Schema & coda.ObjectSchemaProperty;

  getPropertyKey(): string {
    return this.column.slug;
  }

  getPropertyName(): string {
    if (this.column.params.primary) {
      return TitlePropertyName;
    }
    return this.column.label;
  }

  getColumnName(): string {
    return this.column.label;
  }

  async formatValueForSchema(value: T | T[]): Promise<C | C[]> {
    if (Array.isArray(value)) {
      if (this.column.params.entries_allowed == "multiple") {
        return Promise.all(value.map(v => this._formatValueForSchema(v)));
      } else if (this.column.params.entries_allowed == "single") {
        return this._formatValueForSchema(value[0]);  
      }
    }
    return this._formatValueForSchema(value as T);
  }


  formatValueForApi(value: C | C[]): T | T[] {
    if (this.column.params.entries_allowed == "multiple" && Array.isArray(value)) {
      return value.map(v => this._formatValueForApi(v));
    } else if (this.column.params.entries_allowed == "single") {
      return [this._formatValueForApi(value as C)];
    }
    return this._formatValueForApi(value as C);
  }

  // Default to passing through the value as-is, in both directions.
  async _formatValueForSchema(value: T): Promise<C> {
    return value as any;
  }

  _formatValueForApi(value: C): T {
    return value as any;
  }
}

class TextColumnConverter extends ColumnConverter<string, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }
}

class NumberColumnConverter extends ColumnConverter<string, number> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      precision: this.column.params.precision,
      useThousandsSeparator: this.column.params.separator,
    });
  }

  async _formatValueForSchema(value: string): Promise<number> {
    return Number(value);
  }

  _formatValueForApi(value: number): string {
    return String(value);
  }
}

class SliderColumnConverter extends ColumnConverter<number, number> {
  _getSchema() {
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
  _getSchema() {
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
  _getSchema() {
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
  _getSchema() {
    return coda.makeSchema({
      ...super._getSchema(),
      codaType: coda.ValueHintType.Percent,
    });
  }

  async _formatValueForSchema(value: string): Promise<number> {
    return Number(value) / 100;
  }

  _formatValueForApi(value: number): string {
    return String(value * 100);
  }
}

class CurrencyColumnConverter extends NumberColumnConverter {
  _getSchema() {
    return coda.makeSchema({
      ...super._getSchema(),
      codaType: coda.ValueHintType.Currency,
      currencyCode: this.column.params.currency,
      // For some reason this field doesn't exist on the CurrencySchema,
      // so we need to unset it.
      useThousandsSeparator: undefined,
    });
  }
}

class DateColumnConverter extends ColumnConverter<SmartSuiteDateField, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    });
  }

  async _formatValueForSchema(value: SmartSuiteDateField): Promise<string> {
    if (!value || !value.date) return undefined;
    if (value.include_time) {
      return value.date;
    } else {
      return value.date.split("T")[0];
    }
  }

  // Pass the date back as a string.
  _formatValueForApi(value: string): SmartSuiteDateField {
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
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Time,
    });
  }
}

class DurationColumnConverter extends ColumnConverter<number, number> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Duration,
    });
  }

  async _formatValueForSchema(value: number): Promise<number> {
    return value / SecondsPerDay;
  }

  _formatValueForApi(value: number): number {
    return value * SecondsPerDay;
  }
}

class PhoneColumnConverter extends ColumnConverter<SmartSuitePhoneField | string, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  async _formatValueForSchema(value: SmartSuitePhoneField): Promise<string>{
    return value.sys_title;
  }

  _formatValueForApi(value: string): string {
    if (!value.trim().startsWith("+")) {
      throw new coda.UserVisibleError("Phone number doesn't start with a plus and country code: " + value);
    }
    return value;
  }
}

class MemberDatePairColumnConverter extends ColumnConverter<SmartSuiteMemberDateField, CodaDatePersonField> {
  _getSchema() {
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

  async _formatValueForSchema(value: SmartSuiteMemberDateField): Promise<CodaDatePersonField> {
    let person: CodaMemberReference = {
      name: "Not synced",
      id: value.by,
    };
    return {by: person, on: value.on};
  }
}

class SelectListColumnConverter extends ColumnConverter<string | string[] | SmartSuiteStatus, CodaOption | CodaOption[]> {
  _getSchema() {
    let schema: coda.Schema = coda.makeObjectSchema({
      properties: {
        label: { type: coda.ValueType.String },
        value: { type: coda.ValueType.String },
      },
      codaType: coda.ValueHintType.SelectList,
      options: coda.OptionsType.Dynamic,
      allowNewValues: this.column.params.new_choices_allowed,
    });
    if (this.column.field_type == "multipleselectfield") {
      schema = coda.makeSchema({
        type: coda.ValueType.Array,
        items: schema,
      });
    }
    return schema;
  }

  async _formatValueForSchema(value: string | string[] | SmartSuiteStatus): Promise<CodaOption | CodaOption[]> {
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

  _formatValueForApi(value: CodaOption | CodaOption[]): string | string[] {
    if (value instanceof Array) {
      return value.map(val => val.value);
    } else {
      return value.value;
    }
  }
}

class HtmlColumnConverter extends ColumnConverter<SmartSuiteRichTextField, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      // All formatting is lost on edit.
      mutable: false,
    });
  }

  async _formatValueForSchema(value: SmartSuiteRichTextField): Promise<string> {
    return value.html.replaceAll("\n", "").trim();
  }
}

class LinkColumnConverter extends ColumnConverter<string, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      display: this.column.params.display_format == "favicon_only" ? coda.LinkDisplayType.IconOnly : coda.LinkDisplayType.Url,
    });
  }
}

class EmailColumnConverter extends ColumnConverter<string, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Email,
    });
  }
}

class MemberColumnConverter extends ColumnConverter<string, CodaMemberReference> {
  _getSchema() {
    return coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member");
  }

  async _formatValueForSchema(value: string): Promise<CodaMemberReference> {
    return {
      name: "Not synced",
      id: value,
    };
  }

  _formatValueForApi(value: CodaMemberReference): string {
    return value.id;
  }
}

class NestedColumnConverter extends ColumnConverter<any, any> {
  private converters: ColumnConverter<any, any>[] = [];
  private syntheticDisplayValueSeparator: string;

  constructor(context: coda.ExecutionContext, column: SmartSuiteColumn, syntheticDisplayValueSeparator?: string) {
    super(context, column);
    this.syntheticDisplayValueSeparator = syntheticDisplayValueSeparator;
  }

  _getSchema() {
    let schema = coda.makeObjectSchema({
      properties: {},
      displayProperty: undefined,
      mutable: false,
    });
    for (let column of this.column.nested) {
      if (column.field_type == "hidden_textfield") continue;
      let converter = getConverter(this.context, column);
      let propertySchema = converter.getSchema();
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
      let converter = getConverter(this.context, column);
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

  _formatValueForApi(value: any) {
    let result: Record<string, any> = {};
    for (let column of this.column.nested) {
      if (column.field_type == "hidden_textfield") continue;
      let converter = getConverter(this.context, column);
      let key = converter.getPropertyKey();
      result[key] = converter.formatValueForApi(value[key]);
    }
    return result;
  }
}

class DueDateColumnConverter extends NestedColumnConverter {
  constructor(context, column) {
    super(context, column);
  }

  _getSchema() {
    let result = super._getSchema();
    result.displayProperty = "End Date";
    return result;
  }
}

class FileColumnConverter extends ColumnConverter<SmartSuiteFile[], string[]> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Array,
      items: {
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.Attachment,
      },
    });
  }

  async _formatValueForSchema(value: SmartSuiteFile[]): Promise<string[]> {
    return Promise.all(value.map(async file => {
      let response = await this.context.fetcher.fetch({
        method: "GET",
        url: `https://app.smartsuite.com/api/v1/shared-files/${file.handle}/url/`,
      });
      return response.body.url as string;
    }));
  }
}

class LinkedRecordColumnConverter extends ColumnConverter<string, CodaRow> {
  _getSchema() {
    let schema = coda.makeReferenceSchemaFromObjectSchema(BaseRowSchema, "Record");
    schema.identity.dynamicUrl = this.column.params.linked_application;
    return schema;
  }

  async _formatValueForSchema(value: string): Promise<CodaRow> {
    return {
      id: value,
      title: "Not synced",
    };
  }

  _formatValueForApi(value: CodaRow): string {
    return value.id;
  }
}

class DependencyColumnConverter extends ColumnConverter<SmartSuiteDependency, CodaRow[]> {
  _getSchema() {
    let schema = coda.makeReferenceSchemaFromObjectSchema(BaseRowSchema, "Record");
    schema.identity.dynamicUrl = this.context.sync.dynamicUrl;
    return coda.makeSchema({
      type: coda.ValueType.Array,
      items: schema,
    });
  }

  async _formatValueForSchema(value: SmartSuiteDependency): Promise<CodaRow[]> {
    return value?.predecessor?.map(dep => {
      let title = "Not synced";
      if (dep.application != this.context.sync.dynamicUrl) {
        title = "Incompatible: Dependency from another table"
      }
      return {
        id: dep.record,
        title: "Not synced",
      };
    });
  }

  _formatValueForApi(value: CodaRow[]): SmartSuiteDependency {
    return {
      predecessor: value.map(row => {
        return {
          type: "fs",
          lag: 0,
          application: this.context.sync.dynamicUrl,
          record: row.id,
        };
      })
    }
  }
}

class UnknownColumnConverter extends ColumnConverter<any, string> {
  _getSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      mutable: false,
    });
  }

  async _formatValueForSchema(value: any): Promise<string> {
    if (value == undefined || value == null) {
      return undefined;
    }
    return String(value);
  }
}
