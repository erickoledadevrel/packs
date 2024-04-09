import * as coda from "@codahq/packs-sdk";
import FormData from 'form-data';
const cheerio = require('cheerio');

export const pack = coda.newPack();

const FileUrl = "https://www.googleapis.com/upload/drive/v3/files";
const DocUrlRegex = new RegExp("^https://docs.google.com/document/d/([^/]+)/");
const UrlRegex = new RegExp("^https?://");
const MaxImageWidth = 600;

const ContentParam = coda.makeParameter({
  type: coda.ParameterType.Html,
  name: "content",
  description: "The page or canvas content to export. Open the formula editor with the equals key to select the page or canvas.",
});

const DocParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "doc",
  description: "The URL or ID of a Google Doc created by this Pack.",
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
  description: "Creates a new Google Doc using the content from a Coda page or canvas.",
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
    content = fixHtml(content);
    return exportToDoc(context, content, name);
  },
});

pack.addFormula({
  name: "ReplaceContent",
  description: "Replaces the content of a Google Doc that was previously created by this Pack.",
  parameters: [
    DocParam,
    ContentParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [doc, content] = args;
    content = fixHtml(content);
    let docId = parseDocUrl(doc);
    await exportToDoc(context, content, undefined, docId);
    return "Done";
  },
});

pack.addFormula({
  name: "AppendText",
  description: "Appends plain text to a Google Doc that was previously created by this Pack.",
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
    let startIndex = await getEndIndex(context, docId);
    if (!text.startsWith("\n")) {
      text = "\n" + text;
    }
    let range = {
      startIndex: startIndex,
      endIndex: startIndex + text.length,
    };
    let requests = [
      // Append text.
      {
        insertText: {
          text: text,
          endOfSegmentLocation: {},
        },
      },
      // Remove all text styles.
      {
        updateTextStyle: {
          textStyle: {},
          fields: "*",
          range: range,
        },
      },
      // Remove bullets.
      {
        deleteParagraphBullets: {
          range: range,
        },
      }
    ];
    await modifyDoc(context, docId, requests);
    return "Done";
  },
});

pack.addFormula({
  name: "AppendImage",
  description: "Appends an image to a Google Doc that was previously created by this Pack.",
  parameters: [
    DocParam,
    coda.makeParameter({
      type: coda.ParameterType.Image,
      name: "image",
      description: "The URL of the image. It must be publicly accessible.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "width",
      description: "The max width of the inserted image, in points (1/72 of an inch).",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "height",
      description: "The max height of the inserted image, in points (1/72 of an inch).",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [doc, image, width, height] = args;
    let docId = parseDocUrl(doc);
    let requests = [
      // Add a line break.
      {
        insertText: {
          text: "\n",
          endOfSegmentLocation: {},
        },
      },
      // Add the image.
      {
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
      }
    ];
    await modifyDoc(context, docId, requests);
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

async function getEndIndex(context: coda.ExecutionContext, docId: string) {
  let url = coda.withQueryParams(`https://docs.googleapis.com/v1/documents/${docId}`, {
    fields: "body/content/endIndex",
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    cacheTtlSecs: 0,
  });
  let doc = response.body;
  console.log(JSON.stringify(doc));
  return doc?.body?.content?.at(-1)?.endIndex;
}

function fixHtml(html:string): string {
  let $ = cheerio.load(html);

  // Enforce max image width.
  $("img").each((_i, img) => {
    let width = $(img).attr("width");
    if (width && Number(width) > MaxImageWidth) {
      $(img).attr("width", MaxImageWidth);
      $(img).attr("height", "auto");
    }
  });

  return $(":root").html();
}