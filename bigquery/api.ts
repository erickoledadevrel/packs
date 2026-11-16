import * as sdk from "@superhuman/plugins-sdk";
import { onError } from "./helpers";

const QueryPageSize = 100;
const QueryTimeoutMs = 30 * 1000;

export class BigQueryApi {
  context: sdk.ExecutionContext;
  projectId: string;
  accessTokenPromise: Promise<string>;

  constructor(context: sdk.ExecutionContext, projectId: string) {
    this.context = context;
    this.projectId = projectId;
  }

  async runQuery(query: string, dryRun = false, parameters?) {
    let payload = {
      query,
      useLegacySql: false,
      maxResults: QueryPageSize,
      timeoutMs: QueryTimeoutMs,
      dryRun,
      connectionProperties: [
        { key: "time_zone", value: this.context.timezone },
      ],
      queryParameters: parameters,
    };
    let response = await this.makeRequest({
      method: "POST",
      url: `/queries`,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.body;
  }

  async getQueryResults(jobId: string, pageToken?: string) {
    let url = sdk.withQueryParams(`/queries/${jobId}`, {
      maxResults: QueryPageSize,
      timeoutMs: QueryTimeoutMs,
      pageToken,
    });
    let response = await this.makeRequest({
      method: "GET",
      url: url,
    });
    return response.body;
  }

  private async makeRequest(request: sdk.FetchRequest) {
    if (request.url?.startsWith("/")) {
      request.url = sdk.joinUrl("https://www.googleapis.com/bigquery/v2/projects", this.projectId, request.url);
    }
    try {
      return await this.context.fetcher.fetch(request);
    } catch (error) {
      onError(error);
    }
  }
}
