import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

const InfoSchema = coda.makeObjectSchema({
  properties: {
    ip: {
      type: coda.ValueType.String,
      description: "The IP address.",
    },
    city: {
      type: coda.ValueType.String,
      description: "The city where the IP is associated.",
    },
    region: {
      type: coda.ValueType.String,
      description: "The region where the IP is associated.",
    },
    country: {
      type: coda.ValueType.String,
      description: "The country where the IP is associated.",
    },
    postal: {
      type: coda.ValueType.String,
      description: "The post code where the IP is associated.",
    },
    timezone: {
      type: coda.ValueType.String,
      description: "The timezone where the IP is associated.",
    },
    latitude: {
      type: coda.ValueType.Number,
      description: "The latitude where the IP is associated.",
    },
    longitude: {
      type: coda.ValueType.Number,
      description: "The longitude where the IP is associated.",
    },
  },
  displayProperty: "ip",
});

pack.addFormula({
  name: "IPInfo",
  description: "Gets information about an IP address.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "ipAddress",
      description: "The IP address to lookup.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: InfoSchema,
  execute: async function (args, context) {
    let [ipAddress] = args;
    let response = await context.fetcher.fetch({
      method: "GET",
      url: `https://ipinfo.io/${ipAddress}/json`,
    });
    let data = response.body;
    if (data.loc) {
      let [lat, long] = data.loc.split(",").map(p => Number(p));
      data.latitude = lat;
      data.longitude = long;
    }
    return data;
  },
});

pack.addNetworkDomain("ipinfo.io");
