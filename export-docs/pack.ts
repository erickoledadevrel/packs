import * as coda from "@codahq/packs-sdk";
import FormData from 'form-data';
import * as mime from "mime-types";
const cheerio = require('cheerio');
const sanitize = require("sanitize-filename");

export const pack = coda.newPack();

const DocUrlRegex = new RegExp("^https://docs.google.com/document/d/([^/]+)/");
const UrlRegex = new RegExp("^https?://");
const MaxImageWidth = 600;
const ShareTypes = ["user", "group", "domain", "anyone"];
const ShareRoles = ["writer", "commenter", "reader"];
const OneDaySecs = 24 * 60 * 60;
const DocsMimeType = "application/vnd.google-apps.document";
const AutoNamePlaceholder = "[auto]";

const NameParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "name",
  description: `The name of the resulting Google Doc file. Use the special value "${AutoNamePlaceholder}" generate the name automatically from the page title or first heading.`,
});

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

const PermissionsParam = coda.makeParameter({
  type: coda.ParameterType.StringArray,
  name: "permissions",
  description: "Who should the exported doc be shared with. Pass in a List() of permissions, each created with the CreatePermission() formula.",
  optional: true,
});

const FolderParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "folder",
  description: "The ID of the folder where the exported doc should be created. It must first be selected at https://packs.erickoleda.com/export.",
  optional: true,
});

const PageSizeParam = coda.makeParameter({
  type: coda.ParameterType.NumberArray,
  name: "pageSize",
  description: "The width and height of the pages in the doc, comma-separated, in points (1/72 of an inch). For example, 11 x 8.5 inches is be '792, 612'.",
  optional: true,
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
    NameParam,
    ContentParam,
    PermissionsParam,
    FolderParam,
    PageSizeParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  onError: onError,
  execute: async function (args, context) {
    let [name, content, permissions = [], folderId, pageSize] = args;
    if (!name) {
      throw new coda.UserVisibleError("The name cannot be empty.");
    }
    if (pageSize && pageSize.length != 2) {
      throw new coda.UserVisibleError("Page size must include both a width and height.");
    }
    let {title, html} = processHtml(content);
    if (name == AutoNamePlaceholder) {
      console.log(title);
      if (!title) {
        throw new coda.UserVisibleError("The name could not be determined automatically.");
      }
      name = title;
    }
    let file = await exportToDoc(context, Buffer.from(html), "text/html", {name, folderId});
    let jobs = [];
    for (let permission of permissions) {
      jobs.push(addPermission(context, file.id, permission));
    }
    jobs.push(adjustDoc(context, file.id, pageSize));
    await Promise.all(jobs);
    return file.webViewLink;
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
  onError: onError,
  execute: async function (args, context) {
    let [doc, content] = args;
    let {html} = processHtml(content);
    let docId = parseDocUrl(doc);
    await exportToDoc(context, Buffer.from(html), "text/html", {docId});
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
  onError: onError,
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
  onError: onError,
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

pack.addFormula({
  name: "ConvertToDoc",
  description: "Converts a file (PDF, Word Doc, image, etc) to a Google Doc.",
  parameters: [
    NameParam,
    coda.makeParameter({
      type: coda.ParameterType.File,
      name: "file",
      description: "The file to convert.",
    }),
    PermissionsParam,
    FolderParam,
    PageSizeParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  onError: onError,
  execute: async function (args, context) {
    let [name, fileUrl, permissions = [], folderId, pageSize] = args;
    if (pageSize && pageSize.length != 2) {
      throw new coda.UserVisibleError("Page size must include both a width and height.");
    }
    let response = await context.fetcher.fetch({
      method: "GET",
      url: fileUrl,
      isBinaryResponse: true,
      disableAuthentication: true,
    });
    let buffer = response.body;
    let mimeType = response.headers['content-type'] as string | undefined;
    let supportedMimeTypes = await getSupportedImportFormats(context);
    if (!mimeType) {
      throw new coda.UserVisibleError("Can't determine the file type of the source file.");
    } else if (!supportedMimeTypes.includes(mimeType)) {
      throw new coda.UserVisibleError(`Unsupported file type: ${mimeType}`);
    }
    let file = await exportToDoc(context, buffer, response.headers['content-type'] as string, {name, folderId});
    let jobs = [];
    for (let permission of permissions) {
      jobs.push(addPermission(context, file.id, permission));
    }
    jobs.push(adjustDoc(context, file.id, pageSize));
    await Promise.all(jobs);
    return file.webViewLink;
  },
});

pack.addFormula({
  name: "CreatePermission",
  description: "Creates a permission value to be used with the permissions parameter of the ExportDoc() formula.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "type",
      description: "The type of entity to share with. One of: " + ShareTypes.join(", "),
      autocomplete: ShareTypes,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "who",
      description: "Who to share with. For users and groups this should be their email address, for domains it should be the domain name, and for anyone leave it blank.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "role",
      description: "What role they should have in the document. One of: " + ShareRoles.join(", "),
      autocomplete: ShareRoles,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "sendNotificationEmail",
      description: "Whether or not Google Drive should send a notification email about the shared doc. Default: false",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  connectionRequirement: coda.ConnectionRequirement.None,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [type, who, role, sendNotificationEmail = false] = args;
    let permission: Record<string, any> = {type, role, sendNotificationEmail};
    if (["user", "group"].includes(type)) {
      permission.emailAddress = who;
    } else if (type == "domain") {
      permission.domain = who;
    }
    return JSON.stringify(permission);
  },
});

pack.addFormula({
  name: "GetDownloadUrl",
  description: `Gets a temporary download URL for a Google Doc created using this Pack. Use with the "Open hyperlink" action to download immediately, or the "Modify rows" action to save it to a File column.`,
  parameters: [
    DocParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "format",
      description: "Which file format the Google Doc should be converted to.",
      autocomplete: async function (context) {
        let mimeTypes = await getSupportedExportFormats(context);
        return mimeTypes.map(mimeType => mime.extension(mimeType));
      }
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "filename",
      description: "The name of the resulting file. If not specified, the name of the Google Doc will be used.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  cacheTtlSecs: 0,
  onError: onError,
  execute: async function (args, context) {
    let [doc, format, filename] = args;
    let docId = parseDocUrl(doc);
    let mimeTypes = await getSupportedExportFormats(context);
    let mimeType = mimeTypes.find(mimeType => mimeType == format || mime.extension(mimeType) == format);
    if (!mimeType) {
      return `Format not supported: ${format}`;
    }
    if (!filename) {
      let {name} = await getDocInfo(context, docId);
      let extension = mime.extension(mimeType);
      filename = sanitize(`${name}.${extension}`);
    }
    let url = coda.withQueryParams(`https://www.googleapis.com/drive/v3/files/${docId}/export`, {
      mimeType: mimeType,
    });
    return context.temporaryBlobStorage.storeUrl(url, {
      expiryMs: OneDaySecs * 1000,
      contentType: mimeType,
      downloadFilename: filename,
    });
  },
});

interface ExportOptions {
  name?: string;
  docId?: string;
  folderId?: string;
}

async function exportToDoc(context: coda.ExecutionContext, content: Buffer, mimeType: string, options?: ExportOptions): Promise<DriveFile> {
  let url = "https://www.googleapis.com/upload/drive/v3/files";
  let method: coda.FetchMethodType = "POST";
  if (options?.docId) {
    url = coda.joinUrl(url, options.docId);
    method = "PATCH";
  }
  url = coda.withQueryParams(url, {
    uploadType: "multipart",
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  let metadata = {
    name: options?.name,
    mimeType: DocsMimeType,
    parents: options.folderId ? [options.folderId] : undefined,
  };
  let form = new FormData();
  form.append("metadata", Buffer.from(JSON.stringify(metadata)), {
    contentType: "application/json; charset=UTF-8",
  });
  form.append("media", content, {
    contentType: mimeType,
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
  return file;
}

async function addPermission(context: coda.ExecutionContext, fileId: string, permissionJson: string) {
  let permission = JSON.parse(permissionJson);
  let {sendNotificationEmail, ...rest} = permission;
  permission = rest;
  let url = coda.withQueryParams(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    sendNotificationEmail,
    supportsAllDrives: true,
  });
  let response = await context.fetcher.fetch({
    method: "POST",
    url: url,
    headers: {
      "Content-Type": "application/json",
    },
    body: permissionJson,
  });
  return response.body;
}

async function adjustDoc(context: coda.ExecutionContext, fileId: string, pageSize: number[] | undefined) {
  if (!pageSize) {
    return;
  }
  let requests = [];
  if (pageSize) {
    requests.push({
      updateDocumentStyle: {
        documentStyle: {
          pageSize: {
            width: {
              magnitude: pageSize[0],
              unit: "PT",
            },
            height: {
              magnitude: pageSize[1],
              unit: "PT",
            },
          },
        },
        fields: "pageSize",
      },
    });
  }
  return modifyDoc(context, fileId, requests);
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

async function getSupportedImportFormats(context: coda.ExecutionContext): Promise<string[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://www.googleapis.com/drive/v3/about?fields=importFormats",
    cacheTtlSecs: OneDaySecs,
  });
  let formats = response.body.importFormats;
  return Object.keys(formats).filter(mimeType => formats[mimeType].includes(DocsMimeType));
}

async function getSupportedExportFormats(context: coda.ExecutionContext): Promise<string[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://www.googleapis.com/drive/v3/about?fields=exportFormats",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.exportFormats[DocsMimeType];
}

async function getDocInfo(context: coda.ExecutionContext, docId: string) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://www.googleapis.com/drive/v3/files/${docId}?fields=name&supportsAllDrives=true`,
    cacheTtlSecs: OneDaySecs,
  });
  return response.body;
}

function processHtml(html:string): {title: string, html: string} {
  let $ = cheerio.load(html);

  // Enforce max image width.
  $("img").each((_i, img) => {
    let width = $(img).attr("width");
    if (width && Number(width) > MaxImageWidth) {
      $(img).attr("width", MaxImageWidth);
      $(img).attr("height", "auto");
    }
  });

  let title = $("h1,h2,h3").first().text();
  let fixed = $(":root").html();

  return {title, html: fixed};
}

function onError(error: Error) {
  if (coda.StatusCodeError.isStatusCodeError(error) && error.body.error.message && error.statusCode != 401) {
    if (error.statusCode == 403 && error.body?.error?.errors?.[0]?.reason == "insufficientPermissions") {
      throw new coda.MissingScopesError("You must check the box next to each permission.");
    }
    throw new coda.UserVisibleError("Error from Google Docs: " + error.body.error.message);
  }
  throw error;
}

interface DriveFile {
  id: string;
  webViewLink: string;
}