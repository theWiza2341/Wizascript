// packages/core/about.js
//
// The "Wizascript" section at the bottom of the main settings tab
// (version + changelog), plus the one-time popup shown after a fresh
// install or an update.
//
// The changelog text is CHANGELOG.md from the repo root, baked into the
// bundle at build time (esbuild's text loader - see build.js), so the
// installed script always carries the notes for exactly its own version
// with no network request.

import changelogMarkdown from "../../CHANGELOG.md";
import { SUITE_VERSION } from "./version.js";
import { getPageWindow } from "./page-window.js";
import { registerSettingWidget, asButton, asInfo } from "./setting-widgets.js";

const LAST_SEEN_KEY = "wizascript.lastSeenVersion";
const CATEGORY = "Wizascript";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToHtml(md) {
  const lib = getPageWindow().underscript && getPageWindow().underscript.lib;
  if (lib && lib.showdown && lib.showdown.Converter) {
    return new lib.showdown.Converter({ noHeaderId: true, strikethrough: true }).makeHtml(md);
  }
  return `<pre style="white-space:pre-wrap">${escapeHtml(md)}</pre>`;
}

export function openChangelog() {
  const BootstrapDialog = getPageWindow().BootstrapDialog;
  const html = markdownToHtml(changelogMarkdown);
  if (!BootstrapDialog || typeof BootstrapDialog.show !== "function") {
    console.warn("[Wizascript] BootstrapDialog unavailable - cannot show the changelog here.");
    return;
  }
  BootstrapDialog.show({
    title: "Wizascript Changelog",
    message: `<div class="wizascript-changelog">${html}</div>`,
    cssClass: "mono",
    buttons: [{ label: "Close", cssClass: "btn-primary", action: (d) => d.close() }]
  });
}

export function registerAboutSection(plugin) {
  const settingsApi = plugin.settings();

  settingsApi.add({
    key: "about.version",
    name: "Version",
    type: "text",
    default: SUITE_VERSION,
    category: CATEGORY
  });
  registerSettingWidget("about.version", asInfo(SUITE_VERSION));

  settingsApi.add({
    key: "about.changelog",
    name: "Changelog",
    note: "See what's changed in each Wizascript update.",
    type: "text",
    default: "View",
    category: CATEGORY
  });
  registerSettingWidget("about.changelog", asButton("View", () => openChangelog()));
}

// installState: "fresh" | "upgrade" | "done" (from runMigrations()).
export function showWhatsNew(plugin, installState) {
  const lastSeen = GM_getValue(LAST_SEEN_KEY, null);
  if (lastSeen === SUITE_VERSION) return;

  const markSeen = () => GM_setValue(LAST_SEEN_KEY, SUITE_VERSION);
  const isFresh = installState === "fresh";

  const toast = isFresh
    ? {
      title: "Welcome to Wizascript!",
      text: "Wizascript's features start switched off. Turn on the ones you want in the Plugins list.",
      buttons: [{ text: "Open Wizascript settings", className: "dismiss", onclick: () => plugin.settings().open() }]
    }
    : {
      title: `Wizascript updated to v${SUITE_VERSION}`,
      text: "See what's new in this version.",
      buttons: [{ text: "View changelog", className: "dismiss", onclick: () => openChangelog() }]
    };

  plugin.toast({
    ...toast,
    className: "dismissable",
    onClose: () => { markSeen(); }
  });
}
