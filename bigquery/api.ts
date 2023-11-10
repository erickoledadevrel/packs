import * as coda from "@codahq/packs-sdk";
import { getProjectId, onError } from "./helpers";

const QueryPageSize = 100;
const QueryTimeoutMs = 30 * 1000;

export class BigQueryApi {
  context: coda.ExecutionContext;

  constructor(context: coda.ExecutionContext) {
    this.context = context;
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
    let projectId = getProjectId(this.context);
    try {
      let response = await this.context.fetcher.fetch({
        method: "POST",
        url: `https://www.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return response.body;
    } catch (error) {
      onError(error);
    }
  }

  async getQueryResults(jobId: string, pageToken?: string) {
    let projectId = getProjectId(this.context);
    let url = coda.withQueryParams(`https://www.googleapis.com/bigquery/v2/projects/${projectId}/queries/${jobId}`, {
      maxResults: QueryPageSize,
      timeoutMs: QueryTimeoutMs,
      pageToken,
    });
    try {
      let response = await this.context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      return response.body;
    } catch (error) {
      onError(error);
    }
  }
}
