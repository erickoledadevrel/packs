import * as coda from "@codahq/packs-sdk";

export async function getToken(context: coda.ExecutionContext) {
  let invocationToken = context.invocationToken;
  let payload = {
    method: "PASSWORD",
    email: `{{username-${invocationToken}}}`,
    password: `{{password-${invocationToken}}}`,
  };
  let response = await context.fetcher.fetch({
    method: "POST",
    url: "https://api.visualping.io/v2/token",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cacheTtlSecs: 24 * 60 * 60, // 24 hours.
    forceCache: true, // Required to cache POST requests.
  });
  return response.body.id_token;
}

export async function getJob(context: coda.ExecutionContext, jobId: string) {
  let token = await getToken(context);
  let url = `https://job.api.visualping.io/v2/jobs/${jobId}`;
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    disableAuthentication: true,
  });
  return response.body;
}
