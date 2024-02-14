import * as coda from "@codahq/packs-sdk";
import { Cell, Column, SheetFormatSettings, Sheet, Row, CodaRow, CodaPerson } from "./types";

export function getConverter(
  column: Column,
  sheet: Sheet,
  settings: SheetFormatSettings,
): ColumnConverter<any, any> {
  if (!settings.useColumnTypes) {
    return new AnyColumnConverter(column, sheet);
  }
  switch (column.type) {
    case "CHECKBOX":
      return new BooleanColumnConverter(column, sheet);
    case "CONTACT_LIST":
      return new ContactListColumnConverter(column, sheet);
    case "DATE":
      return new DateColumnConverter(column, sheet);
    case "DATETIME":
      return new DateTimeColumnConverter(column, sheet);
    case "DURATION":
      return new DurationColumnConverter(column, sheet);
    // case "MULTI_CONTACT_LIST":
    // case "MULTI_PICKLIST":
    case "PICKLIST":
      return new PicklistColumnConverter(column, sheet);
    case "TEXT_NUMBER":
      return new TextOrNumberColumnConverter(column, sheet);
    default:
      console.error(`No converter found for column type: ${column.type}`);
      return new UnknownColumnConverter(column, sheet);
  }
}

// Abstract class that all converter classes extend.
abstract class ColumnConverter<T, C> {
  column: Column;
  sheet: Sheet;

  constructor(column: Column, sheet: Sheet) {
    this.column = column;
    this.sheet = sheet;
  }

  getSchema(): coda.Schema & coda.ObjectSchemaProperty {
    let schema = this._getBaseSchema();
    schema.fixedId = String(this.column.id);
    schema.fromKey = String(this.column.id);
    schema.mutable = !this.column.systemColumnType;
    schema.displayName = this.column.title;
    schema.description = this.column.description;
    return schema;
  }

  // Each implementation must define the base property schema.
  abstract _getBaseSchema(): coda.Schema & coda.ObjectSchemaProperty;

  // Default to passing through the value as-is, in both directions.
  formatValueForSchema(cell: Cell<T>): C {
    return cell.value as any;
  }

  formatValueForApi(value: C): Cell<T> {
    return {
      columnId: this.column.id,
      value: value as any
    };
  }
}

class AnyColumnConverter extends ColumnConverter<any, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  formatValueForSchema(cell: Cell<any>) {
    if (cell.value == undefined || cell.value == null) {
      return undefined;
    }
    return String(cell.value);
  }
}

class BooleanColumnConverter extends ColumnConverter<boolean, boolean> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.Boolean,
    });
  }
}

class ContactListColumnConverter extends ColumnConverter<string, CodaPerson> {
  _getBaseSchema() {
    return coda.makeObjectSchema({
      codaType: coda.ValueHintType.Person,
      properties: {
        name: { type: coda.ValueType.String },
        email: { type: coda.ValueType.String, required: true },
      },
      displayProperty: "name",
      idProperty: "email",
    });
  }

  formatValueForSchema(cell: Cell<string>): CodaPerson {
    if (cell.value == undefined || cell.value == null) {
      return undefined;
    }
    return {
      name: cell.displayValue,
      email: cell.value,
    };
  }

  formatValueForApi(value: CodaPerson): Cell<string> {
    return {
      columnId: this.column.id,
      value: value?.email ?? "",
    }
  }
}

class DateColumnConverter extends ColumnConverter<string, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    });
  }
}

class DateTimeColumnConverter extends ColumnConverter<string, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
    });
  }
}

class DurationColumnConverter extends ColumnConverter<string, string> {
  Units: [string, number][] = [
    ["w", 1],
    ["d", 7],
    ["h", 24],
    ["m", 60],
    ["s", 60],
    ["ms", 1000],
  ];

  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Duration,
    });
  }

  formatValueForSchema(cell: Cell<string>) {
    // Bug where only the display value is set for duration columns after a row edit.
    let value = cell.value ?? cell.displayValue;
    if (value == undefined || value == null) {
      return undefined;
    }
    let segments = value.split(" ")
      .map(segment => segment.match(/(\d+)(.*)/)
      .slice(1));
    let total = 0;
    let segment = segments.shift();
    for (let [unit, ratio] of this.Units) {
      total *= ratio;
      if (segment?.[1] == unit) {
        total += parseInt(segment[0]);
        if (segments.length > 0) {
          segment = segments.shift();
        }
      }
    }
    let seconds = Math.floor(total / 1000);
    return `${seconds} secs`;
  }

  formatValueForApi(value: string): Cell<string> {
    throw new Error("Not implemented");
  }
}

class PicklistColumnConverter extends ColumnConverter<string, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.SelectList,
      options: this.column.options,
    });
  }
}

class TextOrNumberColumnConverter extends ColumnConverter<string|number, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
    });
  }

  formatValueForSchema(cell: Cell<string|number>) {
    if (cell.value == undefined || cell.value == null) {
      return undefined;
    }
    return String(cell.value);
  }

  formatValueForApi(value: string): Cell<string|number> {
    let apiValue: string|number = value;
    if (!Number.isNaN(parseInt(value))) {
      apiValue = parseInt(value);
    }
    return {
      columnId: this.column.id,
      value: apiValue,
    };
  }
}

class UnknownColumnConverter extends ColumnConverter<any, string> {
  _getBaseSchema() {
    return coda.makeSchema({
      type: coda.ValueType.String,
      mutable: false,
    });
  }

  formatValueForSchema(cell: Cell<any>) {
    if (cell.value == undefined || cell.value == null) {
      return undefined;
    }
    return String(cell.value);
  }
}
