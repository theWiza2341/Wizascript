// packages/core/debug.js
//
// One "Debug logging" switch (General tab, Wizascript section) for the
// whole suite, replacing the per-plugin toggles Patch Maker, True Hub
// Bridge, Card Tracker and UC TV each had before 1.5.0. Those plugins
// read it through `debugLoggingSetting.value()`, the same shape their
// old setting objects had.
//
// Controller Support's "Enable Debug Text" is deliberately separate: it
// draws an on-screen readout rather than logging to the console.

const LS_PREFIX = "underscript.plugin.Wizascript.";
const KEY = "debugLogging";
const OLD_KEYS = ["patchmaker.debugLogging", "truehubbridge.debugLogging", "decktracker.debugLogging", "ucTv.debugLogs"];

let setting = null;

const isOn = (v) => v === "1" || v === "true";

// Anyone who had ANY old per-plugin toggle on keeps debug logging on.
// The old keys are then removed, so they can't switch it back on later.
function carryOverOldToggles() {
  const hadOne = OLD_KEYS.some((k) => isOn(localStorage.getItem(LS_PREFIX + k)));
  if (hadOne && localStorage.getItem(LS_PREFIX + KEY) === null) localStorage.setItem(LS_PREFIX + KEY, "1");
  OLD_KEYS.forEach((k) => localStorage.removeItem(LS_PREFIX + k));
}

export function registerDebugSetting(plugin) {
  carryOverOldToggles();
  setting = plugin.settings().add({
    key: KEY,
    name: "Debug logging",
    note: "Print extra details to the browser console, for bug reports.",
    type: "boolean",
    default: false,
    category: "Wizascript"
  });
}

export function isDebugLogging() {
  if (setting) return !!setting.value();
  return isOn(localStorage.getItem(LS_PREFIX + KEY));
}

// Drop-in for the old per-plugin setting objects.
export const debugLoggingSetting = { value: () => isDebugLogging() };
