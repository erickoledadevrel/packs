import * as coda from "@codahq/packs-sdk";
import * as rs from "jsrsasign";
import { onError } from "./helpers";
const ServiceAccountKey = require("./service-account.json");

const QueryPageSize = 100;
const QueryTimeoutMs = 30 * 1000;

export class BigQueryApi {
  context: coda.ExecutionContext;
  projectId: string;
  accessTokenPromise: Promise<string>;

  constructor(context: coda.ExecutionContext, projectId: string) {
    this.context = context;
    this.projectId = projectId;
    this.accessTokenPromise = this.getAccessToken(context, [
      "https://www.googleapis.com/auth/bigquery.readonly",
    ]);
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
    let url = coda.withQueryParams(`/queries/${jobId}`, {
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

  private async getAccessToken(context: coda.ExecutionContext, scopes: string[]) {
    // Extract data from the service account key JSON.
    let {private_key_id, client_email, private_key, token_uri} = ServiceAccountKey;

    // Construct the JWT header and payload.
    let algorithm = "RS256";
    let issued_at = Date.now() / 1000;
    let expires_at = issued_at + 3600;
    let header = JSON.stringify({
      alg: algorithm,
      typ: "JWT",
      kid: private_key_id,
    });
    let payload = JSON.stringify({
      iss: client_email,
      aud: token_uri,
      exp: expires_at,
      iat: issued_at,
      sub: client_email,
      scope: scopes.join(" "),
    });

    // Generate the signed JWT.
    let jwt = rs.jws.JWS.sign(algorithm, header, payload, rs.KEYUTIL.getKey(private_key));

    // Use the JWT to fetch an ID token from the token endpoint.
    let response = await context.fetcher.fetch({
      method: "POST",
      url: token_uri,
      form: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }
    });
    let data = response.body;
    return data.access_token;
  }

  private async makeRequest(request: coda.FetchRequest) {
    if (request.url?.startsWith("/")) {
      request.url = coda.joinUrl("https://www.googleapis.com/bigquery/v2/projects", this.projectId, request.url);
    }
    request.headers["Authorization"] = "Bearer " + await this.accessTokenPromise;
    try {
      return await this.context.fetcher.fetch(request);
    } catch (error) {
      onError(error);
    }
  }
}
