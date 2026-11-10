// packages/usage-stats/index.js
//
// Usage Statistics (1.8.0): an OPT-IN plugin. While it's on and Wizascript is
// linked to your Undercards account, each of your PvP games (never CPU) is sent
// to the Wizascript server: your soul, result, division and Elo before/after,
// the opponent's name and soul (for your History only), and your own starting
// deck and artifacts. In return:
//  - Profile: your season stats split by division and True Hub, earlier seasons,
//    and an Elo Graph (profile.js);
//  - History: every PvP game this season, not just the last 20 (history.js);
//  - the 📊 footer button: which cards, artifacts and souls everyone who opted
//    in plays, by time range and division (usage.js). No one's deck is shown.
//
//   common.js    divisions, souls, seasons, account check
//   api.js       the server: game queue, own games, statistics, opt-out
//   recorder.js  records games on /Game (connect + the end message)
//
// The mods approved it as an opt-in (2026-11-09). Nothing is sent before the
// player confirms it, and nothing at all without a linked account.
// Design: claude/usage-stats-scoping.md, claude/pvp-stats-scoping.md, claude/worker-1.8.md.

import { createFeatureSettings } from "../core/settings.js";
import { isPluginEnabled, onPluginToggled, getPluginToggle } from "../core/plugins.js";
import { registerSettingWidget, asButton } from "../core/setting-widgets.js";
import { getPageWindow } from "../core/page-window.js";
import { matchesPage } from "../core/page-match.js";
import { linkedAccount } from "../core/account.js";
import { PLUGIN_ID, ensureAccount, ownPage, log } from "./common.js";
import { flush, optOut, clearLocal, queued } from "./api.js";
import { startRecorder } from "./recorder.js";
import { startProfile } from "./profile.js";
import { startHistory } from "./history.js";
import { addUsageButton } from "./usage.js";

let graphSetting = null;
let wheelSetting = null;

function dialog(title, html, buttons) {
  const BD = getPageWindow().BootstrapDialog;
  if (!BD || typeof BD.show !== "function") return false;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  BD.show({ title, message: wrap, closable: false, buttons });
  return true;
}

// Turning the plugin on asks once more: it sends data.
let undoing = false;
function confirmOptIn() {
  const toggle = getPluginToggle(PLUGIN_ID);
  const undo = () => {
    undoing = true;
    try { if (toggle) toggle.set(false); } finally { setTimeout(() => { undoing = false; }, 0); }
    const box = document.getElementById(`underscript.plugin.Wizascript.${"usageStats.enabled"}`);
    if (box) box.checked = false;
  };
  const linked = linkedAccount();
  const shown = dialog("Usage Statistics: opt in?", `
    <p>While this is on, <b>each of your PvP games</b> is sent to the Wizascript server: your soul, the result, your division and Elo, your opponent's name and soul (kept for your History until the season ends), and <b>your starting deck and artifacts</b>.</p>
    <p>Everyone's games together make the Usage Statistics (which cards, artifacts and souls are played). <b>No one can see your deck</b>: only totals are shown, and today's ranked numbers leave out anything fewer than 3 players used.</p>
    <p>You also get your stats per division and an Elo Graph on your Profile, and every game this season on your History page.</p>
    <p>${linked ? `Games are sent under your linked account, <b>${linked}</b>.` : "<b>It needs your Undercards account linked</b> (Wizascript tab → Undercards Account). Until then it does nothing."}</p>
    <p>Turning it off later can delete everything you've sent.</p>`, [
    { label: "Cancel", action: (d) => { undo(); d.close(); } },
    { label: "Opt in", cssClass: "btn-success", action: (d) => d.close() }
  ]);
  if (!shown && !window.confirm("Usage Statistics sends each of your PvP games, including your starting deck, to the Wizascript server. Opt in?")) undo();
}

// Turning it off offers to delete what was sent.
function offerDelete(fromButton = false) {
  const run = async (d) => {
    d.close();
    try {
      if (!(await ensureAccount({ fresh: true }))) { clearLocal(); toastMsg("No linked account, so there was nothing on the server to delete. Local copies are cleared."); return; }
      const n = await optOut();
      toastMsg(`Deleted ${n} game${n === 1 ? "" : "s"} from the Wizascript server.`);
    } catch (e) { toastMsg(`Couldn't delete: ${e.message || "the Wizascript server didn't answer"}. Try again with Delete My Data.`); }
  };
  dialog(fromButton ? "Delete my data?" : "Usage Statistics: off", `
    <p>${fromButton ? "This deletes every game you've sent" : "Nothing more will be sent. Do you also want to delete every game you've sent"} (all seasons, including your Profile and History extras) from the Wizascript server?</p>
    <p>Totals already published stay as they were until they're rebuilt; your games no longer count after that.</p>`, [
    { label: fromButton ? "Cancel" : "Keep them", action: (d) => d.close() },
    { label: "Delete my data", cssClass: "btn-danger", action: run }
  ]);
}
let plugin = null;
const toastMsg = (text) => { try { plugin.toast({ title: "Usage Statistics", text, className: "dismissable" }); } catch (e) { console.log(`[Usage Statistics] ${text}`); } };

export function initUsageStats(p) {
  plugin = p;
  const settings = createFeatureSettings(plugin, "usageStats", {
    tab: "Usage Statistics",
    visible: () => isPluginEnabled(PLUGIN_ID)
  });
  graphSetting = settings.add("eloGraph", {
    name: "Elo Graph Button",
    note: "Shows the Elo Graph button on your Profile page.",
    type: "boolean",
    default: true
  });
  wheelSetting = settings.add("historyWheel", {
    name: "History: Scroll Wheel Pages",
    note: "Scroll the mouse wheel over your History to turn its pages.",
    type: "boolean",
    default: true
  });
  settings.add("deleteData", {
    name: "Delete My Data",
    note: "Deletes every game you've sent from the Wizascript server.",
    type: "text",
    default: "Delete My Data"
  });
  registerSettingWidget("usageStats.deleteData", (el) => asButton(() => "Delete My Data", () => offerDelete(true))(el));
  onPluginToggled(PLUGIN_ID, (on) => { if (undoing) return; if (on) confirmOptIn(); else offerDelete(false); });

  if (!isPluginEnabled(PLUGIN_ID)) return;

  // The recorder listens from the start (the match begins before the server
  // answers), but only keeps a game when the account is linked.
  const onGame = matchesPage("/Game");
  if (onGame) startRecorder(plugin);

  ensureAccount().then((name) => {
    if (!name) { log("no linked account: Usage Statistics does nothing"); return; }
    if (queued().length) flush();
    if (onGame) return;
    if (matchesPage("/Profile") && ownPage()) startProfile({ showGraph: () => !graphSetting || !!graphSetting.value() });
    if (matchesPage("/History") && ownPage()) startHistory({ wheelPaging: () => !wheelSetting || !!wheelSetting.value() });
    if (!addUsageButton()) {
      const watch = new MutationObserver(() => { if (addUsageButton()) watch.disconnect(); });
      watch.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => watch.disconnect(), 10000);
    }
  });
}
