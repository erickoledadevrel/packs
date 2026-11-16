import * as sdk from "@superhuman/plugins-sdk";

const OneDaySecs = 24 * 60 * 60;
const StyleMap = {
  "font-weight: bold": "b",
  "font-style: italic": "i",
  "text-decoration: underline": "u",
};

export const pack = sdk.newPack();

pack.addNetworkDomain("medium.com");

pack.setUserAuthentication({
  type: sdk.AuthenticationType.HeaderBearerToken,
  instructionsUrl: "https://medium.com/me/settings/security",
  getConnectionName: async function (context) {
    let user = await getUser(context);
    return user.username;
  },
});

pack.addFormula({
  name: "CreateDraft",
  description: "Creates a new draft post.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "title",
      description: "The title of the post.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Html,
      name: "content",
      description: "The content of the post.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "publication",
      description: "The publication to post to. Default: your personal blog.",
      optional: true,
      autocomplete: async function (context, search) {
        let user = await getUser(context);
        let publications = await getPublications(context, user.id);
        let contributors = await Promise.all(publications.map(pub => getContributors(context, pub.id)));
        publications = publications.filter((pub, i) => contributors[i].some(con => con.userId == user.id));
        publications.unshift({
          name: "None",
          id: "",
        });
        return sdk.autocompleteSearchObjects(search, publications, "name", "id");
      }
    }),
  ],
  resultType: sdk.ValueType.String,
  isAction: true,
  execute: async function (args, context) {
    let [title, content, publicationId] = args;
    content = transformHtml(content);
    let fragment;
    if (publicationId) {
      fragment = `publication/${publicationId}`;
    } else {
      let user = await getUser(context);
      fragment = `users/${user.id}`;
    }
    let payload = {
      title,
      content,
      contentFormat: "html",
      publishStatus: "draft",
    };
    let response = await context.fetcher.fetch({
      method: "POST",
      url: sdk.joinUrl("https://api.medium.com/v1/", fragment, "/posts"),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    let post = response.body.data;
    return post.url;
  },
});

async function getUser(context: sdk.ExecutionContext): Promise<any> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://api.medium.com/v1/me",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body.data;
}

async function getPublications(context: sdk.ExecutionContext, userId: string): Promise<any[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.medium.com/v1/users/${userId}/publications`,
  });
  return response.body.data;
}

async function getContributors(context: sdk.ExecutionContext, publicationId): Promise<any[]> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.medium.com/v1/publications/${publicationId}/contributors`,
  });
  return response.body.data;
}

function transformHtml(html) {
  for (let [style, tagname] of Object.entries(StyleMap)) {
    let regex = new RegExp(`<span style="(.*)?${style};(.*?)">(.*?)</span>`, "g");
    html = html.replace(regex, (match, before, after, content) => {
      let remainder = [before, after].filter(Boolean).map(part => part.trim()).join(" ");
      return `<span style="${remainder}"><${tagname}>${content}</${tagname}></span>`;
    });
  }
  return html;
}
