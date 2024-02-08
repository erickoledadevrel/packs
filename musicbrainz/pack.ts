import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

pack.addNetworkDomain("musicbrainz.org");

const ArtistSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String },
    id: { type: coda.ValueType.String },
    gender: { type: coda.ValueType.String },
    country: { type: coda.ValueType.String },
    born: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
    died: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
  },
  displayProperty: "name",
});

pack.addFormula({
  name: "Artist",
  description: "TODO",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description: "The name of the artist.",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: ArtistSchema,
  execute: async function (args, context) {
    let [name] = args;
    let response = await get(context, "artist", {
      query: name,
      limit: 1,
    });
    let artist = response.artists[0];
    if (!artist) {
      return {
        name: "Not Found",
      };
    }
    return artist;
  },
});

async function get(context: coda.ExecutionContext, path: string, parameters?: Record<string, string|number>) {
  let url = coda.withQueryParams(coda.joinUrl("https://musicbrainz.org/ws/2/", path), parameters);
  let response = await context.fetcher.fetch({
    method: "GET",
    url: url,
    headers: {
      Accept: "application/json",
    },
  });
  return response.body;
}
