import * as coda from "@codahq/packs-sdk";
import FormData from 'form-data';

export const pack = coda.newPack();

const FileUrl = "https://www.googleapis.com/upload/drive/v3/files";
const DocUrlRegex = new RegExp("^https://docs.google.com/document/d/([^/]+)/");
const UrlRegex = new RegExp("^https?://");

const ContentParam = coda.makeParameter({
  type: coda.ParameterType.Html,
  name: "content",
  description: "The page or canvas content to export.",
});

const DocParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "doc",
  description: "The URL or ID of an existing Google Doc, created by this Pack.",
});

pack.addNetworkDomain("googleapis.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "profile",
    "https://www.googleapis.com/auth/drive.file",
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

pack.addFormula({
  name: "ExportToDoc",
  description: "TODO",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the resulting Google Doc file.",
    }),
    ContentParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [name, content] = args;
    return exportToDoc(context, content, name);
  },
});

pack.addFormula({
  name: "ReplaceContent",
  description: "TODO",
  parameters: [
    DocParam,
    ContentParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [doc, content] = args;
    let docId = parseDocUrl(doc);
    await exportToDoc(context, content, undefined, docId);
    return "Done";
  },
});

pack.addFormula({
  name: "AppendText",
  description: "TODO",
  parameters: [
    DocParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "text",
      description: "The text to append. Only plain text is supported, any styling will be lost.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [doc, text] = args;
    let docId = parseDocUrl(doc);
    let request = {
      insertText: {
        text: "\n" + text,
        endOfSegmentLocation: {},
      },
    };
    await modifyDoc(context, docId, [request]);
    return "Done";
  },
});

pack.addFormula({
  name: "AppendImage",
  description: "TODO",
  parameters: [
    DocParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "image",
      description: "The URL of the image. It must be publicly accessible.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "width",
      description: "The width of the inserted image, in points.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "height",
      description: "The height of the inserted image, in points.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [doc, image, width, height] = args;
    let docId = parseDocUrl(doc);
    let request = {
      insertInlineImage: {
        uri: image,
        objectSize: {
          width: width ? {
            magnitude: width,
            unit: "PT",
          } : undefined,
          height: height ? {
            magnitude: height,
            unit: "PT",
          } : undefined,
        },
        endOfSegmentLocation: {},
      },
    };
    await modifyDoc(context, docId, [request]);
    return "Done";
  },
});

async function exportToDoc(context: coda.ExecutionContext, html: string, name?: string, docId?: string) {
  let url = FileUrl;
  let method: coda.FetchMethodType = "POST";
  if (docId) {
    url = coda.joinUrl(url, docId);
    method = "PATCH";
  }
  url = coda.withQueryParams(url, {
    uploadType: "multipart",
    fields: "webViewLink"
  });
  let metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.document",
  };
  let form = new FormData();
  form.append("metadata", Buffer.from(JSON.stringify(metadata)), {
    contentType: "application/json; charset=UTF-8",
  });
  form.append("media", Buffer.from(html), {
    contentType: "text/html",
  });
  let headers = form.getHeaders();
  headers['content-type'] = headers['content-type'].replace("form-data", "related");
  let response = await context.fetcher.fetch({
    method: method,
    url: url,
    headers: {
      ...headers,
    },
    body: form.getBuffer(),
  });
  let file = response.body;
  return file.webViewLink;
}

function parseDocUrl(idOrUrl: string) {
  let match = idOrUrl.match(DocUrlRegex);
  if (match) return match[1];
  if (idOrUrl.match(UrlRegex)) {
    throw new coda.UserVisibleError("Invalid doc URL: " + idOrUrl);
  }
  return idOrUrl;
}

async function modifyDoc(context: coda.ExecutionContext, docId: string, requests: any[]) {
  let payload = {
    requests: requests,
  };
  let response = await context.fetcher.fetch({
    method: "POST",
    url: `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.body.replies;
}