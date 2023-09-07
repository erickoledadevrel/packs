import * as coda from "@codahq/packs-sdk";
export const pack = coda.newPack();

pack.addNetworkDomain("taylor-swift-api.sarbo.workers.dev");

const PageSize = 20;
const OneDaySecs = 24 * 60 * 60;

const AlbumSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String, required: true },
    album_id: { type: coda.ValueType.Number, required: true },
    release_date: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
  },
  displayProperty: "title",
  idProperty: "album_id",
  featuredProperties: ["release_date", "songs"],
});

const AlbumnReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(AlbumSchema, "Album");

const SongSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String, required: true },
    song_id: { type: coda.ValueType.Number, required: true },
    album: AlbumnReferenceSchema,
    lyrics: { type: coda.ValueType.String },
  },
  displayProperty: "title",
  idProperty: "song_id",
  featuredProperties: ["album", "lyrics"],
});

const SongReferenceSchema = coda.makeReferenceSchemaFromObjectSchema(SongSchema, "Song");

AlbumSchema.properties["songs"] = coda.makeSchema({
  type: coda.ValueType.Array,
  items: SongReferenceSchema,
});

pack.addSyncTable({
  name: "Albums",
  description: "Lists all of her albums.",
  identityName: "Album",
  schema: AlbumSchema,
  formula: {
    name: "SyncAlbums",
    description: "",
    parameters: [],
    execute: async function (args, context) {
      let [albums, songs] = await Promise.all([
        getAlbums(context),
        getSongs(context),
      ]);
      for (let album of albums) {
        album.songs = [];
        for (let song of songs) {
          if (song.album_id == album.album_id) {
            album.songs.push({
              song_id: song.song_id,
              title: "Not found",
            });
          }
        }
      }
      return {
        result: albums,
      };
    },
  },
});

pack.addSyncTable({
  name: "Songs",
  description: "Lists all of her songs.",
  identityName: "Song",
  schema: SongSchema,
  formula: {
    name: "SyncSongs",
    description: "",
    parameters: [],
    execute: async function (args, context) {
      let index = context.sync.continuation?.index as number || 0;
      let songs = await getSongs(context);
      let rows = songs.slice(index, index + PageSize);
      for (let row of rows) {
        row.album = {
          album_id: row.album_id,
          title: "Not found",
        };
      }
      let lyrics = await Promise.all(rows.map(async row => getLyrics(context, row.song_id)));
      for (let i = 0; i < rows.length; i++) {
        rows[i].lyrics = lyrics[i];
      };

      let continuation;
      index += PageSize;
      if (songs.length > index) {
        continuation = { index };
      }
      return {
        result: rows,
        continuation,
      };
    },
  },
});

pack.addFormula({
  name: "RandomLyrics",
  description: "Gets some lyrics from a randomly selected song.",
  parameters: [],
  resultType: coda.ValueType.String,
  cacheTtlSecs: 0,
  execute: async function (args, context) {
    let response = await context.fetcher.fetch({
      method: "GET",
      url: "https://taylor-swift-api.sarbo.workers.dev/lyrics?numberOfParagraphs=1&shouldRandomizeLyrics=true",
      cacheTtlSecs: 0,
    });
    return response.body.lyrics[0];
  },
});

async function getAlbums(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://taylor-swift-api.sarbo.workers.dev/albums",
  });
  return response.body;
}

async function getSongs(context: coda.ExecutionContext) {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: "https://taylor-swift-api.sarbo.workers.dev/songs",
    cacheTtlSecs: OneDaySecs,
  });
  return response.body;
}

async function getLyrics(context: coda.ExecutionContext, song_id: number): Promise<string> {
  let response = await context.fetcher.fetch({
    method: "GET",
    url: coda.joinUrl("https://taylor-swift-api.sarbo.workers.dev/lyrics/", String(song_id)),
  });
  return response.body.lyrics;
}
