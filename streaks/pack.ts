import * as sdk from "@superhuman/plugins-sdk";
import { Settings, DateTime } from "luxon";

export const pack = sdk.newPack();

const DefaultAllowGaps = false;

pack.addFormula({
  name: "Streaks",
  description: "Calculate the streak for each row in a table.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.SparseDateArray,
      name: "dates",
      description: "The dates you have recorded.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.SparseBooleanArray,
      name: "goals",
      description: "If the goal was met for each of the dates.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "allowGaps",
      description: `Whether gaps in the record should be allowed, AKA not break the streak. Default: ${DefaultAllowGaps}`,
      optional: true,
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: {
    type: sdk.ValueType.Number,
  },
  execute: async function (args, context) {
    Settings.defaultZone = context.timezone ?? "America/Los_Angeles";
    let [jsDates, goals, allowGaps = DefaultAllowGaps] = args;
    if (jsDates.length != goals.length) {
      throw new sdk.UserVisibleError("You must pass in the same number of dates and goals.");
    }
    for (let [i, date] of jsDates.entries()) {
      if (!date) {
        delete jsDates[i];
        delete goals[i];
      }
    }

    let entries: Entry[] = jsDates.map((date, i) => {
      return {
        date: DateTime.fromJSDate(date).startOf("day"),
        success: goals[i],
      }
    });
    let sorted = [...entries].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    let min = sorted[0].date;
    let max = sorted[sorted.length - 1].date;

    let map: Record<string, Entry> = entries.reduce((result, entry) => {
      let key = getKey(entry.date);
      if (result[key]) {
        throw new sdk.UserVisibleError(`Duplicate entries found for the date ${key}. Ensure each date is only included once.`);
      }
      result[key] = entry;
      return result;
    }, {});

    let streak = 0;
    let current = min;
    while (current <= max) {
      let key = getKey(current);
      let entry = map[key];
      if (entry) {
        streak = entry.success ? streak + 1 : 0;
        entry.streak = streak;
      } else if (!allowGaps) {
        streak = 0;
      }
      current = current.plus({days: 1});
    }
    return entries.map(entry => entry.streak);
  },
});

function getKey(date: DateTime) {
  return date.toLocaleString(DateTime.DATE_FULL);
}

interface Entry {
  date: DateTime;
  success: boolean;
  streak?: number;
}
