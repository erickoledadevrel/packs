import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

const ResultLoopDelayMs = 1000;

const NodeSchema = sdk.makeObjectSchema({
  description: "The node (server) that made the request.",
  properties: {
    nodeId: {
      type: sdk.ValueType.String,
      description: "The ID of the node.",
    },
    countryCode: {
      type: sdk.ValueType.String,
      description: "The two-letter code for the country the node is located in.",
    },
    country: {
      type: sdk.ValueType.String,
      description: "The country the node is located in.",
    },
    city: {
      type: sdk.ValueType.String,
      description: "The city the node is located in.",
    },
    domain: {
      type: sdk.ValueType.String,
      description: "The domain name of the node.",
    },
    ipAddress: {
      type: sdk.ValueType.String,
      description: "The IP address of the node.",
    },
    asn: {
      type: sdk.ValueType.String,
      description: "The ASN (Autonomous System Number) the node is located in.",
    },
  },
  displayProperty: "nodeId",
  idProperty: "nodeId",
  featuredProperties: ["city", "country"],
});

const HttpResultSchema = sdk.makeObjectSchema({
  description: "The result of the HTTP request from a specific node.",
  properties: {
    node: NodeSchema,
    success: {
      type: sdk.ValueType.Boolean,
      description: "Whether the request was successful.",
    },
    responseTimeMs: {
      type: sdk.ValueType.Number,
      description: "The response time, in milliseconds.",
    },
    status: {
      type: sdk.ValueType.String,
      description: "The status text of the HTTP response.",
    },
    statusCode: {
      type: sdk.ValueType.String,
      description: "The status code of the HTTP response.",
    },
    ipAddress: {
      type: sdk.ValueType.String,
      description: "The IP address that the request was sent to.",
    },
    error: {
      type: sdk.ValueType.String,
      description: "The error message returned, if any.",
    },
    summary: {
      type: sdk.ValueType.String,
      description: "A summary of the request, for display purposes.",
    },
  },
  displayProperty: "summary",
});

const CheckHttpResultSchema = sdk.makeObjectSchema({
  description: "The results of the check.",
  properties: {
    requestId: {
      type: sdk.ValueType.String,
      description: "The ID of the check that was run.",
    },
    success: {
      type: sdk.ValueType.Boolean,
      description: "If the check was successful (requests from all nodes succeeded).",
    },
    rate: {
      type: sdk.ValueType.Number,
      codaType: sdk.ValueHintType.Percent,
      description: "What percentage of the nodes made the request successfully.",
    },
    results: {
      type: sdk.ValueType.Array,
      items: HttpResultSchema,
      description: "The results from individual nodes.",
    }
  },
  displayProperty: "rate",
});

pack.addNetworkDomain("check-host.net");

pack.addFormula({
  name: "CheckUrl",
  description: "Checks to see if a given website is accessible from servers across the world and reports the results.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "url",
      description: "The url to check. Ex: https://sdk.io",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.StringArray,
      name: "nodes",
      description: "Which nodes (servers) to use to make the requests. If no nodes are specified then all nodes will be used.",
      optional: true,
      autocomplete: async function (context, search) {
        let nodes = getNodes(context);
        let items = Object.entries(nodes).map(([nodeDomain, node]: [any, any]) => {
          let nodeId = toNodeId(nodeDomain);
          return {
            display: `${nodeId} (${node.location[2]}, ${node.location[1]})`,
            value: nodeId,
          };
        });
        return sdk.autocompleteSearchObjects(search, items, "display", "value");
      },
    }),
  ],
  resultType: sdk.ValueType.Object,
  schema: CheckHttpResultSchema,
  execute: async function (args, context) {
    let [url, nodeIds] = args;
    let check = await runCheck(context, url, "http", nodeIds);
    let nodes = Object.entries(check.nodes).reduce((nodes, [nodeDomain, node]) => {
      nodes[nodeDomain] = formatNode(node, nodeDomain);
      return nodes;
    }, {});
    let results;
    do {
      wait(ResultLoopDelayMs);
      let rawResults = await getResults(context, check.request_id);
      results = [];
      for (let [nodeDomain, data] of Object.entries(rawResults)) {
        let node = nodes[nodeDomain];
        results.push(formatHttpResult(node, data));
      }
    } while (results.some(result => result.pending));

    let success = results.reduce((success, result) => success && result.success, true);
    let rate = results.map(result => result.success ? 1 : 0).reduce((sum, num) => sum + num, 0) / results.length;
    return {
      requestId: check.request_id,
      success,
      rate,
      results,
    };
  },
});

pack.addSyncTable({
  name: "Nodes",
  description: "Lists the servers (nodes) that are available to make the requests.",
  identityName: "Node",
  schema: NodeSchema,
  formula: {
    name: "SyncNodes",
    description: "Syncs the nodes.",
    parameters: [],
    execute: async function (args, context) {
      let nodes = await getNodes(context);
      let rows = Object.entries(nodes).map(([domain, node]: [string, any]) => {
        let nodeId = toNodeId(domain);
        return {
          nodeId,
          domain,
          countryCode: node.location[0],
          country: node.location[1],
          city: node.location[2],
          ipAddress: node.ip,
          asn: node.asn,
        };
      });
      return {
        result: rows,
      };
    },
  },
})

async function runCheck(context: sdk.ExecutionContext, host: string, checkType: string, nodeIds?: string[]) {
  let url = sdk.withQueryParams(`https://check-host.net/check-${checkType}`, {
    host,
  });
  if (nodeIds) {
    for (let nodeId of nodeIds) {
      url += `&node=${encodeURIComponent(toNodeDomain(nodeId))}`;
    }
  }
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    headers: {
      "Accept": "application/json",
    },
    cacheTtlSecs: 0,
  });
  return response.body;
}

async function getResults(context: sdk.ExecutionContext, requestId: string) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://check-host.net/check-result/${requestId}`,
    headers: {
      "Accept": "application/json",
    },
    cacheTtlSecs: 0,
  });
  return response.body;
}

async function getNodes(context: sdk.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://check-host.net/nodes/hosts",
    headers: {
      "Accept": "application/json",
    },
  });
  return response.body.nodes;
}

function formatNode(node, domain) {
  let [countryCode, country, city, ipAddress, asn] = node;
  let nodeId = toNodeId(domain);
  return { nodeId, domain, countryCode, country, city, ipAddress, asn };
}

function formatHttpResult(node, data) {
  if (!data) {
    return {
      node,
      pending: true,
    };
  }
  let [result, error] = data as any;
  if (error) {
    return {
      node,
      success: false,
      error: error.message,
      summary: `${node.nodeId}: ${error.message}`,
    };
  }
  let [success, responseTimeMs, status, statusCode, ipAddress] = result;
  return {
    node,
    success: Boolean(success),
    responseTimeMs,
    status,
    statusCode,
    ipAddress,
    summary: `${node.nodeId}: ${status}`,
  };
}

function toNodeId(nodeDomain) {
  return nodeDomain.split(".")[0];
}

function toNodeDomain(nodeId) {
  return `${nodeId}.node.check-host.net`;
}

function wait(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
