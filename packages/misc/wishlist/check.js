// packages/misc/wishlist/check.js
//
// When to read the shop, and what to do with what's in it.
//
// The shop only changes when one of its timers runs out (Daily every 24h;
// New and Sales together, about weekly). Every read stores the exact
// moment of the next refresh (read time + the timer's seconds), so a
// background check is "due" once the clock passes one of those moments -
// no dates or time zones involved. "Every 4/12 hours" adds a regular
// check on top. Never in a match or while spectating, never more than
// once every 2 minutes, and a failed read waits an hour.
//
// After a read: pins the shop marks OWNED are removed (you bought them),
// the rest get "last seen" info, and pins that are for sale are reported
// - by default once per shop refresh ("Remind Me").

import { getItems, updateItems, getState, setState, hasItems } from "./storage.js";
import { fetchShop, parseShop } from "./shop.js";
import { imageUrl, TYPE_INFO } from "./detect.js";
import { matchesPage } from "../../core/page-match.js";

export const FREQ_REFRESH = "After each shop refresh";
export const FREQ_4H = "Every 4 hours";
export const FREQ_12H = "Every 12 hours";
export const FREQ_VISIT = "Only when I visit the shop";
export const FREQUENCIES = [FREQ_REFRESH, FREQ_4H, FREQ_12H, FREQ_VISIT];

export const REMIND_ONCE = "Once per shop refresh";
export const REMIND_ALWAYS = "Every page load";
export const REMINDS = [REMIND_ONCE, REMIND_ALWAYS];

const HOUR = 60 * 60 * 1000;
const INTERVALS = { [FREQ_4H]: 4 * HOUR, [FREQ_12H]: 12 * HOUR };
const MIN_GAP = 2 * 60 * 1000;
const RETRY_AFTER_FAIL = HOUR;
const LOCK_MS = 30 * 1000;
// A refresh time read again within this window is the same refresh
// (timers drift by a second or two between reads).
const SAME_REFRESH = 5 * 60 * 1000;
// Small safety margin so we read after the shop has really rotated.
const AFTER_REFRESH = 60 * 1000;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function noBackgroundHere() {
  return matchesPage(["/Game", { prefix: "/Spectate" }]);
}

export function isDue(freq, now = Date.now(), state = getState()) {
  if (freq === FREQ_VISIT || !hasItems()) return false;
  if (state.checkingUntil && state.checkingUntil > now) return false;
  if (state.retryAt && state.retryAt > now) return false;
  if (!state.lastCheckAt) return true;
  if (now - state.lastCheckAt < MIN_GAP) return false;
  if (!state.nextDailyAt && !state.nextWeeklyAt) return true;
  if (state.nextDailyAt && now >= state.nextDailyAt) return true;
  if (state.nextWeeklyAt && now >= state.nextWeeklyAt) return true;
  const interval = INTERVALS[freq];
  return !!(interval && now - state.lastCheckAt >= interval);
}

function nextAt(prev, seconds, now) {
  if (seconds == null) return null;
  const at = now + seconds * 1000 + AFTER_REFRESH;
  return prev && Math.abs(prev - at) < SAME_REFRESH ? prev : at;
}

// Records a read of the shop and updates the wishlist from it.
// -> { matches: shop items that are pinned and not owned, removed: names, cycles }
export function applyShop(shop, now = Date.now()) {
  const state = getState();
  const nextDailyAt = nextAt(state.nextDailyAt, shop.timers.Daily, now);
  const weeklySecs = [shop.timers.New, shop.timers.Sale].filter((s) => s != null);
  const nextWeeklyAt = nextAt(state.nextWeeklyAt, weeklySecs.length ? Math.min(...weeklySecs) : null, now);
  setState({ lastCheckAt: now, nextDailyAt, nextWeeklyAt, retryAt: 0, checkingUntil: 0 });

  const removed = [];
  const matches = [];
  const pins = getItems();
  if (shop.items.some((i) => pins[i.key])) {
    updateItems((items) => {
      shop.items.forEach((i) => {
        const pin = items[i.key];
        if (!pin) return;
        if (i.owned) {
          removed.push(pin.name || i.name);
          delete items[i.key];
          return;
        }
        if (i.name) pin.name = i.name;
        pin.lastSeen = { section: i.section, cost: i.cost, sale: i.sale, at: now };
        matches.push({ ...i, name: pin.name });
      });
    });
  }
  const cycle = (section) => (section === "Daily" ? `D${nextDailyAt}` : `W${nextWeeklyAt}`);
  return { matches, removed, cycle };
}

function rowsHtml(matches) {
  return matches.map((m) => {
    const wide = m.type === "profile-skin" ? ' class="wz-wl-wide"' : "";
    const price = m.cost != null ? `${m.cost} UCP${m.sale ? ` (-${m.sale}%)` : ""}` : "";
    return `<div class="wz-wl-toast-row"><img src="${esc(imageUrl(m.type, m.file))}"${wide} alt="">`
      + `<span><b>${esc(m.name)}</b> <small>${TYPE_INFO[m.type].label}</small><br>`
      + `<small>${m.section === "Sale" ? "On sale" : m.section}${price ? ` · ${esc(price)}` : ""}</small></span></div>`;
  }).join("");
}

export function goToShop(key) {
  location.href = "/CosmeticsShop" + (key ? `#wz=${encodeURIComponent(key)}` : "");
}

function toast(plugin, opts) {
  if (!plugin || typeof plugin.toast !== "function") return null;
  return plugin.toast({ className: "dismissable", ...opts });
}

export function showMatchesToast(plugin, matches) {
  const n = matches.length;
  return toast(plugin, {
    title: `${n} wishlist item${n === 1 ? "" : "s"} in the Cosmetics Shop!`,
    text: rowsHtml(matches),
    buttons: [{ text: "Take me there!", className: "dismiss", onclick: () => goToShop(matches[0].key) }]
  });
}

export function showRemovedToast(plugin, names) {
  if (!names.length) return null;
  return toast(plugin, {
    title: "Cosmetic Wishlist",
    text: `Removed from your wishlist (you own ${names.length === 1 ? "it" : "them"} now): ${names.map(esc).join(", ")}`
  });
}

export function formatIn(ms) {
  if (!(ms > 0)) return "soon";
  const mins = Math.round(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d ? `${d}d` : "", h ? `${h}h` : "", !d && m ? `${m}m` : ""].filter(Boolean).join(" ") || "under a minute";
}

// Background check on page load. Quiet unless there's something to say.
export async function backgroundCheck(plugin, { freq, remind }) {
  if (noBackgroundHere() || !isDue(freq)) return null;
  const now = Date.now();
  setState({ checkingUntil: now + LOCK_MS });
  let shop;
  try {
    shop = await fetchShop();
  } catch (e) {
    setState({ checkingUntil: 0, retryAt: Date.now() + RETRY_AFTER_FAIL });
    return { error: e };
  }
  const result = applyShop(shop, Date.now());
  showRemovedToast(plugin, result.removed);
  const state = getState();
  const notified = { ...(state.notified || {}) };
  const fresh = remind === REMIND_ALWAYS
    ? result.matches
    : result.matches.filter((m) => notified[m.key] !== result.cycle(m.section));
  result.matches.forEach((m) => { notified[m.key] = result.cycle(m.section); });
  // Forget reminders for things no longer pinned.
  const pins = getItems();
  Object.keys(notified).forEach((k) => { if (!pins[k]) delete notified[k]; });
  setState({ notified });
  if (fresh.length) showMatchesToast(plugin, fresh);
  return { ...result, shown: fresh };
}

// "Check Shop Now": always reads, always reports. -> result or { error }
export async function manualCheck(plugin) {
  let shop;
  try {
    shop = await fetchShop();
  } catch (e) {
    toast(plugin, { title: "Cosmetic Wishlist", text: `Couldn't read the Cosmetics Shop: ${esc(e.message)}` });
    return { error: e };
  }
  const result = applyShop(shop, Date.now());
  showRemovedToast(plugin, result.removed);
  const notified = { ...(getState().notified || {}) };
  result.matches.forEach((m) => { notified[m.key] = result.cycle(m.section); });
  setState({ notified });
  if (result.matches.length) {
    showMatchesToast(plugin, result.matches);
  } else {
    const state = getState();
    toast(plugin, {
      title: "Cosmetic Wishlist",
      text: `Nothing from your wishlist is in the Cosmetics Shop right now.`
        + (state.nextDailyAt ? `<br><small>Next daily refresh in ${formatIn(state.nextDailyAt - Date.now())}.</small>` : "")
    });
  }
  return result;
}

// On the Cosmetics Shop itself: counts as a read (no toast - you're
// looking at it). -> { shop, matches, removed } or null
export function readLiveShop(plugin) {
  let shop;
  try { shop = parseShop(document); } catch (e) { return null; }
  const result = applyShop(shop, Date.now());
  showRemovedToast(plugin, result.removed);
  const notified = { ...(getState().notified || {}) };
  result.matches.forEach((m) => { notified[m.key] = result.cycle(m.section); });
  setState({ notified });
  return { shop, ...result };
}
