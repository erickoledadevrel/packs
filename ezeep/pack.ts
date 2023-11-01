import * as coda from "@codahq/packs-sdk";
import { PrintJobStatusSchema, PrinterSchema, WebhookPrintJobSchema } from "./schemas";
import { getPrinters, print, getAllPrinterProperties, getSupportedFileFormats, OneDaySecs } from "./helpers";
import { PrinterParameter, OrientationParameter, CopiesParameter, ColorParameter, PaperSizeParameter, PaperWidthParameter, PaperLengthParameter, ResolutionParameter, DuplexParameter } from "./parameters";

export const pack = coda.newPack();

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://account.ezeep.com/oauth/authorize",
  tokenUrl: "https://account.ezeep.com/oauth/access_token/",
  scopes: ["printing", "reporting"],
  credentialsLocation: coda.TokenExchangeCredentialsLocation.AuthorizationHeader,
  getConnectionName: async function (context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://account.ezeep.com/v1/users/",
    });
    let users = response.body?.results;
    if (users?.length == 1) {
      // Regular users can only access their own account, so this must be the
      // logged in user.
      return users[0].display_name;
    }
    // This must be an admin, no way to tell which users they are. Fall back to
    // the Coda user's name.
    return "";
  },
});

pack.addNetworkDomain("ezeep.com");

pack.addFormula({
  name: "PrintFile",
  description: "Prints a file using a connected printer.",
  parameters: [
    PrinterParameter,
    coda.makeParameter({
      type: coda.ParameterType.File,
      name: "file",
      description: "The file to print.",
    }),
    OrientationParameter,
    CopiesParameter,
    ColorParameter,
    DuplexParameter,
    PaperSizeParameter,
    PaperWidthParameter,
    PaperLengthParameter,
    ResolutionParameter,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [printerId, fileUrl, orientation, copies, color, duplex, paperSize, paperWidth, paperLength, resolution] = args;
    return await print(context, printerId, fileUrl, {
      orientation, copies, color, paperSize, paperWidth, paperLength: paperLength, resolution, duplex,
    });
  },
});

pack.addFormula({
  name: "PrintPage",
  description: "TODO",
  parameters: [
    PrinterParameter,
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "page",
      description: "The page or text content to print.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  isExperimental: true,
  execute: async function (args, context) {
    let [printerId, pageText] = args;
    let tempUrl = await context.temporaryBlobStorage.storeBlob(Buffer.from(pageText), "txt", {
      downloadFilename: "page.txt",
    });
    return await print(context, printerId, tempUrl);
  },
});

pack.addSyncTable({
  name: "Printers",
  description: "Lists the available printers.",
  identityName: "Printer",
  schema: PrinterSchema,
  formula: {
    name: "SyncPrinters",
    description: "Syncs the data.",
    parameters: [],
    execute: async function (args, context) {
      let [printers, properties] = await Promise.all([
        getPrinters(context),
        getAllPrinterProperties(context),
      ]);
      for (let printer of printers) {
        let props = properties.find(prop => prop.Id == printer.id);
        Object.assign(printer, props);
        printer.orientations = props.OrientationsSupported?.map((or, i) => {
          let orId = props.OrientationsSupportedId[i];
          return {name: or, id: orId};
        });
      }
      return {
        result: printers,
      };
    },
  },
});

pack.addFormula({
  name: "SupportedFileFormats",
  description: "Lists the file formats (file extensions) that can be printed.",
  parameters: [],
  resultType: coda.ValueType.Array,
  items: coda.makeSchema({
    type: coda.ValueType.String,
  }),
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    return await getSupportedFileFormats(context);
  },
});

pack.addFormula({
  name: "PrintJobStatus",
  description: "Gets the status of a print job.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "jobId",
      description: "The ID of the print job, as returned by the PrintFile action.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: PrintJobStatusSchema,
  cacheTtlSecs: 0,
  execute: async function (args, context) {
    let [jobId] = args;
    if (!jobId) {
      return "";
    }
    let response = await context.fetcher.fetch({
      method: "GET",
      url: coda.withQueryParams("https://printapi.ezeep.com/sfapi/Status/", {
        id: jobId,
      }),
      cacheTtlSecs: 0,
    });
    let job = response.body;
    job.jobstatusstring = job.jobstatusstring?.split("|")[0]?.toLowerCase();
    if (job.jobstatusstring == "error") {
      job.jobstatusstring = "not found";
    }
    job.timestamp = (new Date()).toISOString();
    return job;
  },
});

pack.addColumnFormat({
  name: "Print Job Status",
  instructions: "Enter the print job ID to get it's status.",
  formulaName: "PrintJobStatus",
  matchers: [],
});

pack.addFormula({
  name: "CompletedPrintJob",
  description: "Extracts information about the completed print job from the webhook body.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "json",
      description: "The JSON payload sent by the print job wehbook.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: WebhookPrintJobSchema,
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [json] = args;
    let data = JSON.parse(json);
    let job = data.content.printjob;
    job.user = {
      name: job.user_name,
      id: job.user_id,
      email: job.user_email,
    };
    job.printer = {
      id: job.printer_id,
      name: job.printer_name,
    }
    return job;
  },
});
