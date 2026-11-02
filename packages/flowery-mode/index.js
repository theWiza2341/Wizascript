// packages/flowery-mode/index.js
//
// Flowery Mode: Flowery's voice lines on cards and moments she cares about.
// The engine is lines.js; the RULES (which clip, when, how rare) are
// flowery/index.json on the repo's `sounds` branch, read here and cached.
// Research and the interaction list: the project's claude/flowery-mode-scoping.md.
//
// Match events come from UnderScript's GameEvent (/Game and Spectate). Site
// moments (chat, the Plant tribe, the home/log out buttons, logging in, the
// Settings window, True Hub Bridge, Card Tracker, account linking) are
// listened for on every page. Audio only; nothing is sent to the game.
//
// Disabled plugin = settings registered and the "turned on" clip hooked
// (it plays when the box is ticked), nothing else.

import { createFeatureSettings } from "../core/settings.js";
import { isPluginEnabled, onPluginToggled } from "../core/plugins.js";
import { matchesPage } from "../core/page-match.js";
import { getPageWindow } from "../core/page-window.js";
import { isDebugLogging } from "../core/debug.js";
import { onAccountLinked } from "../core/account.js";
import {
  FREQUENCIES, DEFAULT_FREQUENCY, EVERY_TIME, frequency, compileRules, clipName, createReactor
} from "./lines.js";

const TAB = "Flowery Mode";
const BRANCH = "https://raw.githubusercontent.com/theWiza2341/Wizascript/sounds/flowery/";
const RULES_KEY = "wizascript.floweryMode.rules";        // { at, index }
const EVERY_KEY = "wizascript.floweryMode.everyTime";    // the on-screen testing toggle
const LOGIN_KEY = "wizascript.floweryMode.loginPending"; // sessionStorage
const REFRESH_MS = 15 * 60 * 1000;
const PAGE_QUIET_MS = 3000; // chat history arrives on load: don't react to it

let settings = null;
let compiled = { rules: [], all: [] };
let rulesState = "none"; // none | cached | fresh | failed
let chip = null;
let lastPlayed = "";

function setting(key, fallback) {
  try { return settings ? settings.value(key) : fallback; } catch (e) { return fallback; }
}
function log(...args) {
  if (isDebugLogging()) console.log("[Wizascript Flowery Mode]", ...args);
}
const everyTime = () => GM_getValue(EVERY_KEY, false) === true;

// ---- rules: the sounds branch's index.json, cached in GM ----------------------------
function useIndex(index, state) {
  compiled = compileRules(index);
  rulesState = state;
  log(`rules ${state}: ${compiled.rules.length} rules, ${compiled.all.length} clips`);
  drawChip();
}
function loadRules({ force = false } = {}) {
  let cached = null;
  try { cached = JSON.parse(GM_getValue(RULES_KEY, "null")); } catch (e) { cached = null; }
  if (cached && cached.index && rulesState === "none") useIndex(cached.index, "cached");
  if (!force && cached && Date.now() - cached.at < REFRESH_MS) return Promise.resolve(compiled);
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: BRANCH + "index.json?t=" + Math.floor(Date.now() / 60000),
      timeout: 15000,
      onload: (r) => {
        try {
          if (r.status !== 200) throw new Error("HTTP " + r.status);
          const index = JSON.parse(r.responseText);
          GM_setValue(RULES_KEY, JSON.stringify({ at: Date.now(), index }));
          useIndex(index, "fresh");
        } catch (e) {
          log("couldn't read the rules:", e.message);
          if (rulesState === "none") { rulesState = "failed"; drawChip(); }
        }
        resolve(compiled);
      },
      onerror: () => { if (rulesState === "none") { rulesState = "failed"; drawChip(); } resolve(compiled); },
      ontimeout: () => { if (rulesState === "none") { rulesState = "failed"; drawChip(); } resolve(compiled); }
    });
  });
}

// ---- playing -----------------------------------------------------------------------
// The game's own volume for sound effects (its Settings → sounds), 0..1.
function effectsVolume() {
  try {
    const off = localStorage.getItem("gameSoundsDisabled");
    if (off === "true" || off === "1") return 0;
    const v = parseFloat(localStorage.getItem("gameSoundsVolume"));
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
  } catch (e) { /* storage blocked */ }
  return 0.5;
}
const GAME_CLIP_MS = 1600; // the game's lines don't say how long they are
export function clipMs(clip) {
  return clip.kind === "file" && clip.seconds ? Math.round(clip.seconds * 1000) : GAME_CLIP_MS;
}
function playOnce(clip) {
  const pw = getPageWindow();
  const vol = effectsVolume();
  if (vol <= 0) return "muted";
  try {
    if (clip.kind === "game") {
      // The game's own path first (game.js playSound → UCAudio → /sounds/<name>.wav).
      if (typeof pw.playSound === "function") { pw.playSound(clip.name); return "game"; }
      if (pw.UCAudio && typeof pw.UCAudio.playSound === "function") { pw.UCAudio.playSound(clip.name, vol); return "UCAudio"; }
      const a = new Audio("/sounds/" + clip.name + ".wav");
      a.volume = vol;
      a.play().catch(() => {});
      return "file";
    }
    const a = new Audio(BRANCH + encodeURIComponent(clip.file));
    a.volume = vol;
    a.play().catch((e) => log("couldn't play", clip.file, e && e.message));
    return "branch";
  } catch (e) {
    log("couldn't play", clipName(clip), e);
    return null;
  }
}
// Plays a clip `times` times in a row; returns how long that takes (ms).
export function playClip(clip, times = 1) {
  const gap = clipMs(clip) + 60;
  let via = null;
  for (let i = 0; i < times; i++) {
    if (i === 0) via = playOnce(clip);
    else setTimeout(() => playOnce(clip), i * gap);
  }
  lastPlayed = clipTitle(clip) + (times > 1 ? ` ×${times}` : "");
  log("played", clipName(clip), times > 1 ? `×${times}` : "", via ? `(${via})` : "(failed)");
  drawChip();
  return times * gap;
}
function clipTitle(clip) {
  if (clip.kind === "game") return clip.name;
  return clip.file.replace(/^Flowery_voiceclip_/i, "").replace(/\.wav$/i, "").replace(/_/g, " ");
}

// ---- the on-screen testing toggle ------------------------------------------------------
function drawChip() {
  if (!chip) return;
  const on = everyTime();
  const note = rulesState === "failed" ? " · rules didn't load" : rulesState === "none" ? " · loading rules…" : "";
  chip.innerHTML = `<b>🌼 Flowery: ${on ? "every time" : "normal odds"}</b>${note}`
    + (lastPlayed ? `<div style="opacity:.8">last: ${lastPlayed.replace(/[<>&]/g, "")}</div>` : "");
  chip.style.borderColor = on ? "#ffd23f" : "#666";
}
function showChip() {
  if (chip || !document.body) return;
  chip = document.createElement("div");
  chip.className = "wz-flowery-chip";
  chip.title = "Flowery Mode testing toggle: click to switch between every time and normal odds.";
  chip.style.cssText = "position:fixed;left:8px;bottom:48px;z-index:2147482500;background:#000d;color:#eee;"
    + "font:12px/1.35 sans-serif;padding:4px 8px;border:1px solid #666;border-radius:4px;cursor:pointer;user-select:none;max-width:260px";
  chip.addEventListener("click", () => { GM_setValue(EVERY_KEY, !everyTime()); drawChip(); });
  document.body.appendChild(chip);
  drawChip();
}

// ---- settings ------------------------------------------------------------------------
function freqNow() {
  return everyTime() && setting("testToggle", true) ? EVERY_TIME : frequency(setting("frequency", DEFAULT_FREQUENCY));
}

export function initFloweryMode(plugin) {
  settings = createFeatureSettings(plugin, "floweryMode", {
    tab: TAB,
    visible: () => isPluginEnabled("floweryMode")
  });
  settings.add("frequency", {
    name: "Frequency",
    note: "How often Flowery speaks up. Normal is about 1-2 lines a match.",
    type: "select",
    options: FREQUENCIES.map((f) => f.label),
    default: DEFAULT_FREQUENCY
  });
  settings.add("opponent", { name: "Opponent's Cards", note: "Also react to your opponent's cards.", type: "boolean", default: true });
  settings.add("spectate", { name: "While Spectating", note: "React in matches you're watching too.", type: "boolean", default: true });
  settings.add("endLines", { name: "Win/Loss Lines", note: "Flowery reacts when your match ends.", type: "boolean", default: true });
  settings.add("glueEvery", { name: "Every :Glue:", note: "Say \"glue\" for every Glue emote, every time.", type: "boolean", default: false });
  settings.add("testToggle", {
    name: "Testing Toggle",
    note: "Show an on-screen switch that makes every line play every time.",
    type: "boolean",
    default: true, // dev builds; off before release
    onChange: (v) => { if (v) showChip(); else if (chip) { chip.remove(); chip = null; } }
  });

  const pw = getPageWindow();
  const spectating = matchesPage({ prefix: "/Spectate" });
  const reactor = createReactor({
    rules: () => compiled,
    play: (clip, times) => playClip(clip, times),
    isOwn: (id) => id != null && String(id) === String(pw.userId),
    settings: () => ({
      frequency: freqNow(),
      opponent: !!setting("opponent", true),
      endLines: !!setting("endLines", true),
      spectating
    })
  });

  // Ticking the box plays the "turned on" clip (even before the refresh that starts the rest).
  onPluginToggled("floweryMode", (on) => {
    if (!on) return;
    loadRules().then(() => reactor.onWizascript("floweryModeEnabled"));
  });

  if (!isPluginEnabled("floweryMode")) return;
  loadRules();
  const startedAt = Date.now();
  const wiz = (event) => (rulesState === "none" ? loadRules() : Promise.resolve()).then(() => reactor.onWizascript(event));

  // ---- matches ----
  const inMatch = matchesPage("/Game") || spectating;
  if (inMatch && (!spectating || setting("spectate", true))) {
    plugin.events.on("GameStart", () => reactor.reset());
    plugin.events.on("GameEvent", (data) => {
      try {
        reactor.onEvent(data);
        if (data && data.action === "getEmote" && /glue/i.test(JSON.stringify(data))) glue(1);
      } catch (e) { log("event error", e); }
    });
  }

  // ---- :Glue: in chat (any room, private chats too) ----
  function glue(count) {
    if (setting("glueEvery", false)) {
      const hit = compiled.rules.find((m) => m.rule.on === "wizascript" && m.rule.event === "chatGlue");
      if (hit && hit.clip.kind !== "random") playClip(hit.clip, Math.min(count, 10));
      return;
    }
    wiz("chatGlue");
  }
  plugin.events.on("ChatMessage", (data) => {
    if (!data || !/^get(Private)?Message$/.test(data.action) || Date.now() - startedAt < PAGE_QUIET_MS) return;
    let msg = data.chatMessage;
    if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch (e) { msg = null; } }
    const html = msg && typeof msg.message === "string" ? msg.message : "";
    const count = (html.match(/emotes\/Glue\.png/gi) || []).length;
    if (count) glue(count);
  });

  // ---- the Settings window ----
  plugin.events.on("Settings:open", () => wiz("settingsOpened"));

  // ---- account linked (not just a page load that knows it) ----
  onAccountLinked(() => wiz("accountLinked"));

  // ---- clicks around the site ----
  // Home and Log out: if a line plays, the page waits for it before going.
  const navEvent = (a) => {
    const href = a.getAttribute("href");
    if (href === "/" && a.querySelector(".glyphicon-home")) return "homeButton";
    if (href === "Disconnect" || href === "/Disconnect") return "logout";
    return null;
  };
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const t = e.target;
    const a = t && t.closest && t.closest("a[href]");
    const ev = a && a.target !== "_blank" ? navEvent(a) : null;
    if (ev) {
      if (rulesState === "none" || rulesState === "failed") return;
      const clip = reactor.onWizascript(ev);
      if (clip) {
        e.preventDefault();
        const to = a.href;
        setTimeout(() => { location.href = to; }, Math.min(3000, clipMs(clip) + 150));
      }
      return;
    }
    // True Hub Bridge: a deck's show/load button, in True Hub mode.
    const show = t && t.closest && t.closest("#hubDecks .show-button");
    const sw = document.getElementById("truehub-switch");
    if (show && sw && /classic/i.test(sw.textContent)) wiz("thbDeckLoad");
  }, true);

  // Logging in: remember the submit; the page after it plays the line.
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (f && f.querySelector && f.querySelector("input[type=password]")) {
      try { sessionStorage.setItem(LOGIN_KEY, String(Date.now())); } catch (err) { /* ignore */ }
    }
  }, true);
  try {
    const pending = Number(sessionStorage.getItem(LOGIN_KEY));
    if (pending) {
      sessionStorage.removeItem(LOGIN_KEY);
      if (Date.now() - pending < 60000 && sessionStorage.getItem("UserID")) wiz("login");
    }
  } catch (e) { /* ignore */ }

  // The Plant tribe's member list (right-click the tribe icon).
  document.addEventListener("contextmenu", (e) => {
    const img = e.target && e.target.closest && e.target.closest("img.tribe");
    if (img && /tribes\/PLANT\.png/i.test(img.getAttribute("src") || "")) wiz("plantTribe");
  }, true);

  // A Card Tracker counter showing Flowery: left or right click (not a drag).
  let down = null;
  const floweryTracker = (t) => {
    const w = t && t.closest && t.closest(".dt-tracker-widget");
    return w && [...w.querySelectorAll("img")].some((i) => /\/Flowery\.png$/i.test(i.getAttribute("src") || "")) ? w : null;
  };
  document.addEventListener("mousedown", (e) => { down = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener("click", (e) => {
    if (e.button === 0 && floweryTracker(e.target) && down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 6) wiz("floweryTracker");
  }, true);
  document.addEventListener("contextmenu", (e) => { if (floweryTracker(e.target)) wiz("floweryTracker"); }, true);

  // True Hub Bridge's deck search: "skt" … "sktima" (once per typing of it).
  let sktArmed = true;
  document.addEventListener("input", (e) => {
    if (!e.target || e.target.id !== "th-search") return;
    const v = String(e.target.value || "").trim().toLowerCase();
    const hit = v.length >= 3 && "sktima".startsWith(v);
    if (hit && sktArmed) { sktArmed = false; wiz("thbSktima"); }
    if (!hit) sktArmed = true;
  }, true);

  // The testing toggle.
  if (setting("testToggle", true)) {
    if (document.body) showChip();
    else document.addEventListener("DOMContentLoaded", showChip, { once: true });
  }
  log("on", spectating ? "(spectating)" : "");
}
