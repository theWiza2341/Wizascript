// packages/core/account.js
//
// The player's Undercards account, for any Wizascript feature that needs to
// know who they are (the Card Gallery first). It talks to the Wizascript
// server (the wizascript-gallery Cloudflare Worker; design in
// claude/card-gallery-backend.md).
//
// This copy of Wizascript gets its own credentials ({ install, secret }) on
// first use, kept in GM storage (not readable by the page, never in backups).
// The player links them to their account once by sending a one-time line in
// void (room 0): Wizascript types it in and they press Enter (the mods' OK,
// 2026-10-08; nothing is ever sent for them). That's on the Wizascript tab
// ("Undercards Account") and in the Card Maker's gallery.

import { registerSettingWidget, asButton } from "./setting-widgets.js";
import { getPageWindow } from "./page-window.js";
import { canOpenVoid, openVoid } from "./uc-report.js";

export const WORKER = "https://wizascript-gallery.redstonewiza2341.workers.dev";
// The key keeps its Card Maker name so existing links carry on.
const AUTH_KEY = "wizascript.cardMaker.galleryAuth";
const CATEGORY = "Wizascript";

export class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}

export function request(method, url, { body, auth, adminKey } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (auth) { headers["X-WZ-Install"] = auth.install; headers["X-WZ-Secret"] = auth.secret; }
    if (adminKey) headers["X-WZ-Admin"] = adminKey;
    const done = (status, text) => {
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
      if (status >= 200 && status < 300) return resolve(data);
      if (status === 404 && !data) return resolve(null);
      reject(new ApiError(status, (data && data.error) || "http", (data && data.message) || `The gallery server answered ${status}.`, data));
    };
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({
        method, url, headers,
        data: body ? JSON.stringify(body) : undefined,
        timeout: 30000,
        onload: (r) => done(r.status, r.responseText),
        onerror: () => reject(new ApiError(0, "network", "Couldn't reach the gallery server.")),
        ontimeout: () => reject(new ApiError(0, "timeout", "The gallery server took too long to answer."))
      });
      return;
    }
    fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
      .then(async (r) => done(r.status, await r.text()), () => reject(new ApiError(0, "network", "Couldn't reach the gallery server.")));
  });
}

// ---- this install ---------------------------------------------------------------

function loadAuth() {
  try { const a = JSON.parse(GM_getValue(AUTH_KEY, "null")); return a && a.install && a.secret ? a : null; } catch (e) { return null; }
}
let auth = null;
let making = null;
async function getAuth() {
  if (auth) return auth;
  auth = loadAuth();
  if (auth) return auth;
  if (!making) {
    making = request("POST", `${WORKER}/v1/install`).then((a) => {
      GM_setValue(AUTH_KEY, JSON.stringify({ install: a.install, secret: a.secret }));
      auth = a;
      return a;
    }).finally(() => { making = null; });
  }
  return making;
}
// A server that no longer knows this install (e.g. its database was reset):
// start over with a new one.
export async function authed(method, path, body) {
  const a = await getAuth();
  try {
    return await request(method, WORKER + path, { body, auth: a });
  } catch (e) {
    if (e.code === "bad_install" || e.code === "no_install") {
      GM_deleteValue(AUTH_KEY);
      auth = null;
      return request(method, WORKER + path, { body, auth: await getAuth() });
    }
    throw e;
  }
}

// ---- endpoints --------------------------------------------------------------------

export const getMe = () => authed("GET", "/v1/me");
export const linkStart = () => authed("POST", "/v1/link/start");
export const linkCheck = () => authed("POST", "/v1/link/check");

// ---- who's linked, shared by everything that shows it ---------------------------
const state = { name: null, cooldownUntil: null, known: false };
const listeners = [];
export const linkedAccount = () => state.name;
export const onAccountChange = (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };
// Call with what the server said (getMe / linkCheck): updates everyone showing it.
export function accountChanged(name, cooldownUntil) {
  const was = state.name;
  state.name = name || null;
  state.cooldownUntil = cooldownUntil || null;
  state.known = true;
  if (was !== state.name) listeners.slice().forEach((f) => { try { f(state.name); } catch (e) { /* a listener's problem */ } });
}
export async function refreshAccount() {
  const me = await getMe();
  accountChanged(me.account, me.cooldownUntil);
  return me;
}

// ---- linking ------------------------------------------------------------------------
// Starts a link; after the line is typed into void, checks for it every few
// seconds for a while, so the player doesn't have to come back and press
// anything. onDone({ account } | { error }).
let watching = null;
export function watchForLink(onDone, { every = 5000, forMs = 180000 } = {}) {
  if (watching) clearInterval(watching.timer);
  const until = Date.now() + forMs;
  const w = { timer: null, busy: false };
  watching = w;
  const tick = async () => {
    if (w.busy) return;
    if (Date.now() > until) { clearInterval(w.timer); if (watching === w) watching = null; return onDone({ error: "timeout" }); }
    w.busy = true;
    try {
      const r = await linkCheck();
      if (r && r.linked) {
        clearInterval(w.timer); if (watching === w) watching = null;
        accountChanged(r.account, r.cooldownUntil);
        onDone({ account: r.account });
      }
    } catch (e) {
      if (e.code === "cooldown" || e.code === "code_expired" || e.code === "bad_install") {
        clearInterval(w.timer); if (watching === w) watching = null;
        onDone({ error: e.code, e });
      }
    } finally { w.busy = false; }
  };
  w.timer = setInterval(tick, every);
  setTimeout(tick, Math.min(every, 2500));
}

// ---- the Wizascript tab: "Undercards Account" ------------------------------------------
let button = null;
const label = () => (state.name ? `Linked as ${state.name}` : "Link my account");

function toast(plugin, title, text) {
  try { plugin.toast({ title, text, className: "dismissable" }); } catch (e) { console.log(`[Wizascript] ${title}: ${text}`); }
}

function openAccountDialog(plugin) {
  const BD = getPageWindow().BootstrapDialog;
  if (!BD || typeof BD.show !== "function") return;
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.forEach((k) => k && n.append(k)); return n; };
  const wrap = el("div", { className: "wz-acct-dialog" });
  const status = el("p", { className: "wz-acct-status" });
  const show = (text, ok) => { status.textContent = text; status.style.color = ok ? "#7f7" : "#f77"; };
  let code = null;
  const startLink = async () => {
    show("Getting a link code…", true);
    try { code = await linkStart(); show("", true); } catch (e) { show(e.message || "Couldn't reach the Wizascript server.", false); }
    draw();
  };
  function draw() {
    wrap.replaceChildren();
    if (state.name && !code) {
      const sw = el("button", { type: "button", className: "btn btn-sm btn-default", textContent: "Switch account" });
      sw.addEventListener("click", startLink);
      wrap.append(
        el("p", {}, "Linked as ", el("b", { textContent: state.name }), "."),
        el("p", { textContent: "Features that need your account (like posting to the Card Gallery) use this one." }),
        el("p", {}, sw, " ", el("small", { textContent: "An install can switch accounts once a day." })), status);
      return;
    }
    if (!code) {
      const go = el("button", { type: "button", className: "btn btn-sm btn-success", textContent: "Link my account" });
      go.addEventListener("click", startLink);
      wrap.append(
        el("p", { textContent: "Some features need to know which Undercards account you're on, like posting and voting in the Card Gallery." }),
        el("p", { textContent: "You link once: Wizascript types a one-time line into void (chat room 0), and you press Enter to send it." }),
        el("p", {}, go), status);
      return;
    }
    const line = el("code", { textContent: code.line, style: "user-select:all;padding:1px 6px;background:#000;border:1px solid #666" });
    const open = el("button", { type: "button", className: "btn btn-sm btn-success", textContent: "Open void with it typed in" });
    open.disabled = !canOpenVoid();
    open.addEventListener("click", () => {
      // closes this dialog and the settings, so the chat box is free
      watchForLink((r) => {
        if (r.account) toast(plugin, "Wizascript", `Linked as ${r.account}.`);
        else if (r.error === "cooldown") toast(plugin, "Wizascript", "This install switched accounts less than a day ago. Try again later.");
        else if (r.error === "code_expired") toast(plugin, "Wizascript", "That link code expired. Press Link my account again.");
        else toast(plugin, "Wizascript", "Your account isn't linked yet: the line wasn't seen in void. Open Undercards Account on the Wizascript tab to check again.");
      });
      openVoid(code.line);
    });
    const check = el("button", { type: "button", className: "btn btn-sm btn-default", textContent: "Check now" });
    check.addEventListener("click", async () => {
      show("Looking for your line in void…", true);
      try {
        const r = await linkCheck();
        if (r.linked) { accountChanged(r.account, r.cooldownUntil); code = null; draw(); show(`Linked as ${r.account}.`, true); }
        else show(r.message || "Not seen yet. Send the line in void, then check again.", false);
      } catch (e) { show(e.message || "Couldn't check.", false); }
    });
    wrap.append(
      el("p", {}, "1. Send this line in void (chat room 0) from the account to link: ", line),
      el("p", {}, open, canOpenVoid() ? null : el("small", { textContent: " (no chat on this page: open the settings on a page with chat, like Home)" })),
      el("p", { textContent: "2. Press Enter in the chat. Wizascript spots it by itself and tells you when you're linked (or press Check now)." }),
      el("p", {}, check), status);
  }
  draw();
  BD.show({ title: "Undercards Account", message: wrap, buttons: [{ label: "Close", action: (d) => d.close() }] });
}

export function registerAccountSetting(plugin) {
  const settingsApi = plugin.settings();
  settingsApi.add({
    key: "about.account",
    name: "Undercards Account",
    note: "Link Wizascript to your Undercards account, for features that need it (like the Card Gallery).",
    type: "text",
    default: "Link my account",
    category: CATEGORY
  });
  registerSettingWidget("about.account", (el) => {
    button = el;
    asButton(label, () => openAccountDialog(plugin))(el);
    if (!state.known) refreshAccount().catch(() => null);
  });
  onAccountChange(() => { if (button && button.isConnected) button.value = label(); });
}
