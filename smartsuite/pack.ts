import * as coda from "@codahq/packs-sdk";
import { getMembers, getSolutions, getTable, getTables } from "./api";
import { getConverter } from "./convert";
import { CodaMember, CodaRow, SmartSuiteRecord, Table } from "./types";
import { MemberSchema } from "./schemas";

export const pack = coda.newPack();

export const PageSize = 100;

const BaseRowSchema = coda.makeObjectSchema({
  properties: {
    recordId: {
      type: coda.ValueType.String,
      description: "The unique ID of the record.",
      fromKey: "id",
    },
  },
  idProperty: "recordId",
  displayProperty: undefined,
  featuredProperties: [],
});

pack.addNetworkDomain("smartsuite.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.MultiHeaderToken,
  headers: [
    {
      description: "API Key",
      name: "Authorization",
      tokenPrefix: "Token",
    },
    {
      description: "Workspace ID",
      name: "ACCOUNT-ID",
    },
  ]
});

pack.addDynamicSyncTable({
  name: "Table",
  description: "Sync the contents of a table.",
  identityName: "Record",
  listDynamicUrls: async function (context, solutionId) {
    if (solutionId) {
      let tables = await getTables(context, solutionId);
      return tables.map(table => {
        return {
          display: table.name,
          value: table.id,
        };
      });
    } else {
      let solutions = await getSolutions(context);
      return solutions.map(solution => {
        return {
          display: solution.name,
          value: solution.id,
          hasChildren: true,
        };
      });
    }
  },
  // TODO: Search dynamic URLs.
  getName: async function (context) {
    let tableId = context.sync.dynamicUrl;
    let table = await getTable(context, tableId);
    return table.name;
  },
  getSchema: async function (context, _, args) {
    let tableId = context.sync.dynamicUrl;
    let table = await getTable(context, tableId);
    let schema = coda.makeObjectSchema({
      ...BaseRowSchema,
      properties: {
        ...BaseRowSchema.properties,
      }
    });
    for (let column of table.structure) {
      let converter = getConverter(column);
      let propertySchemas = converter.getSchema();
      for (let propertySchema of propertySchemas) {
        let propertyName = propertySchema.displayName;
        schema.properties[propertyName] = propertySchema;
        if (column.params.primary) {
          schema.displayProperty = propertyName;
        }
        if (!column.params.hidden) {
          schema.featuredProperties.push(propertyName);
        }
      }
    }
    return schema;
  },
  getDisplayUrl: async function (context) {
    // TODO
    return "https://example.com";
  },
  propertyOptions: async function (context) {
    let tableId = context.sync.dynamicUrl;
    let table = await getTable(context, tableId);
    let propertyKey = context.propertyName;
    let column = table.structure.find(col => col.slug == propertyKey);
    return column.params.choices.map(choice => {
      return {
        label: choice.label,
        value: choice.value,
      };
    });
  },
  formula: {
    name: "SyncTable",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "filter",
        description: "The filter to apply.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [filter] = args;
      let offset = context.sync.continuation?.offset as number ?? 0;
      let tableId = context.sync.dynamicUrl;
      let table = await getTable(context, tableId);

      let url = coda.withQueryParams(`https://app.smartsuite.com/api/v1/applications/${tableId}/records/list/`, {
        offset: offset,
        limit: PageSize,
      });
      let response = await context.fetcher.fetch({
        method: "POST",
        url: url,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      let {total, items} = response.body;
      let result = items.map(item => {
        return formatRecordForSchema(item, table);
      });
      let continuation;
      if (total > offset + PageSize) {
        continuation = { offset: offset + PageSize };
      }
      
      return {
        result: result,
        continuation,
      };
    },
    executeUpdate: async function (args, updates, context) {
      let tableId = context.sync.dynamicUrl;
      let table = await getTable(context, tableId);
      let patches = updates.map(update => {
        return Object.fromEntries(
          Object.entries(update.newValue).filter(([key, value]) => {
            return update.updatedFields.includes(key) || key == "id";
          })
        ) as CodaRow;
      });
      let payload = {
        items: patches.map(patch => {
          return formatRowForApi(patch, table);
        }),
      };
      let response = await context.fetcher.fetch({
        method: "PATCH",
        url: `https://app.smartsuite.com/api/v1/applications/${tableId}/records/bulk/`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      let records = response.body;
      return {
        result: records.map(record => formatRecordForSchema(record, table)),
      };
    },
  },
});

pack.addSyncTable({
  name: "Members",
  description: "TODO",
  identityName: "Member",
  schema: MemberSchema,
  formula: {
    name: "SyncMembers",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let offset = context.sync.continuation?.offset as number ?? 0;
      let {items, total} = await getMembers(context, PageSize, offset);
      let result: CodaMember[] = items.map(member => {
        let name = member.full_name.sys_root;
        let email = member.email?.[0];
        return {
          ...member,
          name: name,
          email: email,
          codaAccount: email ? {name, email} : undefined,
        };
      });
      let continuation;
      if (total > offset + PageSize) {
        continuation = { offset: offset + PageSize };
      }
      return {
        result: result,
        continuation: continuation,
      };
    },
  },
});

function formatRecordForSchema(record: SmartSuiteRecord, table: Table): CodaRow {
  let result: CodaRow = {
    id: record.id,
  };

  for (let column of table.structure) {
    let converter = getConverter(column);
    let key = column.slug;
    let value = converter.formatValueForSchema(record[key]);
    let keys = converter.getPropertyKeys();
    let values = keys.length > 1 ? value : [value];
    for (let [i, k] of keys.entries()) {
      let v = values[i];
      result[k] = v;
    }
  }
  return result;
}

function formatRowForApi(row: CodaRow, table: Table): SmartSuiteRecord {
  let result: SmartSuiteRecord = {
    id: row.id,
  };
  Object.assign
  for (let [key, value] of Object.entries(row)) {
    if (key == "id" || !value) continue;
    let column = table.structure.find(c => c.slug == key);
    let converter = getConverter(column);
    result[key] = converter.formatValueForApi(value);
  }
  return result;
}