import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const OneDaySecs = 24 * 60 * 60;
const PageSize = undefined;

pack.addNetworkDomain("amazonaws.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.AWSAccessKey,
  instructionsUrl:
    "https://aws.amazon.com/premiumsupport/knowledge-center/create-access-key/",
  service: "s3",
  requiresEndpointUrl: true,
  endpointDomain: "amazonaws.com",
  getConnectionName: async function (context) {
    return context.endpoint.split("//")[1].split(".")[0];
  },
});

const ObjectSchema = coda.makeObjectSchema({
  properties: {
    key: {
      type: coda.ValueType.String,
      description: "The key (path) of the file in the bucket.",
    },
    lastModified: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.DateTime,
      description: "The last modified date of the file.",
    },
    size: {
      type: coda.ValueType.Number,
      description: "The size of the file, in bytes.",
    },
    url: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
      description: "The full URL of the file on S3. Use the TemporaryDownloadUrl() formula to generate a URL that anyone can use to download the file.",
    },
  },
  displayProperty: "key",
  idProperty: "key",
});

pack.addSyncTable({
  name: "Objects",
  description: "List the objects (files) in an Amazon S3 bucket. The bucket and region are deteremined by the account used.",
  identityName: "Object",
  schema: ObjectSchema,
  formula: {
    name: "SyncObjects",
    description: "Syncs the objects.",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "prefix",
        description: "If specified, only objects who's key starts with this prefix will be returned.",
        optional: true,
      }),
    ],
    execute: async function (args, context) {
      let [prefix] = args;
      let continuationToken = context.sync.continuation?.token;

      let url = coda.withQueryParams("/", {
        "list-type": 2,
        "continuation-token": continuationToken,
        "prefix": prefix,
        "max-keys": PageSize,
      });
      let response = await context.fetcher.fetch({
        method: "GET",
        url: url,
      });

      let items = response.body.Contents.map(item => formatObject(context, item));
      let continuation;
      if (response.body.IsTruncated[0] == "true") {
        continuation = {
          token: response.body.NextContinuationToken[0],
        };
      }
      return {
        result: items,
        continuation,
      };
    },
  },
});

function formatObject(context: coda.ExecutionContext, obj) {
  return {
    key: obj.Key[0],
    lastModified: obj.LastModified[0],
    size: Number(obj.Size[0] || 0),
    url: coda.joinUrl(context.endpoint, obj.Key[0]),
  };
}

pack.addFormula({
  name: "TemporaryDownloadUrl",
  description: "Generates a temporary URL, valid for 24 hours, that can be used to download the file.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "keyOrUrl",
      description: "The object's key or full S3 URL.",
    }),
  ],
  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Url,
  execute: async function (args, context) {
    let [key] = args;

    let url = key.startsWith("https://") ? key : coda.joinUrl("/", key);

    let tempUrl = context.temporaryBlobStorage.storeUrl(url, {
      downloadFilename: key.split("/").pop(),
      expiryMs: OneDaySecs * 1000,
    });
    return tempUrl;
  },
});

pack.addFormula({
  name: "Upload",
  description: "Upload a file to AWS S3.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.File,
      name: "file",
      description: "The file to upload.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The target file name. Default: the original file name.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "path",
      description: "The target directory path. Default: the root directory.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([fileUrl, name, path="/"], context) {
    // Fetch the file contents.
    let response = await context.fetcher.fetch({
      method: "GET",
      url: fileUrl,
      isBinaryResponse: true,
      disableAuthentication: true,
    });
    let buffer = response.body;
    let contentType = response.headers["content-type"] as string;
    let contentDisposition = response.headers["content-disposition"] as string;

    // Determine file name.
    if (!name && contentDisposition) {
      name = getFilename(contentDisposition);
    }
    if (!name) {
      // Fallback to last segment of the URL.
      name = fileUrl.split("/").pop();
    }

    // Upload to S3.
    let s3Url = coda.joinUrl(context.endpoint, path, encodeURIComponent(name));
    await context.fetcher.fetch({
      method: "PUT",
      url: s3Url,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });
    return s3Url;
  },
});

// Gets the filename from a Content-Disposition header value.
function getFilename(contentDisposition) {
  let match = contentDisposition.match(/filename=(.*?)(;|$)/);
  if (!match) {
    return;
  }
  let filename = match[1].trim();
  // Remove quotes around the filename, if present.
  filename = filename.replace(/^["'](.*)["']$/, "$1");
  return filename;
}
