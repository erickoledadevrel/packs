import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

pack.addNetworkDomain("httpbin.org");

const ValidFetchMethods = ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'] as const;
type FetchMethodType = typeof ValidFetchMethods[number];

pack.addFormula({
  name: "Request",
  description: "Make a request to httpbin.org.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "path",
      description: "The path to request.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "method",
      description: "The HTTP method.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "contentType",
      description: "The Content-Type header.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "body",
      description: "The request body.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "formName",
      description: "The name of a form field.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "formValue",
      description: "The value of form field.",
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "isBinary",
      description: "If the content to fetch is binary. Default: false.",
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.String,
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
        url: sdk.joinUrl("https://httpbin.org/", path),
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
