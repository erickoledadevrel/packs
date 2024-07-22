import * as coda from "@codahq/packs-sdk";
import { getAccount, getAccounts, getAccountId, getCurrentMember, getMembers, getSolutions, getTable, getTables, fetch, getMembersTable } from "./api";
import { getConverter } from "./convert";
import type * as Coda from "./types/coda";
import type * as SmartSuite from "./types/smartsuite";
import { getBaseRowSchema, MemberSchema } from "./schemas";
import { ConversionSettings } from "./types";

export const pack = coda.newPack();

export const PageSize = 100;

pack.addNetworkDomain("smartsuite.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.CustomHeaderToken,
  headerName: "Authorization",
  tokenPrefix: "Token",
  instructionsUrl: "https://help.smartsuite.com/en/articles/4855681-generating-an-api-key",
  postSetup: [
    {
      type: coda.PostSetupType.SetEndpoint,
      name: "SelectAccount",
      description: "Select a workspace.",
      getOptions: async function (context) {
        let accounts = await getAccounts(context);
        return accounts.map(account => ({
          display: account.name,
          value: `https://app.smartsuite.com#${account.slug}`,
        }));
      }
    }
  ],
  getConnectionName: async function (context) {
    let accountId = getAccountId(context);
    if (!accountId) {
      return "Incomplete";
    }
    let [account, member] = await Promise.all([
      getAccount(context, accountId),
      getCurrentMember(context),
    ]);
    return `${account.name} (${member.full_name.sys_root})`;
  },
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
  searchDynamicUrls: async function (context, search) {
    let tables = await getTables(context);
    return coda.autocompleteSearchObjects(search, tables, "name", "id");
  },
  getName: async function (context) {
    let tableId = context.sync.dynamicUrl;
    let table = await getTable(context, tableId);
    return table.name;
  },
  getSchema: async function (context, _, args) {
    let settings = await getSettings(context);
    let table = settings.table;
    let schema = getBaseRowSchema(table);
    for (let [i, column] of table.structure.entries()) {
      let converter = getConverter(settings, column);
      let propertySchema = await converter.getSchema();
      let propertyName = converter.getPropertyName();
      schema.properties[propertyName] = propertySchema;
      if (column.slug == table.primary_field) {
        schema.displayProperty = propertyName;
      }
    }
    schema.featuredProperties = table.structure_layout?.single_column?.rows.map(columnId => {
      return Object.entries(schema.properties).find(([name, prop]) => prop.fromKey == columnId)[0];
    });
    return schema;
  },
  getDisplayUrl: async function (context) {
    let accountId = getAccountId(context);
    let tableId = context.sync.dynamicUrl;
    let table = await getTable(context, tableId);
    return `https://app.smartsuite.com/${accountId}/solution/${table.solution}/${table.id}`;
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
      // TODO: Filtering
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
      let settings = await getSettings(context);
      let table = settings.table;

      let url = coda.withQueryParams(`https://app.smartsuite.com/api/v1/applications/${table.id}/records/list/`, {
        offset: offset,
        limit: PageSize,
      });
      let response = await fetch(context, {
        method: "POST",
        url: url,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      let {total, items} = response.body;
      let result = await Promise.all(items.map(async item => {
        return formatRecordForSchema(settings, item);
      }));
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
      let settings = await getSettings(context);
      let table = settings.table;
      let patches = updates.map(update => {
        console.log("New value: ", JSON.stringify(update.newValue));
        return Object.fromEntries(
          Object.entries(update.newValue).filter(([key, value]) => {
            return update.updatedFields.includes(key) || key == "id";
          })
        ) as Coda.Row;
      });
      console.log("Patches: ", JSON.stringify(patches));
      let items = await Promise.all(patches.map(patch => {
        return formatRowForApi(settings, patch);
      }));
      console.log("Items: ", JSON.stringify(items));
      let payload = {
        items: items,
      };
      let response = await fetch(context, {
        method: "PATCH",
        url: `https://app.smartsuite.com/api/v1/applications/${table.id}/records/bulk/`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      let records = response.body;
      let rows = await Promise.all(records.map(record => {
        return formatRecordForSchema(settings, record);
      }));
      if (rows.length != updates.length) {
        // One or more rows were no-ops. Return the original values as a fallback.
        rows = updates.map(update => update.newValue);
      }
      return {
        result: rows,
      };
    },
  },
});

pack.addSyncTable({
  name: "Members",
  description: "Lists the members in the workspace.",
  identityName: "Member",
  schema: MemberSchema,
  formula: {
    name: "SyncMembers",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let offset = context.sync.continuation?.offset as number ?? 0;
      let {items, total} = await getMembers(context, PageSize, offset);
      let result: Coda.MemberReference[] = items.map(member => {
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

async function formatRecordForSchema(settings: ConversionSettings, record: SmartSuite.Row): Promise<Coda.Row> {
  let result: Coda.Row = {
    id: record.id,
  };
  for (let column of settings.table.structure) {
    let converter = getConverter(settings, column);
    let key = converter.getPropertyKey();
    if (record[key] != null && record[key] != "") {
      let value = await converter.formatValueForSchema(record[key]);
      result[key] = value;
    }
  }
  return result;
}

async function formatRowForApi(settings: ConversionSettings, row: Coda.Row): Promise<SmartSuite.Row> {
  let result: SmartSuite.Row = {
    id: row.id,
  };
  for (let [key, value] of Object.entries(row)) {
    if (key == "id" || !value) continue;
    let column = settings.table.structure.find(c => c.slug == key);
    let converter = getConverter(settings, column);
    result[key] = await converter.formatValueForApi(value);
  }
  return result;
}

async function getSettings(context: coda.ExecutionContext): Promise<ConversionSettings> {
  let tableId = context.sync.dynamicUrl;
  let [table, membersTable] = await Promise.all([
    getTable(context, tableId),
    getMembersTable(context),
  ]);
  return {
    context: context,
    table: table,
    membersTable: membersTable,
    relatedTables: {},
  };  
}