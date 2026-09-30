// packages/core/backup.js
//
// "Back up settings" / "Restore settings" on the General tab's Wizascript
// section. A backup is everything Wizascript stores, in one code:
//   - every UnderScript setting under underscript.plugin.Wizascript.*
//     (plugin toggles, per-plugin settings, keybinds shown as settings)
//   - every Tampermonkey value under wizascript.* (keybinds, controller
//     bindings/presets, Card Tracker presets + positions, Card Tags,
//     Notepad drawing/position, Patch Maker state, ...)
// Collected by prefix rather than a hand-kept list, so anything a future
// feature stores is included automatically.
//
// Restoring REPLACES Wizascript's data (keys that aren't in the backup
// are removed, so the result matches the backed-up setup exactly) and
// then asks to reload the page, since most features only read their
// settings at page load.

import { SUITE_VERSION } from "./version.js";
import { registerSettingWidget, asButton } from "./setting-widgets.js";
import { encodeCode, decodeCode, showExportDialog, showImportDialog, showConfirmDialog } from "./share-code.js";
import { getPageWindow } from "./page-window.js";

const LS_PREFIX = "underscript.plugin.Wizascript.";
const GM_PREFIX = "wizascript.";
const KIND = "BACKUP";
const CATEGORY = "Wizascript";

// Bookkeeping that describes THIS install, not the player's setup.
const SKIP_GM = new Set(["wizascript.migration.v150", "wizascript.lastSeenVersion"]);
// Display-only rows on the Wizascript section itself.
const SKIP_LS_PREFIXES = ["about.", "backup."];

function isBackedUpLsKey(key) {
  if (!key.startsWith(LS_PREFIX)) return false;
  const rest = key.slice(LS_PREFIX.length);
  return !SKIP_LS_PREFIXES.some((p) => rest.startsWith(p));
}

function isBackedUpGmKey(key) {
  return key.startsWith(GM_PREFIX) && !SKIP_GM.has(key);
}

function listGmKeys() {
  try { return (typeof GM_listValues === "function" ? GM_listValues() : []).filter(isBackedUpGmKey); } catch (e) { return []; }
}

export function collectBackup() {
  const ls = {};
  Object.keys(localStorage).filter(isBackedUpLsKey).forEach((k) => { ls[k.slice(LS_PREFIX.length)] = localStorage.getItem(k); });
  const gm = {};
  listGmKeys().forEach((k) => { gm[k.slice(GM_PREFIX.length)] = GM_getValue(k); });
  return { format: 1, version: SUITE_VERSION, created: new Date().toISOString(), ls, gm };
}

// Human-readable list of what a backup holds, for the confirm dialog.
const FEATURE_LABELS = [
  ["keybinds.", "Keybinds"],
  ["controller.", "Controller bindings"],
  ["decktracker.", "Card Tracker"],
  ["deckTracker.", "Card Tracker"],
  ["misc.cardTags.", "Card Tags"],
  ["misc.notepad.", "Notepad"],
  ["patchmaker.", "Patch Maker"]
];
function describe(backup) {
  const found = new Set();
  Object.keys(backup.gm || {}).forEach((k) => {
    const hit = FEATURE_LABELS.find(([p]) => (GM_PREFIX + k).startsWith(GM_PREFIX + p));
    if (hit) found.add(hit[1]);
  });
  const settings = Object.keys(backup.ls || {}).length;
  const parts = [`${settings} setting${settings === 1 ? "" : "s"}`];
  if (found.size) parts.push(`saved data for ${Array.from(found).join(", ")}`);
  return parts.join(", plus ");
}

function validate(backup) {
  if (!backup || typeof backup !== "object" || backup.format !== 1 || typeof backup.ls !== "object" || typeof backup.gm !== "object") {
    throw new Error("That code isn't a Wizascript backup this version understands.");
  }
  const badLs = Object.entries(backup.ls).find(([, v]) => typeof v !== "string");
  if (badLs) throw new Error("The backup is damaged (a setting has an unexpected value).");
}

export function restoreBackup(backup) {
  validate(backup);
  // Wipe first, so a setting that's default in the backup (and therefore
  // not stored there) doesn't keep this browser's current value.
  Object.keys(localStorage).filter(isBackedUpLsKey).forEach((k) => localStorage.removeItem(k));
  listGmKeys().forEach((k) => GM_deleteValue(k));
  Object.entries(backup.ls).forEach(([k, v]) => localStorage.setItem(LS_PREFIX + k, v));
  Object.entries(backup.gm).forEach(([k, v]) => GM_setValue(GM_PREFIX + k, v));
  // A restored setup is by definition not a fresh/legacy install.
  GM_setValue("wizascript.migration.v150", true);
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "an unknown date" : d.toLocaleString();
}

async function exportBackup() {
  const backup = collectBackup();
  const code = await encodeCode(KIND, backup);
  const day = new Date().toISOString().slice(0, 10);
  showExportDialog({
    title: "Back Up Wizascript Settings",
    intro: `This code holds all your Wizascript settings and saved data (${describe(backup)}). Keep it somewhere safe, then use "Restore" on another browser or after reinstalling.`,
    code,
    fileName: `wizascript-backup-${day}.txt`
  });
}

function importBackup() {
  showImportDialog({
    title: "Restore Wizascript Settings",
    intro: "Paste a Wizascript backup code, or load a saved backup file.",
    actionLabel: "Next",
    onSubmit: async (text) => {
      const backup = await decodeCode(text, KIND);
      validate(backup);
      // Hand off to the confirm step once this dialog has closed.
      setTimeout(() => showConfirmDialog({
        title: "Replace your Wizascript settings?",
        message: [
          `This backup was made with Wizascript v${backup.version || "?"} on ${formatDate(backup.created)} and contains ${describe(backup)}.`,
          "Restoring replaces ALL of your current Wizascript settings and saved data with it. This can't be undone, so back up your current settings first if you might want them."
        ],
        confirmLabel: "Replace settings",
        onConfirm: () => {
          restoreBackup(backup);
          showConfirmDialog({
            title: "Settings restored",
            message: "Reload the page to finish applying them.",
            confirmLabel: "Reload now",
            cancelLabel: "Later",
            danger: false,
            onConfirm: () => getPageWindow().location.reload()
          });
        }
      }), 0);
    }
  });
}

export function registerBackupSection(plugin) {
  const settingsApi = plugin.settings();
  settingsApi.add({
    key: "backup.export",
    name: "Back up settings",
    note: "Save all your Wizascript settings and data as a code or file.",
    type: "text",
    default: "Back up…",
    category: CATEGORY
  });
  registerSettingWidget("backup.export", asButton("Back up…", () => exportBackup().catch((e) => console.error("[Wizascript] backup failed", e))));

  settingsApi.add({
    key: "backup.import",
    name: "Restore settings",
    note: "Replace your Wizascript settings with a saved backup.",
    type: "text",
    default: "Restore…",
    category: CATEGORY
  });
  registerSettingWidget("backup.import", asButton("Restore…", () => importBackup()));
}
