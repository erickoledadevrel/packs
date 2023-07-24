import * as coda from "@codahq/packs-sdk";

export async function setState(context, lightOrRoomId, state) {
  let username = getUsername(context.endpoint);
  let url = coda.joinUrl(
    "https://api.meethue.com/route/api/",
    username,
    lightOrRoomId,
    lightOrRoomId.startsWith("group") ? "action" : "state"
  );
  await context.fetcher.fetch({
    method: "PUT",
    url,
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
      id: `lights/${id}`,
    };
  });
}

export async function getRooms(context) {
  let data = await getResource(context, "groups");
  return Object.entries(data).map(([id, value]) => {
    let room = value as any;
    return {
      ...room,
      id: `groups/${id}`,
      lights: room.lights.map(lightId => {
        return { id: `lights/${lightId}`, name: "Not found" };
      }),
    };
  });
}

export async function getScenes(context) {
  let data = await getResource(context, "scenes");
  return Object.entries(data).map(([id, value]) => {
    let scene = value as any;
    return {
      ...scene,
      id,
      lights: scene.lights?.map(lightId => {
        return { id: `lights/${lightId}`, name: "Not found" };
      }),
      room: scene.group ? { id: `groups/${scene.group}`, name: "Not found" } : null,
    };
  });
}

export async function getAutomations(context: coda.ExecutionContext) {
  let data = await getResourceV2(context, "behavior_instance");
  return data.map(automation => formatAutomation(automation));
}

export async function setTimePoint(context: coda.ExecutionContext, automationId: string, key: "start_at" | "end_at", type: string, time?: Date, offset?: number) {
  if (!automationId) throw new coda.UserVisibleError("The automation ID must be provided.");
  let timePoint: any;
  switch (type) {
    case "time":
      if (!time) throw new coda.UserVisibleError("The time must be provided.");
      timePoint = {
        type,
        time: getTimeParts(context, time),
      };
      break;
    case "sunrise":
    case "sunset":
      timePoint = { type };
      if (offset) {
        timePoint.offset = { minutes: offset };
      }
      break;
    default:
      throw new coda.UserVisibleError(`Invalid type: ${type}`);
  }
  let path = coda.joinUrl("behavior_instance", automationId as string)
  let [automation] = await getResourceV2(context, path, {
    cacheTtlSecs: 0,
  });
  let {configuration} = automation;
  configuration.when_extended[key] = {
    time_point: timePoint,
  };
  await getResourceV2(context, path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      configuration,
    }),
  });
  let [updated] = await getResourceV2(context, path, {
    cacheTtlSecs: 0,
  });
  return formatAutomation(updated);
}

export async function getResource(context, path, options = {}) {
  let username = getUsername(context.endpoint);
  let url = coda.joinUrl(`https://api.meethue.com/route/api/${username}`, path);
  let request: coda.FetchRequest = {
    method: "GET",
    url,
    ...options,
  };
  let response = await context.fetcher.fetch(request);
  let data = response.body;
  let fault = data.fault;
  if (fault) {
    throw new Error(fault.faultstring);
  }
  let error = data?.[0]?.error;
  if (error) {
    throw new Error(error.description);
  }
  return data;
}

export async function getResourceV2(context, path, options: any = {}) {
  let username = getUsername(context.endpoint);
  let url = coda.joinUrl(`https://api.meethue.com/route/clip/v2/resource/`, path);
  let request: coda.FetchRequest = {
    method: "GET",
    url,
    ...options,
    headers: {
      ...options?.headers,
      "hue-application-key": username,
    },
  };
  let response = await context.fetcher.fetch(request);
  let data = response.body;
  let errors = data.errors;
  if (errors?.length) {
    throw new coda.UserVisibleError(errors.map(error => error.description).join("\n"));
  }
  return data.data;
}

function getUsername(endpoint) {
  if (!endpoint) {
    throw new coda.UserVisibleError("Account setup failed. Please sign into your Philips Hue account again.");
  }
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

export function formatAutomation(automation) {
  let {metadata, configuration} = automation;
  return {
    ...automation,
    name: metadata.name,
    start: formatTimePoint(configuration.when_extended.start_at?.time_point),
    end: formatTimePoint(configuration.when_extended.end_at?.time_point),
  };
}

function formatTimePoint(timePoint) {
  if (!timePoint) return undefined;
  let result = {
    ...timePoint,
  };
  switch (timePoint.type) {
    case "time":
      let {hour, minute} = timePoint.time;
      result.time = `${hour}:${minute}`;
      let date = new Date(0);
      date.setHours(hour);
      date.setMinutes(minute);
      result.summary = date.toLocaleTimeString("en", {hour: 'numeric', minute:'2-digit'});
      break;
    case "sunrise":
    case "sunset":
      result.summary = timePoint.type;
      let offset = timePoint.offset?.minutes;
      if (offset) {
        result.offset = offset;
        let modifier = offset > 0 ? "after" : "before";
        result.summary = `${Math.abs(offset)} mins ${modifier} ${timePoint.type}`;
      }
      break;
  }
  return result;
}

export function getTimeParts(context: coda.ExecutionContext, time: Date) {
  let formatter = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone,
    hourCycle: "h24",
    hour: "numeric",
    minute: "numeric",
  });

  // Format the date into individual parts.
  let parts = formatter.formatToParts(time);

  // Find the day, month, and year parts.
  let hour = parts.find(part => part.type === "hour").value;
  let minute = parts.find(part => part.type === "minute").value;

  return { hour: Number(hour), minute: Number(minute) };
}
