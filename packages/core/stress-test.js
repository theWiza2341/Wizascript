// packages/core/stress-test.js
//
// DEVELOPMENT ONLY. Adds N do-nothing "plugins", each with a toggle in the
// Plugins list and its own settings tab, to stress-test the tab row's
// paging arrows (core/tab-bar.js). Only compiled into a build made with
//   WIZASCRIPT_STRESS_TABS=12 node build.js
// A normal `node build.js` defines the count as 0, so esbuild strips this
// out of the released script entirely.

import { createFeatureSettings } from "./settings.js";

// Deliberately mixed lengths, to exercise the width calculations.
const NAMES = [
  "Alpha", "Bravo Test Plugin", "Charlie", "Delta Extended Name",
  "Echo", "Foxtrot Plugin", "Golf", "Hotel California Test",
  "India", "Juliet Long Tab Name", "Kilo", "Lima Bean Tracker",
  "Mike", "November Rain", "Oscar", "Papa Longlegs"
];

export function registerStressTabs(plugin, count) {
  const settingsApi = plugin.settings();
  for (let i = 0; i < count; i++) {
    const name = `[Test] ${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${i + 1}` : ""}`;
    const key = `stresstest.${i + 1}`;
    const toggle = settingsApi.add({
      key: `${key}.enabled`,
      name,
      note: "Stress-test placeholder. Does nothing.",
      type: "boolean",
      default: true, // on, so the tabs show up without ticking 12 boxes
      category: "Plugins"
    });
    const tab = createFeatureSettings(plugin, key, { tab: name, visible: () => !!toggle.value() });
    tab.add("placeholder", {
      name: `Placeholder setting for ${name}`,
      type: "boolean",
      default: false
    });
  }
}
