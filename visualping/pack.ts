import * as coda from "@codahq/packs-sdk";
import { JobSchema, ChangeSchema } from "./schemas";
import { getToken, getJob } from "./helpers";

export const pack = coda.newPack();

const PageSize = 100;

pack.addNetworkDomain("visualping.io");

pack.setUserAuthentication({
  type: coda.AuthenticationType.Custom,
  params: [
    {
      name: "username",
      description: "Username",
    },
    {
      name: "password",
      description: "Password",
    },
  ],
  getConnectionName: async function (context) {
    let token = await getToken(context);
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://account.api.visualping.io/describe-user",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      disableAuthentication: true,
    });
    let { firstName, lastName } = response.body;
    return `${firstName} ${lastName}`;
  },
});

pack.addSyncTable({
  name: "Jobs",
  description: "Lists the jobs you have configured in Visualping.",
  identityName: "Job",
  schema: JobSchema,
  formula: {
    name: "SyncJobs",
    description: "Syncs the jobs.",
    parameters: [],
    execute: async function (args, context) {
      let token = await getToken(context);
      let pageIndex = context.sync.continuation?.pageIndex as number || 0;
      let url = coda.withQueryParams("https://job.api.visualping.io/v2/jobs", {
        pageIndex,
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url,
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        disableAuthentication: true,
      });
      let {jobs, totalPages} = response.body;
      for (let job of jobs) {
        job.link = `https://visualping.io/jobs/${job.id}`;
        job.faviconPath = coda.joinUrl("https://visualping.io", job.faviconPath);
      }
      let continuation;
      if (pageIndex + 1 < totalPages) {
        continuation = { pageIndex: pageIndex + 1 }
      }
      return {
        result: jobs,
        continuation: continuation,
      }
    },
  },
});

pack.addDynamicSyncTable({
  name: "Changes",
  description: "Lists the changes recorded for a job.",
  identityName: "Change",
  listDynamicUrls: async function (context, search) {
    let token = await getToken(context);
    let url = coda.withQueryParams("https://job.api.visualping.io/v2/jobs", {
      pageSize: PageSize,
    });
    let response = await context.fetcher.fetch({
      method: "GET",
      url,
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      disableAuthentication: true,
    });
    let {jobs} = response.body;
    for (let job of jobs) {
      job.id = String(job.id);
    }
    return coda.autocompleteSearchObjects(search, jobs, "description", "id");
  },
  getName: async function (context) {
    let jobId = context.sync?.dynamicUrl!;
    let job = await getJob(context, jobId);
    return job.description;
  },
  getDisplayUrl: async function (context) {
    let jobId = context.sync?.dynamicUrl!;
    return `https://visualping.io/jobs/${jobId}`;
  },
  getSchema: async function (context) {
    return ChangeSchema;
  },
  formula: {
    name: "SyncChanges",
    description: "Syncs the changes.",
    parameters: [],
    execute: async function (args, context) {
      let jobId = context.sync?.dynamicUrl!;
      let job = await getJob(context, jobId);
      let changes = job.changes;
      for (let change of changes) {
        change.job = {id: job.id, description: job.description};
        change.PercentDifference /= 100;
        change.ccache_snapshot = coda.withQueryParams(change.ccache_snapshot, {
          mode: job.mode.toLowerCase(),
        });
      }
      return {
        result: changes,
      }
    },
  },
});


