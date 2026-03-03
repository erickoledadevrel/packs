import * as coda from "@codahq/packs-sdk";
import { getConverter } from "./convert";
import { Row, Sheet, SheetFormatSettings, CodaRow } from "./types";

const IdParameterRegex = /^.*\((\d+)\)$/;

export async function formatRowForSchema(context: coda.ExecutionContext, row: Row, sheet: Sheet, settings: SheetFormatSettings): Promise<CodaRow> {
  let result: CodaRow = {
    id: String(row.id),
    rowNumber: row.rowNumber,
    rowLink: row.permalink,
  };

  for (let cell of row.cells ?? []) {
    let column = sheet.columns.find(c => c.id == cell.columnId);
    let converter = getConverter(column, sheet, settings);
    let key = cell.columnId;
    let value = converter.formatValueForSchema(cell);
    result[key] = value;
  }
  return result;
}

export function formatRowForApi(row: CodaRow, sheet: Sheet, settings: SheetFormatSettings): Row {
  let result: Row = {
    id: parseInt(row.id),
    cells: [],
  };
  for (let [key, value] of Object.entries(row)) {
    if (key == "id") continue;
    let column = sheet.columns.find(c => c.id == parseInt(key));
    let converter = getConverter(column, sheet, settings);
    let cell = converter.formatValueForApi(value);
    result.cells.push(cell);
  }
  return result;
}

export function parseIdParameter(value: string): number {
  if (!value) return undefined;
  let num = parseInt(value);
  if (!isNaN(num)) return num;
  let extracted = value.trim().match(IdParameterRegex)?.[1];
  if (extracted) return parseInt(extracted);
  throw new coda.UserVisibleError(`Invalid parameter value: ${value}`);
}

