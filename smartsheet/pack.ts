import * as coda from "@codahq/packs-sdk";
import { getConverter } from "./convert";
import { Attachment, CodaRow, Row, Sheet, SheetFormatSettings } from "./types";
import { getSheet, syncSheet, updateRows, getRows, getAttachment } from "./api";

export const pack = coda.newPack();

const HomeUrl = "https://api.smartsheet.com/2.0/folders/personal";
const WorkspacesUrl = "https://api.smartsheet.com/2.0/workspaces";
export const PageSize = 100;
const IdParameterRegex = /^.*\((\d+)\)$/;
const AttachmentsPropertyKey = "attachments";

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
  getName: async function (context) {
    let sheetUrl = context.sync.dynamicUrl;
    let response = await context.fetcher.fetch({
      method: "GET",
      url: sheetUrl,
    });
    let sheet = response.body;
    return sheet.name;
  },
  getSchema: async function (context, _, args) {
    let sheetUrl = context.sync.dynamicUrl;
    let {columns, useColumnTypes, includeAttachments} = args;
    let selectedColumnIds = columns?.map(column => parseIdParameter(column));
    let settings: SheetFormatSettings = {useColumnTypes};

    let sheet = await getSheet(context, sheetUrl);
    let schema = coda.makeObjectSchema({
      ...BaseRowSchema,
      properties: {
        ...BaseRowSchema.properties,
      }
    });
    if (includeAttachments) {
      schema.properties[AttachmentsPropertyKey] = {
        type: coda.ValueType.Array,
        items: {
          type: coda.ValueType.String,
          codaType: coda.ValueHintType.Attachment,
        },
      };
    }
    for (let column of sheet.columns) {
      if (selectedColumnIds && !selectedColumnIds.includes(column.id)) continue;
      let propertyName = column.title;
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
    let response = await context.fetcher.fetch({
      method: "GET",
      url: sheetUrl,
    });
    let sheet = response.body;
    return sheet.permalink;
  },
  formula: {
    name: "SyncSheet",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "filter",
        description: "The filter (ID) to apply.",
        optional: true,
        autocomplete: async function (context) {
          let sheet = await getSheet(context, context.sync.dynamicUrl);
          return sheet.filters?.map(filter => `${filter.name} (${filter.id})`);
        },
      }),
      coda.makeParameter({
        type: coda.ParameterType.StringArray,
        name: "columns",
        description: "The columns (IDs) to include.",
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
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeAttachments",
        description: "Whether or not to download files attached to the rows.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [filter, columns, useColumnTypes = false, includeAttachments = false] = args;
      let filterId = parseIdParameter(filter);
      let columnIds = columns?.map(column => parseIdParameter(column));
      let page = context.sync.continuation?.page as number ?? 1;
      let settings: SheetFormatSettings = {filterId, columnIds, useColumnTypes, includeAttachments, page};
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
      let [_filter, _columns, useColumnTypes = false, includeAttachments = false] = args;
      let settings: SheetFormatSettings = {useColumnTypes, includeAttachments};
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

async function formatRowForSchema(context: coda.ExecutionContext, row: Row, sheet: Sheet, settings: SheetFormatSettings): Promise<CodaRow> {
  let sheetUrl = context.sync.dynamicUrl;

  let result: CodaRow = {
    id: String(row.id),
    rowNumber: row.rowNumber,
  };

  if (settings.includeAttachments && row.attachments) {
    let attachments = row.attachments.filter(att => att.attachmentType == "FILE");
    attachments = await Promise.all(attachments.map(att => getAttachment(context, sheetUrl, att.id)));
    result.attachments = attachments.map(att => att.url);
  }

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


