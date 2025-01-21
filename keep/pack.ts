/*
 * Blocked, as this API currently only works with DwD.
 */

import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "profile",
    "https://www.googleapis.com/auth/keep",
  ],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
  getConnectionName: async function (context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://www.googleapis.com/oauth2/v1/userinfo",
    });
    let user = response.body;
    return user.name;
  },
});

const NoteSchema = coda.makeObjectSchema({
  properties: {
    id: { type: coda.ValueType.String, fromKey: "name" },
    title: { type: coda.ValueType.String },
    body: { type: coda.ValueType.String, codaType: coda.ValueHintType.Markdown },
    images: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String, codaType: coda.ValueHintType.Attachment },
      fromKey: "attachments",
    },
    trashed: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime, fromKey: "trashed" },
    createdAt: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime, fromKey: "createTime" },
    updatedAt: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime, fromKey: "updateTime" },
    trashedAt: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime, fromKey: "trashTime" },
  },
  displayProperty: "title",
  idProperty: "id",
  featuredProperties: ["body", "attachments"],
});

pack.addSyncTable({
  name: "Notes",
  description: "Lists the notes in your account.",
  identityName: "Note",
  schema: NoteSchema,
  formula: {
    name: "SyncNotes",
    description: "Syncs the data.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.Boolean,
        name: "includeTrashed",
        description: "If true, trashed notes are included.",
      }),
    ],
    execute: async function (args, context) {
      let [includeTrashed] = args;
      let pageToken = context.sync.continuation?.pageToken;
      let url = coda.withQueryParams("https://keep.googleapis.com/v1/notes", {
        pageToken,
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });
      let page = response.body;
      let rows = page.notes.map(note => {
        return {
          ...note,
        };
      });
      let continuation;
      if (page.nextPageToken) {
        continuation = {pageToken: page.nextPageToken};
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});