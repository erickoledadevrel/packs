import * as coda from "@codahq/packs-sdk";
import { CodaMember as CodaMemberReference, CodaOption, CodaPerson, Column, SmartSuiteDateField, SmartSuiteDatePersonField as SmartSuiteMemberDateField, SmartSuitePhoneField, SmartSuiteRichTextField } from "./types";
import { MemberSchema } from "./schemas";

export function getConverter(
  column: Column,
): ColumnConverter<any, any> {
  switch (column.field_type) {
    case "textfield":
    case "recordtitlefield":
      return new TextColumnConverter(column);
    case "richtextareafield":
      return new HtmlColumnConverter(column);
    case "datefield":
      // TODO: Handle date + time.
      return new DateColumnConverter(column);
    case "phonefield":
      return new PhoneColumnConverter(column);
    case "singleselectfield":
      return new SelectListColumnConverter(column);
    case "userfield":
      return new MemberColumnConverter(column);
    case "firstcreatedfield":
    case "lastupdatedfield":
          return new MemberDatePairColumnConverter(column);
    default:
      console.error(`No converter found for column type: ${column.field_type}`);
      return new UnknownColumnConverter(column);
  }
}

// Abstract class that all converter classes extend.
abstract class ColumnConverter<T, C> {
  column: Column;

  constructor(column: Column) {
    this.column = column;
  }

  getColumnCount(): number {
    return 1;
  }

  getSchemas(): Array<coda.Schema & coda.ObjectSchemaProperty> {
    let schema = this._getBaseSchema();
    let schemas = Array.isArray(schema) ? schema : [schema];
    let propertyKeys = this.getPropertyKeys();
    let propertyNames = this._getPropertyNames();
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

  _getPropertyNames(): string[] {
    return [this.column.label];
  }

  // Default to passing through the value as-is, in both directions.
  formatValueForSchema(value: T): C | C[] {
    return value as any;
  }

  formatValueForApi(value: C): T | string {
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

class PhoneColumnConverter extends ColumnConverter<SmartSuitePhoneField, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  formatValueForSchema(value: SmartSuitePhoneField) {
    return value.sys_title;
  }

  formatValueForApi(value: string): SmartSuitePhoneField {
    return {
      phone_number: value,
    };
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

  _getPropertyNames(): string[] {
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

class SelectListColumnConverter extends ColumnConverter<string, CodaOption> {
  _getBaseSchema() {
    return coda.makeObjectSchema({
      properties: {
        label: { type: coda.ValueType.String },
        value: { type: coda.ValueType.String },
      },
      codaType: coda.ValueHintType.SelectList,
      options: coda.OptionsType.Dynamic,
      allowNewValues: this.column.params.new_choices_allowed,
    });
  }

  formatValueForSchema(value: string): CodaOption {
    let option = this.column.params.choices.find(choice => choice.value == value);
    return {
      label: option?.label ?? "Unknown",
      value: value,
    };
  }

  formatValueForApi(value: CodaOption): string {
    return value.value;
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
    return value.html.replaceAll("\n", "");
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
