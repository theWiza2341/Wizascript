// packages/usage-stats/common.js
//
// Shared by the Usage Statistics plugin's parts: divisions, souls, seasons,
// the game's own translations, and whether the plugin may do anything at all
// (opted in AND a linked account).

import { getPageWindow } from "../core/page-window.js";
import { isPluginEnabled } from "../core/plugins.js";
import { refreshAccount, linkedAccount, onAccountChange, selfInfo } from "../core/account.js";
import { debugLoggingSetting } from "../core/debug.js";

export const PLUGIN_ID = "usageStats";
export const SOULS = ["DETERMINATION", "BRAVERY", "INTEGRITY", "JUSTICE", "KINDNESS", "PATIENCE", "PERSEVERANCE"];
export const LADDER = ["LEGEND", "ULTIMATE_MASTER", "HIGH_MASTER", "MASTER"];
export const TRUE_HUB_ELO = 1820; // a game counts for True Hub when the Elo BEFORE it is 1820 or more
export const DIV_NAMES = { TOTAL: "Total", LEGEND: "LEGEND", ULTIMATE_MASTER: "Ultimate Master", HIGH_MASTER: "High Master", MASTER: "Master", UNRANKED: "Unranked", TRUEHUB: "True Hub" };
export const minElos = () => {
  const m = getPageWindow().divisionMinElos;
  return m && typeof m === "object" && m.MASTER ? m : { MASTER: 1000, HIGH_MASTER: 1650, ULTIMATE_MASTER: 1800, LEGEND: 2000 };
};

export const log = (...a) => { if (debugLoggingSetting.value()) console.log("[Usage Statistics]", ...a); };

// ---- the game's translations (rendered HTML: soul names in colour, division icons) ----
export function t(key, fallback, ...args) {
  try {
    const $ = getPageWindow().$;
    const v = $ && $.i18n ? $.i18n(key, ...args) : "";
    return v && v !== key ? v : fallback;
  } catch (e) { return fallback; }
}
export const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const soulHtml = (s) => t(`{{SOUL:${s}}}`, `<span class="${esc(s)}">${esc(s)}</span>`);
// Division buttons: the icon (sized down by CSS) and name; Unranked/Total/True Hub as text.
export const divHtml = (d) => (LADDER.includes(d) ? t(`{{DIVISION:${d}}}`, DIV_NAMES[d]) : d === "UNRANKED" ? t("pvp-unranked", "Unranked") : DIV_NAMES[d]);

// ---- seasons: a season is a calendar month (UTC), "2026-11" ----------------------------
export const seasonOf = (t) => new Date(t).toISOString().slice(0, 7);
export const shiftSeason = (s, n) => { const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const seasonLabel = (s) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;

// ---- may the plugin do anything? ------------------------------------------------------
// Opted in (the plugin's toggle) and a linked account. The account is checked
// with the server at most every 30 minutes (cached in GM); a rename found then
// unlinks it (core/account.js).
const ACCOUNT_CACHE = "wizascript.usageStats.account"; // { name, at }
const ACCOUNT_TTL = 30 * 60 * 1000;
export const optedIn = () => isPluginEnabled(PLUGIN_ID);
let checking = null;
export function ensureAccount({ fresh = false } = {}) {
  if (!optedIn()) return Promise.resolve(null);
  if (linkedAccount()) return Promise.resolve(linkedAccount());
  let c = null;
  try { c = JSON.parse(GM_getValue(ACCOUNT_CACHE, "null")); } catch (e) { /* none */ }
  const self = selfInfo();
  // A cached name is only trusted while the same player is logged in (a rename shows as a new name).
  if (!fresh && c && c.name && Date.now() - c.at < ACCOUNT_TTL && (!self.selfName || c.self === self.selfName)) return Promise.resolve(c.name);
  if (!checking) {
    checking = refreshAccount().then((me) => me.account || null, () => (c && c.name) || null).finally(() => { checking = null; });
  }
  return checking;
}
onAccountChange((name) => {
  try { GM_setValue(ACCOUNT_CACHE, JSON.stringify({ name: name || null, at: Date.now(), self: selfInfo().selfName })); } catch (e) { /* no GM */ }
});

// Is this page about the logged-in player (their own Profile/History)? Other
// players' profiles carry their id or name in the address.
export function ownPage() {
  const q = new URLSearchParams(location.search);
  const self = selfInfo();
  if (!self.selfName && !self.selfId) return false;
  for (const [k, v] of q) {
    const key = k.toLowerCase();
    if ((key === "id" || key === "userid" || key === "playerid") && self.selfId && Number(v) !== self.selfId) return false;
    if ((key === "username" || key === "name" || key === "user") && self.selfName && v.toLowerCase() !== self.selfName.toLowerCase()) return false;
  }
  return true;
}
