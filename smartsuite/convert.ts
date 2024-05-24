import * as coda from "@codahq/packs-sdk";
import { CodaMember as CodaMemberReference, CodaOption, CodaPerson, SmartSuiteColumn, SmartSuiteDateField, SmartSuiteDatePersonField as SmartSuiteMemberDateField, SmartSuitePhoneField, SmartSuiteRichTextField, SmartSuiteStatus } from "./types";
import { MemberSchema } from "./schemas";

export function getConverter(
  column: SmartSuiteColumn,
): ColumnConverter<any, any> {
  switch (column.field_type) {
    // Text
    case "textfield":
    case "recordtitlefield":
      return new TextColumnConverter(column);
    case "richtextareafield":
      return new HtmlColumnConverter(column);
    case "linkfield":
      return new LinkColumnConverter(column);

    // Numbers
    case "numberfield":
      return new NumberColumnConverter(column);
    case "numbersliderfield":
      return new SliderColumnConverter(column);
    case "percentfield":
      return new PercentColumnConverter(column);
    case "currencyfield":
      return new CurrencyColumnConverter(column);

    // Dates and times
    case "datefield":
      // TODO: Handle date + time.
      return new DateColumnConverter(column);
    case "timefield":
      return new TimeColumnConverter(column);

    // Select lists
    case "singleselectfield":
    case "multipleselectfield":
    case "statusfield":
      return new SelectListColumnConverter(column);

    // People and contacts
    case "userfield":
      return new MemberColumnConverter(column);
    case "phonefield":
      return new PhoneColumnConverter(column);

    // Metadata
    case "firstcreatedfield":
    case "lastupdatedfield":
          return new MemberDatePairColumnConverter(column);
    default:
      // Composites
      if (column.nested) {
        return new SplitNestedColumnConverter(column);
      }
      console.error(`No converter found for column type: ${column.field_type}`);
      return new UnknownColumnConverter(column);
  }
}

// Abstract class that all converter classes extend.
abstract class ColumnConverter<T, C> {
  column: SmartSuiteColumn;

  constructor(column: SmartSuiteColumn) {
    this.column = column;
  }

  getColumnCount(): number {
    return 1;
  }

  getSchemas(): Array<coda.Schema & coda.ObjectSchemaProperty> {
    let schema = this._getBaseSchema();
    let schemas = Array.isArray(schema) ? schema : [schema];
    let propertyKeys = this.getPropertyKeys();
    let propertyNames = this.getPropertyNames();
    for (let [i, schema] of schemas.entries()) {
      let propertyKey = propertyKeys[i];
      let propertyName = propertyNames[i];
      schema.fixedId = propertyKey;
      schema.fromKey = propertyKey;
      if (schema.mutable === undefined) {
        schema.mutable = !this.column.params.system
          && !this.column.params.is_auto_generated;
      }
      schema.displayName = propertyName;
      schema.description = this.column.params.help_text;
    }
    return schemas;
  }

  // Each implementation must define the base property schema.
  abstract _getBaseSchema(): coda.Schema & coda.ObjectSchemaProperty | Array<coda.Schema & coda.ObjectSchemaProperty>;

  getPropertyKeys(): string[] {
    return [this.column.slug];
  }

  getPropertyNames(): string[] {
    return [this.column.label];
  }

  // Default to passing through the value as-is, in both directions.
  formatValueForSchema(value: T): C | C[] {
    return value as any;
  }

  formatValueForApi(value: C): T | string | string[] {
    return value as any;
  }
}

class TextColumnConverter extends ColumnConverter<string, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }
}

class NumberColumnConverter extends ColumnConverter<string, number> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      precision: this.column.params.precision,
      useThousandsSeparator: this.column.params.separator,
    });
  }

  formatValueForSchema(value: string): number {
    return Number(value);
  }

  formatValueForApi(value: number): string {
    return String(value);
  }
}

class SliderColumnConverter extends ColumnConverter<number, number> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.Slider,
      minimum: this.column.params.min_value,
      maximum: this.column.params.max_value,
      step: this.column.params.value_increment,
    });
  }
}

class PercentColumnConverter extends NumberColumnConverter {
  _getBaseSchema() {
    return coda.makeSchema({
      ...super._getBaseSchema(),
      codaType: coda.ValueHintType.Percent,
    });
  }

  formatValueForSchema(value: string): number {
    return Number(value) / 100;
  }

  formatValueForApi(value: number): string {
    return String(value * 100);
  }
}

class CurrencyColumnConverter extends NumberColumnConverter {
  _getBaseSchema() {
    return coda.makeSchema({
      ...super._getBaseSchema(),
      codaType: coda.ValueHintType.Currency,
      currencyCode: this.column.params.currency,
      // For some reason this field doesn't exist on the CurrencySchema,
      // so we need to unset it.
      useThousandsSeparator: undefined,
    });
  }
}

class DateColumnConverter extends ColumnConverter<SmartSuiteDateField, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    });
  }

  formatValueForSchema(value: SmartSuiteDateField) {
    if (!value || !value.date) return undefined;
    if (value.include_time) {
      return value.date;
    } else {
      return value.date.split("T")[0];
    }
  }

  // Pass the date back as a string.
  formatValueForApi(value: string): SmartSuiteDateField {
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
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Time,
    });
  }
}

class PhoneColumnConverter extends ColumnConverter<SmartSuitePhoneField[], string | string[]> {
  _getBaseSchema() {
    let schema: coda.Schema = coda.makeSchema({
      type: coda.ValueType.String,
    });
    if (this.column.params.entries_allowed == "multiple") {
      schema = coda.makeSchema({
        type: coda.ValueType.Array,
        items: schema,
      });
    }
    return schema;
  }

  formatValueForSchema(value: SmartSuitePhoneField[]) {
    let phones = value.map(phone => phone.sys_title);
    if (this.column.params.entries_allowed == "single") {
      return phones[0];
    }
    return phones;
  }

  formatValueForApi(value: string | string[]): string[] {
    let phones = Array.isArray(value) ? value:  [value];
    for (let phone of phones) {
      if (!phone.trim().startsWith("+")) {
        throw new coda.UserVisibleError("Phone number doesn't start with a plus and country code: " + phone);
      }
    }
    return phones;
  }
}

class MemberDatePairColumnConverter extends ColumnConverter<SmartSuiteMemberDateField, [CodaMemberReference, string]> {
  _getBaseSchema() {
    return [
      coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member"),
      coda.makeSchema({
        type: coda.ValueType.String,
        codaType: coda.ValueHintType.DateTime,
        mutable: false,
      }),
    ];
  }

  getPropertyKeys(): string[] {
    return [
      this.column.slug + ".by",
      this.column.slug + ".on",
    ]
  }

  getPropertyNames(): string[] {
    return [
      this.column.label + " By",
      this.column.label + " On",
    ];
  }

  formatValueForSchema(value: SmartSuiteMemberDateField): [CodaMemberReference, string] {
    let person: CodaMemberReference = {
      name: "Not found",
      id: value.by,
    };
    return [person, value.on];
  }
}

class SelectListColumnConverter extends ColumnConverter<string | string[] | SmartSuiteStatus, CodaOption | CodaOption[]> {
  _getBaseSchema() {
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

  formatValueForSchema(value: string | string[] | SmartSuiteStatus): CodaOption | CodaOption[] {
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

  formatValueForApi(value: CodaOption | CodaOption[]): string | string[] {
    if (value instanceof Array) {
      return value.map(val => val.value);
    } else {
      return value.value;
    }
  }
}

class HtmlColumnConverter extends ColumnConverter<SmartSuiteRichTextField, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Html,
      // All formatting is lost on edit.
      mutable: false,
    });
  }

  formatValueForSchema(value: SmartSuiteRichTextField): string {
    return value.html.replaceAll("\n", "").trim();
  }
}

class LinkColumnConverter extends ColumnConverter<string[], string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    });
  }
  
}

class MemberColumnConverter extends ColumnConverter<string[], CodaMemberReference> {
  _getBaseSchema() {
    return coda.makeReferenceSchemaFromObjectSchema(MemberSchema, "Member");
  }

  formatValueForSchema(value: string[]): CodaMemberReference {
    return {
      name: "Not found",
      id: value[0],
    };
  }

  formatValueForApi(value: CodaMemberReference): string[] {
    return [value.id];
  }
}

class SplitNestedColumnConverter extends ColumnConverter<any, string> {
  private converters: ColumnConverter<any, any>[] = [];

  constructor(column) {
    super(column);
    for (let sub of column.nested) {
      this.converters.push(getConverter(sub));
    }
  }

  _getBaseSchema() {
    return this.converters.map(converter => {
      return {
        ...converter.getSchemas()[0],
        // TODO: Find a way to make these mutable.
        mutable: false,
      };
    });
  }

  getPropertyKeys(): string[] {
    return this.converters.map(converter => this.column.slug + "." + converter.getPropertyKeys()[0]);
  }

  getPropertyNames(): string[] {
    return this.converters.map(converter => this.column.label + " - " + converter.getPropertyNames()[0]);
  }

  formatValueForSchema(value: any): string[] {
    return this.converters.map(converter => converter.formatValueForSchema(value[converter.getPropertyKeys()[0]]));
  }
}

class UnknownColumnConverter extends ColumnConverter<any, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      mutable: false,
    });
  }

  formatValueForSchema(value: any) {
    if (value == undefined || value == null) {
      return undefined;
    }
    return String(value);
  }
}
