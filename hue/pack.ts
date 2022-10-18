import * as coda from "@codahq/packs-sdk";
import HueColor from "hue-colors";
import CSSColorList from 'css-named-colors';
import { getColorSwatchUri, getLights, getResource, setState } from "./helpers";
import { LightSchema, LightStatusSchema as LightStateSchema, RoomSchema } from "./schemas";

export const pack = coda.newPack();

const BaseUrl = "https://api.meethue.com";
const ApplicationName = "Hue Pack for Coda";

const LightIdParam = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "lightId",
  description: "The ID of the light to control.",
  autocomplete: async function (context) {
    let lights = await getLights(context);
    return lights.map(light => {
      return { display: light.name, value: light.id };
    });
  },
});

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
        { display: "Finish", value: endpoint },
      ];
    },
  }],
});

pack.addFormula({
  name: "TurnOn",
  description: "Turns a light on.",
  parameters: [
    LightIdParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([lightId], context) {
    await setState(context, lightId, {
      on: true,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "TurnOff",
  description: "Turns a light off.",
  parameters: [
    LightIdParam,
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([lightId], context) {
    await setState(context, lightId, {
      on: false,
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetColor",
  description: "Changes the color of a light.",
  parameters: [
    LightIdParam,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "color",
      description: "The color to set the light to.",
      autocomplete: async function (context, search, parameters) {
        return coda.autocompleteSearchObjects(search, CSSColorList, "name", "hex");
      },
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([lightId, color], context) {
    let strippedColor = color.replace(/^#/, "").toLocaleLowerCase();
    if (strippedColor.length != 6) {
      throw new coda.UserVisibleError(`The color must be a six digit hex string (Ex: #ff00ff). Got: ${color}.`);
    }
    let hueColor = HueColor.fromHex(strippedColor);
    console.log(JSON.stringify(hueColor));
    let cie = hueColor.toCie();
    await setState(context, lightId, {
      on: true,
      xy: cie.slice(0, 2),
    });
    return "Done";
  },
});

pack.addFormula({
  name: "SetBrightness",
  description: "Changes the brightness of a light.",
  parameters: [
    LightIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "brightness",
      description: "The percentage brightness, from 0 to 100.",
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([lightId, brightness], context) {
    await setState(context, lightId, {
      on: true,
      bri: Math.round((brightness / 100) * 255),
    });
    return "Done";
  },
});

pack.addFormula({
  name: "Blink",
  description: "Makes a light blink.",
  parameters: [
    LightIdParam,
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "long",
      description: "If the light should blink for a long time (15 seconds).",
      optional: true,
    }),
  ],
  resultType: coda.ValueType.String,
  isAction: true,
  execute: async function ([lightId, long], context) {
    await setState(context, lightId, {
      on: true,
      alert: long ? "lselect" : "select",
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
    let {name, state} = await getResource(context, `lights/${lightId}`, {
      cacheTtlSecs: 0,
    });
    let hueColor = HueColor.fromCIE(state.xy[0], state.xy[1], state.bri);
    let color = "#" + hueColor.toHex();
    return {
      id: lightId,
      name: name,
      ...state,
      bri: Math.round((state.bri / 255) * 100),
      color,
      colorSwatch: getColorSwatchUri(color),
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
      let data = await getResource(context, "groups");
      let rooms = Object.entries(data).map(([id, value]) => {
        let room = value as any;
        return {
          ...room,
          id,
          lights: room.lights.map(lightId => {
            return { id: lightId, name: "Not found" };
          }),
        };
      });
      return {
        result: rooms,
      };
    },
  },
});
