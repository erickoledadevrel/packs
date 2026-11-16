/*
 * Blocked, as this API currently only works with DwD.
 */

import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: sdk.AuthenticationType.OAuth2,
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

const NoteSchema = sdk.makeObjectSchema({
  properties: {
    id: { type: sdk.ValueType.String, fromKey: "name" },
    title: { type: sdk.ValueType.String },
    body: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Markdown },
    images: {
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Attachment },
      fromKey: "attachments",
    },
    trashed: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime, fromKey: "trashed" },
    createdAt: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime, fromKey: "createTime" },
    updatedAt: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime, fromKey: "updateTime" },
    trashedAt: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.DateTime, fromKey: "trashTime" },
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
      sdk.makeParameter({
        type: sdk.ParameterType.Boolean,
        name: "includeTrashed",
        description: "If true, trashed notes are included.",
      }),
    ],
    execute: async function (args, context) {
      let [includeTrashed] = args;
      let pageToken = context.sync.continuation?.pageToken;
      let url = sdk.withQueryParams("https://keep.googleapis.com/v1/notes", {
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