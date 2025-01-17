import * as coda from "@codahq/packs-sdk";
import {Address} from "@universe/address-parser";

export const pack = coda.newPack();

pack.addNetworkDomain("usps.com");

pack.setSystemAuthentication({
  type: coda.AuthenticationType.OAuth2ClientCredentials,
  // The following URL will be found in the API's documentation.
  tokenUrl: "https://apis.usps.com/oauth2/v3/token",
});

pack.addFormula({
  name: "StandardizeAddress",
  description: "TODO",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "address",
      description: "The address to standardize.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function (args, context) {
    let [address] = args;
    if (!address) return "";
    // TODO: Split by lines.
    let parsed = new Address(address);
    let found = await lookupAddress(context, parsed);
    return found.print();
  },
});

async function lookupAddress(context: coda.ExecutionContext, parsed: Address): Promise<Address> {
  let formatted = parsedToUSPS(parsed);
  let url = coda.withQueryParams("https://apis.usps.com/addresses/v3/address", {
    ...formatted,
  });
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
  });
  let found: USPSAddress = {
    firm: response.body.firm,
    ...response.body.address,
  };
  return uspsToParsed(found);
}

interface USPSAddress {
  firm: string;
  streetAddress: string;
  secondaryAddress: string;	
  city: string,
  state: string;
  urbanization?: string;
  ZIPCode: string;
  ZIPPlus4: string;
}

function parsedToUSPS(parsed: Address): USPSAddress {
  let {care, line1, line2, city, state, urbanization, zip, zip4} = parsed.label();
  return {
    firm: care,
    streetAddress: line1,
    secondaryAddress: line2,
    city: city,
    state: state,
    urbanization: urbanization,
    ZIPCode: zip || undefined,
    ZIPPlus4: zip4 || undefined,
  };
}

function uspsToParsed(usps: USPSAddress): Address {
  let {firm, streetAddress, secondaryAddress, city, state, urbanization, ZIPCode, ZIPPlus4} = usps;
  return new Address(firm, streetAddress, secondaryAddress, city, state, urbanization, 
    [ZIPCode, ZIPPlus4].filter(Boolean).join("-")
  );
}