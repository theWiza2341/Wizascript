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
//
// 1.7.4 (Worker 1.8+): links also carry the account's Undercards id (selfId), so
// a renamed account (same id, new name) unlinks itself instead of being taken
// for an alt; and a linked install can make a one-time code (WZL-XXXX-XXXX,
// 10 minutes) to link another device (a phone) without typing in void there.

import { registerSettingWidget, asButton } from "./setting-widgets.js";
import { getPageWindow } from "./page-window.js";
import { canOpenVoid, openVoid } from "./uc-report.js";

// ---- which server ------------------------------------------------------------------
// The Worker's address is read from server.json on the repo's `sounds` branch
// ({ "worker": "https://….workers.dev" }), cached in GM for 30 minutes, with the
// built-in address as the fallback. Tampermonkey only lets the script reach hosts
// listed EXACTLY in `@connect` (build.js): `@connect workers.dev` does NOT cover
// subdomains, because workers.dev is on the Public Suffix List (1.7.0's bug). So
// server.json can only choose among WORKER_HOSTS; a new host needs an update that
// adds it here AND to build.js's @connect lines (170-server-test checks they match).
// The `sounds` branch is only ever edited by the maintainer; the Worker rewrites `gallery`.
export const DEFAULT_WORKER = "https://wizascript-gallery.thewiza2341.workers.dev";
export const WORKER_HOSTS = ["wizascript-gallery.thewiza2341.workers.dev"];
const SERVER_FILE = "https://raw.githubusercontent.com/theWiza2341/Wizascript/sounds/server.json";
const SERVER_KEY = "wizascript.account.server"; // GM: { at, url }
const SERVER_TTL = 30 * 60 * 1000;
const WORKER_RE = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.workers\.dev$/i;
export const isWorkerUrl = (u) => {
  if (typeof u !== "string") return false;
  const v = u.replace(/\/+$/, "");
  return WORKER_RE.test(v) && WORKER_HOSTS.includes(v.slice("https://".length).toLowerCase());
};
function cachedServer() {
  try { const c = JSON.parse(GM_getValue(SERVER_KEY, "null")); return c && isWorkerUrl(c.url) ? c : null; } catch (e) { return null; }
}
let worker = (cachedServer() || {}).url || DEFAULT_WORKER;
export const workerUrl = () => worker;
let checking = null;
function fetchServer() {
  return new Promise((resolve) => {
    const keep = () => resolve(worker);
    try {
      GM_xmlhttpRequest({
        method: "GET",
        url: SERVER_FILE + "?t=" + Math.floor(Date.now() / 60000),
        timeout: 6000,
        onload: (r) => {
          try {
            const u = r.status === 200 ? String(JSON.parse(r.responseText).worker || "").replace(/\/+$/, "") : "";
            if (isWorkerUrl(u)) { worker = u; GM_setValue(SERVER_KEY, JSON.stringify({ at: Date.now(), url: u })); }
          } catch (e) { /* keep the current one */ }
          keep();
        },
        onerror: keep,
        ontimeout: keep
      });
    } catch (e) { keep(); }
  });
}
// Resolves to the server's address. Blocks only the very first time (no cache),
// at most ~6 s; a stale cache is used at once and refreshed in the background.
export function server() {
  const c = cachedServer();
  if (c && Date.now() - c.at < SERVER_TTL) return Promise.resolve(c.url);
  if (!checking) checking = fetchServer().finally(() => { checking = null; });
  return c ? Promise.resolve(c.url) : checking;
}
// A request to the server by path ("/v1/totals").
export const call = (method, path, opts) => server().then((base) => request(method, base + path, opts));
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
    making = call("POST", "/v1/install").then((a) => {
      GM_setValue(AUTH_KEY, JSON.stringify({ install: a.install, secret: a.secret }));
      auth = a;
      return a;
    }).finally(() => { making = null; });
  }
  return making;
}
// A server that no longer knows this install (e.g. its database was reset):
// start over with a new one.
export async function authed(method, path, body, extra = {}) {
  const a = await getAuth();
  try {
    return await call(method, path, { body, auth: a, ...extra });
  } catch (e) {
    if (e.code === "bad_install" || e.code === "no_install") {
      GM_deleteValue(AUTH_KEY);
      auth = null;
      return call(method, path, { body, auth: await getAuth(), ...extra });
    }
    throw e;
  }
}

// ---- endpoints --------------------------------------------------------------------

// Who's logged in on this page (chat.js globals, on every page with chat).
export function selfInfo() {
  const w = getPageWindow();
  const id = Number(w.selfId);
  return { selfId: Number.isInteger(id) && id > 0 ? id : null, selfName: typeof w.selfUsername === "string" && w.selfUsername ? w.selfUsername : null };
}
export const getMe = () => authed("GET", "/v1/me");
export const linkStart = () => authed("POST", "/v1/link/start");
export const linkCheck = () => authed("POST", "/v1/link/check", selfInfo());
// A device code also carries this device's gallery key (review / judging), if
// it has one: the Card Gallery's key box (gallery/keybox.js) says where the key
// lives (get) and how to keep one that arrives (put -> { name, role }).
let keyBridge = { get: () => "", put: async () => null };
export const setGalleryKeyBridge = (b) => { keyBridge = { ...keyBridge, ...b }; };
export const galleryKeyHere = () => { try { return keyBridge.get() || ""; } catch (e) { return ""; } };
// withKey: carry this device's key. A key the server no longer accepts is left
// out (r.keyDropped) rather than stopping the code.
export async function linkShare(withKey = true) {
  const k = withKey ? galleryKeyHere() : "";
  if (!k) return authed("POST", "/v1/link/share");
  try { return await authed("POST", "/v1/link/share", undefined, { adminKey: k }); } catch (e) {
    if (e.code !== "not_admin" && e.code !== "key_expired") throw e;
    const r = await authed("POST", "/v1/link/share");
    return { ...r, keyDropped: true };
  }
}
export const unlinkAccount = () => authed("POST", "/v1/link/unlink");
// Device codes: WZL-XXXX-XXXX (case, spaces and dashes don't matter).
export const isDeviceCode = (raw) => /^\s*wzl[\s-]*[0-9a-z]{4}[\s-]*[0-9a-z]{4}\s*$/i.test(String(raw || ""));
// Links this install with a code made on a linked device. Resolves to
// { account, key } (key: { name, role } of a gallery key that came with it);
// rejects with a short reason for the player.
export async function redeemDeviceCode(raw) {
  let r;
  try { r = await authed("POST", "/v1/link/redeem", { code: String(raw || "").trim(), ...selfInfo() }); } catch (e) {
    const why = {
      bad_code: "That code isn't valid. Codes work once.",
      code_expired: "That code has expired. Make a new one on your linked device.",
      wrong_account: e.message,
      cooldown: "This install switched accounts less than a day ago. Try again later.",
      rate_limited: "Too many wrong codes. Try again in an hour."
    }[e && e.code];
    throw new Error(why || (e && e.message) || "Couldn't reach the Wizascript server.");
  }
  accountChanged(r.account, r.cooldownUntil, true);
  // A gallery key that came with the code is kept like a redeemed one.
  let key = null;
  if (r.galleryKey) { try { key = await keyBridge.put(r.galleryKey); } catch (e) { key = null; } }
  return { account: r.account, key };
}

// ---- who's linked, shared by everything that shows it ---------------------------
const state = { name: null, cooldownUntil: null, known: false };
const listeners = [];
export const linkedAccount = () => state.name;
export const onAccountChange = (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };
// Only when the player has just linked (a link check succeeded), not when a page
// load finds an existing link. Flowery Mode reacts to it.
const linkListeners = [];
export const onAccountLinked = (fn) => { linkListeners.push(fn); };
// Call with what the server said (getMe / linkCheck): updates everyone showing it.
export function accountChanged(name, cooldownUntil, justLinked = false) {
  const was = state.name;
  state.name = name || null;
  state.cooldownUntil = cooldownUntil || null;
  state.known = true;
  if (was !== state.name) listeners.slice().forEach((f) => { try { f(state.name); } catch (e) { /* a listener's problem */ } });
  if (justLinked && state.name) linkListeners.slice().forEach((f) => { try { f(state.name); } catch (e) { /* a listener's problem */ } });
}
// A rename: the server knows the linked account's id, and the player logged in
// with that id now has another name. Links are by name, so this one ends; the
// player links again under the new name (their voter group carries over).
let renameNoticed = false;
export async function refreshAccount() {
  const me = await getMe();
  const self = selfInfo();
  if (me.account && me.ucId && self.selfId === me.ucId && self.selfName && self.selfName !== me.account) {
    await unlinkAccount().catch(() => null);
    accountChanged(null, null);
    if (!renameNoticed) {
      renameNoticed = true;
      toast(mainPlugin, "Wizascript", `Your account was linked as ${me.account}, and it's ${self.selfName} now, so it was unlinked. Link it again on the Wizascript tab (Undercards Account).`);
    }
    return { ...me, account: null };
  }
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
        accountChanged(r.account, r.cooldownUntil, true);
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
let mainPlugin = null;
const label = () => (state.name ? `Linked as ${state.name}` : "Link my account");

function toast(plugin, title, text) {
  try { plugin.toast({ title, text, className: "dismissable" }); } catch (e) { console.log(`[Wizascript] ${title}: ${text}`); }
}

// "Link another device": a one-time code shown with a countdown. Returns the box.
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export function deviceCodeBox(el, { onClose } = {}) {
  const box = el("div", { className: "wz-acct-device" });
  const status = el("p", { className: "wz-acct-status" });
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; };
  const make = async () => {
    stop();
    box.replaceChildren(el("p", { textContent: "Making a code…" }));
    let r;
    try { r = await linkShare(); } catch (e) {
      box.replaceChildren(el("p", { textContent: e.code === "rate_limited" ? (e.message || "Too many codes. Try again later.") : (e.message || "Couldn't reach the Wizascript server."), style: "color:#f77" }));
      return;
    }
    const code = el("code", { textContent: r.code, style: "user-select:all;font-size:20px;letter-spacing:2px;padding:2px 10px;background:#000;border:1px solid #666" });
    const left = el("span", {});
    const again = el("button", { type: "button", className: "btn btn-sm btn-default", textContent: "New code" });
    again.addEventListener("click", make);
    const tick = () => {
      const ms = r.expiresAt - Date.now();
      if (!box.isConnected) return stop();
      if (ms <= 0) { stop(); left.textContent = "Expired."; code.style.opacity = ".35"; return; }
      left.textContent = `Expires in ${fmtLeft(ms)}. Works once.`;
    };
    timer = setInterval(tick, 1000);
    tick();
    box.replaceChildren(
      el("p", {}, code),
      r.carries ? el("p", { textContent: `It also brings your gallery key (${r.carries.name}, ${r.carries.role}) to that device.` }) : null,
      r.keyDropped ? el("p", { textContent: "Your gallery key isn't valid anymore, so the code doesn't bring it.", style: "color:#f77" }) : null,
      el("p", {}, left, " ", again),
      el("p", { textContent: "On the other device, while logged in as this account: Wizascript tab → Undercards Account, or the 📱 button at the bottom left of the Card Gallery (Card Maker, or the gallery website) → Redeem a code." }),
      status);
  };
  make();
  if (onClose) onClose(stop);
  return box;
}

// "Have a code?": links this install with a device code.
function codeEntry(el, onLinked) {
  const input = el("input", { type: "text", className: "form-control", placeholder: "WZL-XXXX-XXXX", autocomplete: "off", spellcheck: false, style: "display:inline-block;width:170px;text-transform:uppercase" });
  const go = el("button", { type: "button", className: "btn btn-sm btn-default", textContent: "Link with code" });
  const status = el("small", { style: "display:block;margin-top:4px" });
  let busy = false;
  const submit = async () => {
    if (busy) return;
    if (!isDeviceCode(input.value)) { status.textContent = "Codes look like WZL-XXXX-XXXX."; status.style.color = "#f77"; return; }
    busy = true; go.disabled = true; status.textContent = "Checking…"; status.style.color = "#7f7";
    try { const r = await redeemDeviceCode(input.value); onLinked(r.account, r.key); } catch (e) { status.textContent = e.message; status.style.color = "#f77"; }
    busy = false; go.disabled = false;
  };
  go.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  return el("div", {}, el("p", { textContent: "Linked on another device? Make a code there (Link another device) and enter it here:" }), el("p", {}, input, " ", go, status));
}

function openAccountDialog(plugin) {
  const BD = getPageWindow().BootstrapDialog;
  if (!BD || typeof BD.show !== "function") return;
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.forEach((k) => k && n.append(k)); return n; };
  const wrap = el("div", { className: "wz-acct-dialog" });
  const status = el("p", { className: "wz-acct-status" });
  const show = (text, ok) => { status.textContent = text; status.style.color = ok ? "#7f7" : "#f77"; };
  let code = null;
  let sharing = false;
  let stopShare = () => {};
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
      const dev = el("button", { type: "button", className: "btn btn-sm btn-primary", textContent: sharing ? "Hide code" : "Link another device" });
      dev.addEventListener("click", () => { sharing = !sharing; stopShare(); draw(); });
      wrap.append(
        el("p", {}, "Linked as ", el("b", { textContent: state.name }), "."),
        el("p", { textContent: "Features that need your account (like posting to the Card Gallery) use this one." }),
        el("p", {}, sw, " ", el("small", { textContent: "An install can switch accounts once a day." })),
        el("p", {}, dev, " ", el("small", { textContent: "A one-time code for a phone or another browser." })),
        ...(sharing ? [deviceCodeBox(el, { onClose: (stop) => { stopShare = stop; } })] : []),
        status);
      return;
    }
    if (!code) {
      const go = el("button", { type: "button", className: "btn btn-sm btn-success", textContent: "Link my account" });
      go.addEventListener("click", startLink);
      wrap.append(
        el("p", { textContent: "Some features need to know which Undercards account you're on, like posting and voting in the Card Gallery." }),
        el("p", { textContent: "You link once: Wizascript types a one-time line into void (chat room 0), and you press Enter to send it." }),
        el("p", {}, go),
        codeEntry(el, (name, key) => { draw(); show(`Linked as ${name}.${key ? ` Your gallery key came too (${key.name}, ${key.role}).` : ""}`, true); }),
        status);
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
        if (r.linked) { accountChanged(r.account, r.cooldownUntil, true); code = null; draw(); show(`Linked as ${r.account}.`, true); }
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
  BD.show({ title: "Undercards Account", message: wrap, onhidden: () => stopShare(), buttons: [{ label: "Close", action: (d) => d.close() }] });
}

export function registerAccountSetting(plugin) {
  mainPlugin = plugin;
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
