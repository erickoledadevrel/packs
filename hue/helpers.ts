import * as coda from "@codahq/packs-sdk";

export async function setState(context, lightId, state) {
  let username = getUsername(context.endpoint);
  console.log(JSON.stringify(state));
  await context.fetcher.fetch({
    method: "PUT",
    url: `https://api.meethue.com/route/api/${username}/lights/${lightId}/state`,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });
}

export async function getLights(context) {
  let data = await getResource(context, "lights");
  return Object.entries(data).map(([id, value]) => {
    let light = value as any;
    return {
      ...light,
      ...light.config,
      id,
    };
  });
}

export async function getResource(context, path, options = {}) {
  let username = getUsername(context.endpoint);
  let url = coda.joinUrl(`https://api.meethue.com/route/api/${username}`, path);
  let response = await context.fetcher.fetch({
    method: "GET",
    url,
    ...options,
  });
  let data = response.body;
  let error = data?.[0]?.error;
  if (error) {
    throw new Error(error.description);
  }
  return data;
}

function getUsername(endpoint) {
  return endpoint.split("#")[1];
}

export function getColorSwatchUri(color) {
  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50">
      <rect width="100%" height="100%" fill="${color}" />
    </svg>
  `.trim();
  let encoded = Buffer.from(svg).toString("base64");
  return coda.SvgConstants.DataUrlPrefix + encoded;
}
