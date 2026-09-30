// packages/core/plugins.js
//
// The Wizascript "Plugins" list: one enable toggle per feature, shown on
// the main Wizascript settings tab. Everything else in the suite hangs
// off these toggles - a feature's own settings tab, its keyboard
// keybinds, and its controller bindings are all hidden unless the
// feature is enabled here.
//
// The toggles deliberately REUSE each feature's pre-1.5.0 enable key
// (e.g. patchmaker.enabled, misc.enableCardTags), so anyone upgrading
// keeps whatever they already had switched on or off. See
// runMigrations() for the one case that needs help.
//
// `note` is the hover tooltip in the settings list - keep it at or under
// 75 characters so it stays a one-liner.

export const PLUGINS = [
  {
    id: "patchMaker",
    name: "Patch Maker",
    key: "patchmaker.enabled",
    note: "Write your own patch notes on the Patch Notes page.",
    usesKeybinds: true,
    legacyDefaultOn: true
  },
  {
    id: "trueHub",
    name: "True Hub Bridge",
    key: "truehubbridge.enabled",
    note: "Browse a larger library of community decks on the Hub page.",
    legacyDefaultOn: true
  },
  {
    id: "cardTracker",
    name: "Card Tracker",
    key: "decktracker.enabled",
    note: "Add click-to-count card counters to your screen during matches.",
    legacyDefaultOn: true
  },
  {
    id: "ucTv",
    name: "UC TV",
    key: "ucTv.enabled",
    note: "Channel-surf other players' live matches while spectating.",
    usesKeybinds: true,
    legacyDefaultOn: true
  },
  {
    id: "notepad",
    name: "Notepad",
    key: "misc.enableNotepad",
    note: "A small drawing notepad you can keep on screen anywhere.",
    usesKeybinds: true
  },
  {
    id: "cardTags",
    name: "Card Tags",
    key: "misc.enableCardTags",
    note: "Right-click cards in Crafting/Decks to tag and search them."
  },
  {
    id: "controller",
    name: "Controller Support",
    key: "misc.enableController",
    note: "Play and navigate Undercards with a gamepad."
  }
];

const LS_PREFIX = "underscript.plugin.Wizascript.";
const MIGRATION_FLAG = "wizascript.migration.v150";

const toggles = {}; // plugin id -> UnderScript setting object

export function registerPluginToggles(plugin) {
  const settingsApi = plugin.settings();
  PLUGINS.forEach((p) => {
    toggles[p.id] = settingsApi.add({
      key: p.key,
      name: p.name,
      note: p.note,
      type: "boolean",
      default: false,
      // Appends UnderScript's own "requires a page refresh" note.
      refresh: true,
      category: "Plugins"
    });
  });
}

export function getPluginToggle(id) {
  return toggles[id];
}

// Safe to call before registerPluginToggles() - falls back to reading
// the stored value directly.
export function isPluginEnabled(id) {
  const toggle = toggles[id];
  if (toggle) return !!toggle.value();
  const p = PLUGINS.find((x) => x.id === id);
  if (!p) return false;
  const raw = localStorage.getItem(LS_PREFIX + p.key);
  return raw === "1" || raw === "true";
}

export function anyKeybindPluginEnabled() {
  return PLUGINS.some((p) => p.usesKeybinds && isPluginEnabled(p.id));
}

// Maps the `packageLabel` strings used by keybind / controller
// registrations to plugin ids.
const LABEL_TO_PLUGIN = {
  "Patch Maker": "patchMaker",
  "UC TV": "ucTv",
  "Notepad": "notepad",
  "Card Tracker": "cardTracker"
};

export function pluginIdForLabel(label) {
  return LABEL_TO_PLUGIN[label] || null;
}

// Before 1.5.0, Patch Maker / True Hub Bridge / Deck Tracker / UC TV were
// ON by default, and UnderScript only stores a boolean once it's been
// changed - so an existing user who never touched those toggles has no
// stored value at all. 1.5.0 flips every default to OFF (a fresh install
// starts with an empty settings page), which would silently switch
// those features off for them.
//
// So, once: if this browser shows ANY sign of a previous Wizascript
// install, write an explicit "on" for each previously-default-on plugin
// that has no stored value. Returns "fresh" | "upgrade" | "done".
export function runMigrations() {
  if (GM_getValue(MIGRATION_FLAG, false)) return "done";

  let existing = false;
  try {
    existing = Object.keys(localStorage).some((k) => k.startsWith(LS_PREFIX));
  } catch (e) { /* storage blocked - treat as fresh */ }
  if (!existing && typeof GM_listValues === "function") {
    try {
      existing = GM_listValues().some((k) => k.startsWith("wizascript.") && k !== MIGRATION_FLAG);
    } catch (e) { /* ignore */ }
  }

  if (existing) {
    PLUGINS.forEach((p) => {
      if (!p.legacyDefaultOn) return;
      if (localStorage.getItem(LS_PREFIX + p.key) === null) {
        localStorage.setItem(LS_PREFIX + p.key, "1");
      }
    });
  }

  GM_setValue(MIGRATION_FLAG, true);
  return existing ? "upgrade" : "fresh";
}
