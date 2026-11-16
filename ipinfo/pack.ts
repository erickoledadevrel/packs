import * as sdk from "@superhuman/plugins-sdk";
export const pack = sdk.newPack();

const InfoSchema = sdk.makeObjectSchema({
  properties: {
    ip: {
      type: sdk.ValueType.String,
      description: "The IP address.",
    },
    city: {
      type: sdk.ValueType.String,
      description: "The city where the IP is associated.",
    },
    region: {
      type: sdk.ValueType.String,
      description: "The region where the IP is associated.",
    },
    country: {
      type: sdk.ValueType.String,
      description: "The country where the IP is associated.",
    },
    postal: {
      type: sdk.ValueType.String,
      description: "The post code where the IP is associated.",
    },
    timezone: {
      type: sdk.ValueType.String,
      description: "The timezone where the IP is associated.",
    },
    latitude: {
      type: sdk.ValueType.Number,
      description: "The latitude where the IP is associated.",
    },
    longitude: {
      type: sdk.ValueType.Number,
      description: "The longitude where the IP is associated.",
    },
  },
  displayProperty: "ip",
});

pack.addFormula({
  name: "IPInfo",
  description: "Gets information about an IP address.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "ipAddress",
      description: "The IP address to lookup.",
    }),
  ],
  resultType: sdk.ValueType.Object,
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
