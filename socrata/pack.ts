import * as coda from "@codahq/packs-sdk";
import { AppToken } from "./credentials";
const urlParse = require('url-parse');

export const pack = coda.newPack();

// The max number of columns to include in the sync table by default.
const MaxFeaturedColumns = 50;

// How many rows to scan when determining the which columns to feature.
const TableScanMaxRows = 100;

// How many rows to fetch per-page.
const PageSize = 100;

// The maximum number of datasets to return in a search.
const MaxDatasets = 10000;

// Schema for an address (part of a location).
const AddressSchema = coda.makeObjectSchema({
  properties: {
    address: { type: coda.ValueType.String },
    city: { type: coda.ValueType.String },
    state: { type: coda.ValueType.String },
    zip: { type: coda.ValueType.String },
  },
  displayProperty: "address",
});

// Schema for a location (used for locations and points).
const LocationSchema = coda.makeObjectSchema({
  properties: {
    coordinates: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.Number },
    },
    latitude: { type: coda.ValueType.Number },
    longitude: { type: coda.ValueType.Number },
    address: { ...AddressSchema, fromKey: "human_address" },
  },
  displayProperty: "coordinates",
});

// A mapping from Socrata types to Coda schemas.
const TypeSchemaMap: Record<string, coda.Schema> = {
  text: { type: coda.ValueType.String },
  number: { type: coda.ValueType.Number },
  checkbox: { type: coda.ValueType.Boolean },
  calendar_date: {
    type: coda.ValueType.String,
    codaType: coda.ValueHintType.Date,
  },
  location: LocationSchema,
  point: LocationSchema,
  url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
};

// A base row schema, extended for each dataset.
const BaseRowSchema = coda.makeObjectSchema({
  properties: {
    rowId: { type: coda.ValueType.String, fromKey: ":id" },
  },
  idProperty: "rowId",
  displayProperty: "rowId",
});

// Include user authentication so that they can provide an endpoint URL.
pack.setUserAuthentication({
  type: coda.AuthenticationType.Custom,
  params: [],
  requiresEndpointUrl: true,
  // TODO: instructionsUrl
  getConnectionName: async function (context) {
    try {
      await searchDatasets(context, {
        limit: 0,
      });
    } catch (e) {
      throw new coda.UserVisibleError(`The URL ${context.endpoint} does not appear to be a Socrata server.`);
    }
    return getDomain(context);
  },
});

// A dynamic sync table for the rows of a dataset.
pack.addDynamicSyncTable({
  name: "PublicDataset",
  description: "Query and load a public dataset.",
  identityName: "DatasetRow",
  entityName: "Row",
  // If new columns are added later, don't automatically feature them.
  defaultAddDynamicColumns: false,

  // Allow the user to browse the datasets by category.
  listDynamicUrls: async function (context, category) {
    let domain = getDomain(context);

    if (!category) {
      // Return the list of categories.
      let categories = await getCategories(context);
      return categories.map(category => {
        return {
          display: category,
          value: category,
          hasChildren: true,
        };
      });
    }

    // Return all the datasets in that category.
    let datasets = await searchDatasets(context, {
      categories: category,
      only: "datasets",
      domains: domain,
      search_context: domain,
      order: "page_views_last_month",
      limit: MaxDatasets,
    });
    if (!datasets?.length) {
      return [];
    }
    return datasets.map(dataset => {
      return {
        display: dataset.name,
        value: dataset.link,
      };
    });
  },

  // Search for the dataset.
  searchDynamicUrls: async function (context, search) {
    let domain = getDomain(context);

    let datasets = await searchDatasets(context, {
      q: search,
      only: "datasets",
      domains: domain,
      search_context: domain,
      order: "relevance",
      limit: MaxDatasets,
    });
    if (!datasets?.length) {
      return [];
    }
    return datasets.map(dataset => {
      return {
        display: dataset.name,
        value: dataset.link,
      };
    });
  },

  getName: async function (context) {
    let dataset = await getDataset(context);
    return dataset.name;
  },

  getSchema: async function (context) {
    let dataset = await getDataset(context);

    // Copy the base schema.
    let schema: coda.GenericObjectSchema = {
      ...BaseRowSchema,
    };

    // Add a schema property for each column.
    for (let column of dataset.columns) {
      let fieldName = column.fieldName;
      let dataType = column.dataTypeName;

      if (fieldName.startsWith(":")) {
        // Skip internal fields.
        continue;
      }

      let fieldSchema = TypeSchemaMap[dataType];
      if (!fieldSchema) {
        throw new Error("Couldn't find schema for column type: " + dataType);
      }

      schema.properties[fieldName] = {
        ...fieldSchema,
        displayName: column.name,
        description: column.description,
        fixedId: String(column.id),
      };
    }

    // Determine which columns to feature.
    schema.featuredProperties = await getFeatured(dataset, context);

    // Add attribution information.
    schema.attribution = getAttribution(dataset);

    return schema;
  },

  getDisplayUrl: async function (context) {
    return context.sync.dynamicUrl;
  },

  formula: {
    name: "SyncDataset",
    description: "Syncs the dataset.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "search",
        description: "If specified, only rows containing this search term " +
          "will be included.",
        optional: true,
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "filter",
        description: "A SoQL $where clause to use to filter the results. " +
          "https://dev.socrata.com/docs/queries/where.html",
        optional: true,
      }),
    ],
    execute: async function ([search, filter], context) {
      let dataset = await getDataset(context);
      let offset = context.sync.continuation?.offset as number || 0;

      // Only fetch the selected columns.
      let fields = coda.getEffectivePropertyKeysFromSchema(context.sync.schema);

      // Fetch the row data.
      let baseUrl = `/resource/${dataset.id}.json`;
      let url = coda.withQueryParams(baseUrl, {
        $select: fields.join(","),
        $q: search,
        $where: filter,
        $limit: PageSize,
        $offset: offset,
      });
      let response = await fetch(context, {
        method: "GET",
        url: url,
      });
      let rows = response.body;

      // Transform the rows to match the schema.
      for (let row of rows) {
        for (let [key, value] of Object.entries(row)) {
          row[key] = formatValue(value);
        }
      }

      let continution = null;
      if (rows.length > 0) {
        // Keep fetching rows until we get an empty page.
        continution = { offset: offset + PageSize };
      }

      return {
        result: rows,
        continuation: continution,
      };
    },
  },
});

/**
 * Gets the domain from the endpoint URL.
 */
function getDomain(context: coda.ExecutionContext) {
  let url = urlParse(context.endpoint);
  return url.host;
}

/**
 * Reformat a row value to match the schema.
 */
function formatValue(value) {
  if (typeof value === "object") {
    let obj = value as Record<string, any>;
    if (obj.url) {
      // Pull up the URL.
      value = obj.url;
    } else if (obj.type === "Point") {
      // Format point to LocationSchema.
      value = {
        latitude: obj.coordinates[1],
        longitude: obj.coordinates[0],
        // A point's coordinates are returned as x,y instead of lat,long.
        coordinates: obj.coordinates.reverse(),
      };
    } else if (obj.latitude && obj.longitude) {
      // Format location to LocationSchema.
      value = {
        ...obj,
        coordinates: [obj.latitude, obj.longitude],
      };
    }
  }
  return value;
}

/**
 * Get the list of dataset categories.
 */
async function getCategories(context: coda.ExecutionContext):
  Promise<string[]> {
  let domain = getDomain(context);
  let baseUrl = `/api/catalog/v1/domain_categories`;
  let url = coda.withQueryParams(baseUrl, {
    domains: domain,
  });
  let response = await fetch(context, {
    method: "GET",
    url: url,
  });
  return response.body.results.map(result => result.domain_category);
}

/**
 * Search for datasets, using a flexible set of parameters.
 */
async function searchDatasets(context: coda.ExecutionContext,
  params: Record<string, any>): Promise<DatasetResult[]> {
  let url = coda.withQueryParams(`/api/catalog/v1`, params);
  let response = await fetch(context, {
    method: "GET",
    url: url,
  });
  return response.body.results.map(result => {
    return {
      ...result.resource,
      ...result,
    };
  });
}

/**
 * Get a dataset by ID.
 */
async function getDataset(context: coda.ExecutionContext): Promise<Dataset> {
  let datasetUrl = context.sync.dynamicUrl;
  let datasetId = getDatasetId(datasetUrl);
  let url = `/api/views/${datasetId}.json`;
  let response = await fetch(context, {
    method: "GET",
    url: url,
  });
  return response.body;
}

/**
 * Extract the ID of the dataset from it's URL.
 */
function getDatasetId(url: string): string {
  return url.split("/").pop();
}

/**
 * Determine which rows to feature (include in the table by default) for a given
 * dataset.
 */
async function getFeatured(dataset: Dataset, context: coda.ExecutionContext):
  Promise<string[]> {
  // Fetch some of the first rows from the dataset.
  let baseUrl = `/resource/${dataset.id}.json`;
  let url = coda.withQueryParams(baseUrl, {
    $limit: TableScanMaxRows,
  });
  let response = await fetch(context, {
    method: "GET",
    url: url,
  });
  let rows = response.body;

  // Count how many times each column has a value.
  let columnCount: Record<string, number> = {};
  for (let row of rows) {
    for (let [key, value] of Object.entries(row)) {
      if (!columnCount[key]) {
        columnCount[key] = 0;
      }
      if (value) {
        columnCount[key]++;
      }
    }
  }

  // Return the list of columns that have at least one value in the scanned
  // rows, up to a defined maximum.
  return dataset.columns.map(column => column.fieldName)
    .filter(column => columnCount[column] > 0)
    .filter(column => !column.startsWith(":"))
    .slice(0, MaxFeaturedColumns);
}

/**
 * Get the attribution node for a given dataset.
 */
function getAttribution(dataset: Dataset): coda.AttributionNode[] {
  if (!dataset.attribution) {
    return undefined;
  }
  let node;
  if (dataset.attributionLink) {
    node = coda.makeAttributionNode({
      type: coda.AttributionNodeType.Link,
      anchorText: dataset.attribution,
      anchorUrl: dataset.attributionLink,
    });
  } else {
    node = coda.makeAttributionNode({
      type: coda.AttributionNodeType.Text,
      text: dataset.attribution,
    });
  }
  return [node];
}

/**
 * Makes an HTTP request, ensuring the correct domain and app token are used.
 */
async function fetch(context: coda.ExecutionContext, request: coda.FetchRequest) {
  let domain = getDomain(context);
  let url = coda.joinUrl(`https://${domain}`, request.url);
  try {
    return await context.fetcher.fetch({
      ...request,
      url: url,
      headers: {
        ...request.headers,
        "X-App-Token": AppToken,
      },
    });
  } catch (error) {
    // If the request failed because the server returned a 300+ status code.
    if (coda.StatusCodeError.isStatusCodeError(error)) {
      // Cast the error as a StatusCodeError, for better intellisense.
      let statusError = error as coda.StatusCodeError;
      // If the API returned an error message in the body, show it to the user.
      let message = statusError.body?.message;
      if (message) {
        let parts = message.split(";");
        message = parts[1] ?? message;
        throw new coda.UserVisibleError(message);
      }
    }
    // The request failed for some other reason. Re-throw the error so that it
    // bubbles up.
    throw error;
  }
}


// A dataset search result.
interface DatasetResult {
  name: string;
  link: string;
}

// The dataset metadata.
interface Dataset {
  id: string;
  name: string;
  description: string;
  columns: DatasetColumn[];
  attribution: string;
  attributionLink: string;
}

// A dataset column definition.
interface DatasetColumn {
  id: number;
  name: string;
  description: string;
  fieldName: string;
  dataTypeName: string;
}
