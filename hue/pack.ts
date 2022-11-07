import * as coda from "@codahq/packs-sdk";
import HueColor from "hue-colors";
import CSSColorList from "css-named-colors";
import * as hsl from "hsl-to-hex";
import { getColorSwatchUri, getLights, getResource, getRooms, getScenes, setState } from "./helpers";
import { LightSchema, LightStatusSchema as LightStateSchema, RoomSchema, SceneSchema } from "./schemas";

export const pack = coda.newPack();

const BaseUrl = "https://api.meethue.com";
const ApplicationName = "Hue Pack for Coda";
const HexRegex = /^#?[0-9a-f]{6}$/;
const MaxAPIHue = 65535;
const MaxAPISat = 254;
const MaxAPIBri = 254;

const LightIdParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "lightId",
  description: "The ID of the light to control (auto-complete available).",
  autocomplete: async function (context) {
    let lights = await getLights(context);
    return lights.map(light => {
      return { display: light.name, value: light.id };
    });
  },
});

const RoomIdParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "roomId",
  description: "The ID of the room to control (auto-complete available).",
  autocomplete: async function (context) {
    let rooms = await getRooms(context);
    return rooms.map(room => {
      return { display: room.name, value: room.id };
    });
  },
});

const LightOrRoomIdParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "lightOrRoomId",
  description: "The ID of the light or room to control (auto-complete available).",
  autocomplete: async function (context) {
    let [lights, rooms] = await Promise.all([
      getLights(context),
      getRooms(context),
    ]);
    return [].concat(
      [
        { display: "All lights", value: "groups/0" },
      ],
      lights.map(light => {
        return { display: `${light.name} (Light)`, value: light.id };
      }),
      rooms.map(room => {
        return { display: `${room.name} (Room)`, value: room.id };
      }),
    );
  },
});

const SceneIdParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "sceneId",
  description: "The ID of the scene to control (auto-complete available).",
  autocomplete: async function (context, _, args) {
    let {roomId} = args;
    let scenes = await getScenes(context);
    return scenes
      .filter(scene => scene.room.id == roomId)
      .map(scene => {
        return { display: scene.name, value: scene.id };
      });
  },
});

const ErrorHandler = function(error) {
  if (error.status == 504) {
    throw new coda.UserVisibleError("The request timed out, please try again.");
  }
  throw error;
}

pack.addNetworkDomain("meethue.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://api.meethue.com/v2/oauth2/authorize",
  tokenUrl: "https://api.meethue.com/v2/oauth2/token",
  postSetup: [{
    type: coda.PostSetupType.SetEndpoint,
    name: "Link",
    description: "You're all set!",
    getOptions: async function (context) {
      await context.fetcher.fetch({
        method: "PUT",
        url: "https://api.meethue.com/route/api/0/config",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ linkbutton: true }),
      });
      let response = await context.fetcher.fetch({
        method: "POST",
        url: "https://api.meethue.com/route/api",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ devicetype: ApplicationName }),
      });
      let username = response.body[0].success.username;
      let endpoint = `${BaseUrl}#${username}`
      return [
        { display: "Click here to complete login.", value: endpoint },
      ];
    },
  }],
});

pack.addFormula({
  name: "TurnOn",
  description: "Turns a light or room on.",
  parameters: [
    LightOrRoomIdParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1"], result: "Done" },
    { params: ["groups/1"], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId], context) {
    await setState(context, lightOrRoomId, {
      on: true,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "TurnOff",
  description: "Turns a light or room off.",
  parameters: [
    LightOrRoomIdParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1"], result: "Done" },
    { params: ["groups/1"], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId], context) {
    await setState(context, lightOrRoomId, {
      on: false,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetColor",
  description: "Changes the color of a light or room, given a hue and saturation.",
  parameters: [
    LightOrRoomIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "hue",
      description: "The hue to set, as a number between 0 (red) and 360 (also red).",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "saturation",
      description: "The satuation to set, as a number between 0 (no saturation) and 100 (full saturation).",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1", 265, 60], result: "Done" },
    { params: ["groups/1", 265, 60], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId, hue, saturation], context) {
    if (hue < 0 || hue > 360) {
      throw new coda.UserVisibleError(`Invalid hue: "${hue}".The value must be between 0 and 360.`)
    }
    hue = Math.round(hue / 360 * MaxAPIHue);

    if (saturation < 0 || saturation > 100) {
      throw new coda.UserVisibleError(`Invalid saturation: "${saturation}".The value must be between 0 and 100.`)
    }
    saturation = Math.round(saturation / 100 * MaxAPISat);

    await setState(context, lightOrRoomId, {
      on: true,
      hue: hue,
      sat: saturation,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetColorCSS",
  description: "Changes the color of a light or room, approximating the CSS color string provided.",
  parameters: [
    LightOrRoomIdParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "color",
      description: `The CSS color to set. Must be a named CSS color (ex: "red") or a hex string (ex: "#ff2200").`,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1", "red"], result: "Done" },
    { params: ["groups/1", "red"], result: "Done" },
    { params: ["lights/1", "#ff0000"], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId, color], context) {
    color = color.toLocaleLowerCase();
    let hex = CSSColorList.find(c => c.name == color)?.hex;
    if (!hex && color.match(HexRegex)) {
      hex = color;
    }
    if (!hex) {
      throw new coda.UserVisibleError(`Invalid color: "${color}". Must be a named CSS color (ex: "red") or a hex string (ex: "#ff2200").`);
    }
    hex = hex.replace(/^#/, "").toLocaleLowerCase();
    let hueColor = HueColor.fromHex(hex);
    let [hue, saturation, brightness] = hueColor.toHsb();
    await setState(context, lightOrRoomId, {
      on: true,
      hue: hue,
      sat: saturation,
      bri: brightness,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetBrightness",
  description: "Changes the brightness of a light or room.",
  parameters: [
    LightOrRoomIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "brightness",
      description: "The percentage brightness, from 0 to 100.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1", 75], result: "Done" },
    { params: ["groups/1", 75], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId, brightness], context) {
    await setState(context, lightOrRoomId, {
      on: true,
      bri: Math.round((brightness / 100) * 255),
    });
    return "Done";
  },
});

pack.addFormula({
  name: "Blink",
  description: "Makes a light or room blink.",
  parameters: [
    LightOrRoomIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "long",
      description: "If the light(s) should blink for a long time (15 seconds).",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["lights/1"], result: "Done" },
    { params: ["groups/1"], result: "Done" },
    { params: ["lights/1", true], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([lightOrRoomId, long], context) {
    await setState(context, lightOrRoomId, {
      on: true,
      alert: long ? "lselect" : "select",
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetScene",
  description: "Sets the lights to the settings determined by a saved scene.",
  parameters: [
    RoomIdParam,
    SceneIdParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  examples: [
    { params: ["groups/1", "abc123"], result: "Done" },
  ],
  onError: ErrorHandler,
  execute: async function ([roomId, sceneId], context) {
    await setState(context, roomId, {
      scene: sceneId,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "LightState",
  description: "Gets the current state of a light.",
  parameters: [
    LightIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Date,
      name: "now",
      description: "The current time, needed to refresh the values.",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: LightStateSchema,
  cacheTtlSecs: 0,
  execute: async function ([lightId, _], context) {
    let {name, state} = await getResource(context, `${lightId}`, {
      cacheTtlSecs: 0,
    });
    let {hue, sat, bri} = state;
    let hueColor = HueColor.fromHsb(hue, sat, MaxAPIBri);
    let color = "#" + hueColor.toHex().toLocaleLowerCase();
    hue = Math.round((hue / MaxAPIHue) * 360);
    sat = Math.round((sat / MaxAPISat) * 100);
    bri = Math.round((bri / MaxAPIBri) * 100);
    return {
      id: lightId,
      name: name,
      ...state,
      hue: Math.round((state.hue / MaxAPIHue) * 360),
      sat: Math.round((state.sat / MaxAPISat) * 100),
      bri: Math.round((state.bri / MaxAPIBri) * 100),
      color,
      swatch: getColorSwatchUri(color),
    }
  },
});

pack.addSyncTable({
  name: "Lights",
  identityName: "Light",
  description: "The lights connected to your bridge.",
  schema: LightSchema,
  formula: {
    name: "SyncLights",
    description: "Sync the lights.",
    parameters: [],
    execute: async function ([], context) {
      let lights = await getLights(context);
      return {
        result: lights,
      };
    },
  },
});

pack.addSyncTable({
  name: "Rooms",
  identityName: "Room",
  description: "The rooms configured in your bridge.",
  schema: RoomSchema,
  formula: {
    name: "SyncRooms",
    description: "Sync the rooms.",
    parameters: [],
    execute: async function ([], context) {
      let rooms = await getRooms(context);
      return {
        result: rooms,
      };
    },
  },
});

pack.addSyncTable({
  name: "Scenes",
  identityName: "Scene",
  description: "The scenes configured in your bridge.",
  schema: SceneSchema,
  formula: {
    name: "SyncScenes",
    description: "Sync the scenes.",
    parameters: [],
    execute: async function ([], context) {
      let scenes = await getScenes(context);
      return {
        result: scenes,
      };
    },
  },
});
