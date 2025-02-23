import * as coda from "@codahq/packs-sdk";
import { getConverter } from "./convert";
import { CodaRow, Row, Sheet, SheetFormatSettings } from "./types";
import { getSheet, syncSheet, updateRows, getRows, searchSheets } from "./api";

export const pack = coda.newPack();

const HomeUrl = "https://api.smartsheet.com/2.0/folders/personal";
const WorkspacesUrl = "https://api.smartsheet.com/2.0/workspaces";
export const PageSize = 100;
const IdParameterRegex = /^.*\((\d+)\)$/;
const SheetUrlRegex = new RegExp("https://app.smartsheet.com/sheets/([^?/]+)")

const BaseRowSchema = coda.makeObjectSchema({
  properties: {
    rowId: {
      type: coda.ValueType.String,
      fromKey: "id",
      description: "The unique ID of the row.",
    },
    rowNumber: {
      type: coda.ValueType.Number,
      description: "The order of the row in the sheet. Useful for sorting."
    },
    rowLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "A permalink to this row in the Smartsheet application.",
    }
  },
  idProperty: "rowId",
  displayProperty: undefined,
  featuredProperties: [],
});

pack.addNetworkDomain("smartsheet.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://app.smartsheet.com/b/authorize",
  tokenUrl: "https://api.smartsheet.com/2.0/token",
  scopes: [
    "READ_SHEETS",
    "WRITE_SHEETS",
  ],
  getConnectionName: async function (context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://api.smartsheet.com/2.0/users/me",
    });
    let user = response.body;
    return `${user.firstName} ${user.lastName}`;
  },
});

pack.addDynamicSyncTable({
  name: "Sheet",
  description: "Sync the contents of a sheet.",
  identityName: "Row",
  listDynamicUrls: async function (context, containerUrl) {
    let url = containerUrl;
    let results: coda.MetadataFormulaObjectResultType[] = [];
    if (!url) {
      url = HomeUrl;
      results.push({
        display: "Workspaces",
        value: WorkspacesUrl,
        hasChildren: true
      });
    }
    let response = await context.fetcher.fetch({
      method: "GET",
      url: url,
    });
    let item = response.body;
    for (let meta of item.data ?? []) {
      results.push({
        display: meta.name,
        value: coda.joinUrl(url, String(meta.id)),
        hasChildren: true,
      });
    }
    for (let folder of item.folders ?? []) {
      results.push({
        display: folder.name,
        value: `https://api.smartsheet.com/2.0/folders/${folder.id}`,
        hasChildren: true,
      });
    }
    for (let sheet of item.sheets ?? []) {
      results.push({
        display: sheet.name,
        value: `https://api.smartsheet.com/2.0/sheets/${sheet.id}`,
      });
    }
    return results;
  },
  searchDynamicUrls: async function (context, search) {
    let results = await searchSheets(context, search);
    return results
      .map(sheet => {
        let label = sheet.name;
        if (sheet.parent) {
          label += ` (${sheet.parent})`;
        }
        return {display: label, value: sheet.url};
      });
  },
  getName: async function (context) {
    let sheetUrl = context.sync.dynamicUrl;
    let sheet = await getSheet(context, sheetUrl);
    return sheet.name;
  },
  getSchema: async function (context, _, args) {
    let sheetUrl = context.sync.dynamicUrl;
    let {columns, useColumnTypes} = args;
    let selectedColumnIds = columns?.map(column => parseIdParameter(column));
    let settings: SheetFormatSettings = {useColumnTypes};

    let sheet = await getSheet(context, sheetUrl);
    let schema: coda.GenericObjectSchema = coda.makeObjectSchema({
      ...BaseRowSchema,
      properties: {
        ...BaseRowSchema.properties,
      }
    });
    for (let column of sheet.columns) {
      if (selectedColumnIds && !selectedColumnIds.includes(column.id)) continue;
      let propertyName = `${column.title} Col${String(column.id)}`;
      let converter = getConverter(column, sheet, settings);
      schema.properties[propertyName] = converter.getSchema();
      schema.featuredProperties.push(propertyName);
      if (column.primary) {
        schema.displayProperty = propertyName;
      }
    }
    return schema;
  },
  getDisplayUrl: async function (context) {
    let sheetUrl = context.sync.dynamicUrl;
    let sheet = await getSheet(context, sheetUrl);
    return sheet.permalink;
  },
  formula: {
    name: "SyncSheet",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "filter",
        description: "The filter to apply.",
        optional: true,
        autocomplete: async function (context) {
          let sheet = await getSheet(context, context.sync.dynamicUrl);
          return sheet.filters?.map(filter => `${filter.name} (${filter.id})`);
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "columns",
        description: "The columns to include.",
        optional: true,
        autocomplete: async function (context) {
          let sheet = await getSheet(context, context.sync.dynamicUrl);
          return sheet.columns?.map(column => `${column.title} (${column.id})`);
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "useColumnTypes",
        description: "Respect the column types set in the sheet.",
        optional: true,
        suggestedValue: true,
      }),
    ],
    execute: async function (args, context) {
      let [filter, columns, useColumnTypes = false] = args;
      let filterId = parseIdParameter(filter);
      let columnIds = columns?.map(column => parseIdParameter(column));
      let page = context.sync.continuation?.page as number ?? 1;
      let settings: SheetFormatSettings = {filterId, columnIds, useColumnTypes, page};
      let sheetUrl = context.sync.dynamicUrl;
      let sheet = await syncSheet(context, sheetUrl, settings);
      let result = await Promise.all(sheet.rows.map(row => {
        return formatRowForSchema(context, row, sheet, settings);
      }));
      let continuation;
      if (sheet.rows?.length > 0 && sheet.rows.at(-1).rowNumber < (sheet.filteredRowCount ?? sheet.totalRowCount)) {
        continuation = { page: page + 1 };
      }
      return {
        result: result,
        continuation,
      };
    },
    maxUpdateBatchSize: PageSize,
    executeUpdate: async function (args, updates, context) {
      let sheetUrl = context.sync.dynamicUrl;
      let [_filter, _columns, useColumnTypes = false] = args;
      let settings: SheetFormatSettings = {useColumnTypes};
      let sheet = await getSheet(context, sheetUrl);
      let rows = updates.map(update => {
        let row = Object.fromEntries(
          Object.entries(update.newValue)
            .filter(([key]) => update.updatedFields.includes(key) || key == "id")
        ) as CodaRow;
        return formatRowForApi(row, sheet, settings);
      });
      let {result, failedItems} = await updateRows(context, sheetUrl, rows);
      let rowIds = result.map(row => row.id);
      let finalRows = await getRows(context, sheetUrl, rowIds, 0);
      let results = await Promise.all(rows.map(row => {
        let rowId = row.id;
        let final = finalRows.find(final => final.id == rowId);
        let failure = failedItems.find(failure => failure.rowId == rowId);
        if (failure) {
          return new coda.UserVisibleError(failure.error.message);
        } else if (final) {
          return formatRowForSchema(context, final, sheet, settings);
        } else {
          throw new Error("Can't determine result.");
        }
      }));
      return {
        result: results,
      };
    }
  },
});

pack.addFormula({
  name: "AddRow",
  description: "Adds a row to a sheet.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "sheet",
      description: "The numerical ID of the sheet, as found in the properties dialog.",
      autocomplete: async function (context, search) {
        let results = await searchSheets(context, search);
        if (!results) return [];
        return results.map(sheet => `${sheet.name} (${sheet.id})`);
      },
    }),
  ],
  varargParameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "column",
      description: "The column to set.",
      autocomplete: async function (context, search, args) {
        let {sheet} = args;
        if (!sheet) return [];
        let sheetId = parseIdParameter(sheet);
        let sheetUrl = `https://api.smartsheet.com/2.0/sheets/${sheetId}`;
        let {columns} = await getSheet(context, sheetUrl);
        return columns.map(column => `${column.title} (${column.id})`);
      },
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "value",
      description: "The value to set for that column.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [sheet, ...rest] = args;
    let sheetId = parseIdParameter(sheet);
    let sheetUrl = `https://api.smartsheet.com/2.0/sheets/${sheetId}`;
    let {columns} = await getSheet(context, sheetUrl);
    let row: Row = {
      id: undefined,
      cells: [],
    };
    while (rest.length > 0) {
      let [column, value, ...more] = rest;
      let columnId = parseIdParameter(column);
      let columnInfo = columns.find(col => col.id == columnId);
      if (columnInfo.type == "CHECKBOX") {
        value = Boolean(value);
      } else if (columnInfo.type == "TEXT_NUMBER" && !Number.isNaN(Number(value))) {
        value = Number(value);
      }
      row.cells.push({columnId, value, strict: false});
      rest = more;
    }
    let url = coda.withQueryParams(`https://api.smartsheet.com/2.0/sheets/${sheetId}/rows`, {});
    try {
      let response = await context.fetcher.fetch({
        method: "POST",
        url: url,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row),
      });
      let data = response.body;
      return data.result.id;
    } catch (e) {
      if (coda.StatusCodeError.isStatusCodeError(e) && e.body.message) {
        throw new coda.UserVisibleError(e.body.message);
      }
      throw e;
    }
  },
});

async function formatRowForSchema(context: coda.ExecutionContext, row: Row, sheet: Sheet, settings: SheetFormatSettings): Promise<CodaRow> {
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

function formatRowForApi(row: CodaRow, sheet: Sheet, settings: SheetFormatSettings): Row {
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

function parseIdParameter(value: string): number {
  if (!value) return undefined;
  let num = parseInt(value);
  if (!isNaN(num)) return num;
  let extracted = value.trim().match(IdParameterRegex)?.[1];
  if (extracted) return parseInt(extracted);
  throw new coda.UserVisibleError(`Invalid parameter value: ${value}`);
}

