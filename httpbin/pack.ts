import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

pack.addNetworkDomain("httpbin.org");

const ValidFetchMethods = ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'] as const;
type FetchMethodType = typeof ValidFetchMethods[number];

pack.addFormula({
  name: "Request",
  description: "Make a request to httpbin.org.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "path",
      description: "The path to request.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "method",
      description: "The HTTP method.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "contentType",
      description: "The Content-Type header.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "body",
      description: "The request body.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "formName",
      description: "The name of a form field.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "formValue",
      description: "The value of form field.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "isBinary",
      description: "If the content to fetch is binary. Default: false.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async ([path, method = "GET", contentType, body, formName, formValue, isBinary = false], context) => {
    let headers = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    let form: any;
    if (formName && formValue) {
      form = {
        [formName]: formValue,
      };
    }
    try {
      let response = await context.fetcher.fetch({
        method: method as FetchMethodType,
        url: coda.joinUrl("https://httpbin.org/", path),
        headers: headers,
        body: body,
        form: form,
        isBinaryResponse: isBinary,
      });
      return JSON.stringify(response.body, null, 2);
    } catch (e) {
      return JSON.stringify(e, null, 2);
    }
  },
});
