// packages/card-maker/index.js
//
// Card Maker (1.7.0): the community card editors on undercards.net, in a
// floating window that moves and resizes like Tier List Maker's, so chat
// stays usable while you make cards. The Pack button in the footer (left
// of Friends) or the Toggle Card Maker shortcut shows/hides it.
//
//   editors.js  which editors, their sites
//   window.js   the window: move, resize, fill screen, shrink, saved place
//   styles.js   CSS
//   storage.js  GM storage (window, hotfix)
//   frame.js    runs INSIDE feildmaster's editor (its own bundle, see
//               build.js): reports whether the editor drew, and applies
//               the hotfix when it's on
//
// Each editor is the real site, loaded in a frame from its own server
// with its author's permission; nothing here reads or changes what
// players make in it. Both editors save as you go (UC Editor every
// second, feildmaster's on each change and when its page closes), so:
//   - _ (shrink) keeps the editor loaded, ready to carry on;
//   - x (close) and switching editors unload it, after a moment for that
//     last save, so nothing keeps running in the background.
// Browsers keep a framed site's saves separate from the same site opened
// on its own, so cards made here stay here.
//
// Layer: just under Undercards' chat windows, so chat stays usable even
// with the Card Maker filling the screen, and above everything else on
// the page (see syncLayer).
//
// Disabled plugin = settings registered (so they exist), nothing else.

import { createFeatureSettings } from "../core/settings.js";
import { isPluginEnabled } from "../core/plugins.js";
import { registerKeybind } from "../core/keybinds.js";
import { debugLoggingSetting } from "../core/debug.js";
import { injectCardMakerStyle } from "./styles.js";
import { buildWindow } from "./window.js";
import { EDITORS, EDITOR_LABELS, DEFAULT_EDITOR, editorForLabel, FRAME_MESSAGE } from "./editors.js";
import { isHotfixOn, setHotfix } from "./storage.js";
import { buildGalleryPanel } from "./gallery/panel.js";
import { mountGalleryNav } from "./gallery/nav.js";
import PACK_ICON from "../../assets/pack.png";

// No word from Wizascript inside feildmaster's editor this long after it
// loads: Wizascript isn't running there, so offer the editor's own site.
const NO_REPORT_MS = 15000;
// UC Editor saves once a second: wait that long before unloading an
// editor. Navigating it away first also gives feildmaster's its
// "page closing" save.
const SAVE_GRACE_MS = 1200;
const UNLOAD_MS = 400;

let settings = null;
let editorSetting = null;
let hotfixSetting = null;
let gallerySetting = null;
let wheelSetting = null;
let reviewerSetting = null;
let mounted = null; // { controller, win, frames, ... } | null - built on each open
let footerButton = null;

const log = (...a) => { if (debugLoggingSetting.value()) console.log("[Card Maker]", ...a); };

function currentEditor() {
  return editorForLabel(editorSetting ? editorSetting.value() : EDITORS[DEFAULT_EDITOR].label);
}

export function isCardMakerOpen() {
  return !!mounted;
}

export function toggleCardMaker() {
  if (!isPluginEnabled("cardMaker")) return;
  if (mounted) hideCardMaker();
  else showCardMaker();
}

// Gives an editor frame time for its last save, then unloads it.
function unloadFrame(el, then) {
  setTimeout(() => {
    try { el.src = "about:blank"; } catch (e) { /* already gone */ }
    setTimeout(() => { el.remove(); if (then) then(); }, UNLOAD_MS);
  }, SAVE_GRACE_MS);
}

export function hideCardMaker() {
  if (!mounted) return;
  const closing = mounted;
  mounted = null;
  if (closing.gallery) closing.gallery.flush(); // queued votes go now
  // Gone from the screen at once; the editor unloads a moment later.
  closing.win.root.style.display = "none";
  Object.values(closing.frames).forEach((f) => clearTimeout(f.noReport));
  const frames = Object.values(closing.frames).map((f) => f.el);
  const finish = () => { closing.controller.abort(); closing.win.root.remove(); };
  if (!frames.length) finish();
  else frames.forEach((el, i) => unloadFrame(el, i === frames.length - 1 ? finish : null));
  updateFooterButton();
}

export function showCardMaker() {
  if (mounted) return;
  mount();
  showEditor(currentEditor());
  updateFooterButton();
}

// ---- layer ---------------------------------------------------------------------------
// Undercards' chat windows are `.chat-box`es. The Card Maker takes the
// layer of the lowest one and sits just before it in the page, so every
// chat window draws on top of it (same layer, later in the page) while
// everything else with a lower layer stays underneath. With no chat on
// the page it keeps its own high layer (styles.js).
function chatLayer() {
  let best = null;
  document.querySelectorAll(".chat-box").forEach((box) => {
    // The layer that counts is the outermost one on the way up to <body>
    // (the chat window's own, or a container's); "top" is its <body> child.
    let layer = null;
    let top = box;
    for (let el = box; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.display === "none") return;
      const z = parseInt(style.zIndex, 10);
      if (style.position !== "static" && Number.isFinite(z)) layer = z;
      top = el;
    }
    if (top.parentElement !== document.body || top.classList.contains("wz-cm") || layer === null) return;
    if (!best || layer < best.z || (layer === best.z && (best.el.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_PRECEDING))) best = { el: top, z: layer };
  });
  return best;
}

let lastLayerLog = "";
function placeUnderChat(root) {
  const chat = chatLayer();
  if (chat) {
    root.style.setProperty("--wz-cm-z", String(chat.z));
    if (root.nextElementSibling !== chat.el) document.body.insertBefore(root, chat.el);
  } else {
    root.style.removeProperty("--wz-cm-z");
    if (root.parentElement !== document.body) document.body.appendChild(root);
  }
  const line = chat ? `under chat (layer ${chat.z})` : "no chat window found: own layer";
  if (line !== lastLayerLog) { lastLayerLog = line; log(line); }
}

// ---- the window --------------------------------------------------------------------
function mount() {
  injectCardMakerStyle();
  const controller = new AbortController();
  const { signal } = controller;
  const win = buildWindow({
    signal,
    icon: PACK_ICON,
    editors: EDITORS,
    onPick: (key) => {
      // The title bar's picker and the setting on the tab are the same choice.
      if (editorSetting && editorSetting.value() !== EDITORS[key].label) editorSetting.set(EDITORS[key].label);
      showEditor(key);
    },
    onAction: (action) => {
      const key = currentEditor();
      if (action === "close") hideCardMaker();
      else if (action === "minimised") { if (mounted && mounted.gallery) mounted.gallery.flush(); }
      else if (action === "reload") reloadEditor(key);
      else if (action === "site") window.open(EDITORS[key].url, "_blank", "noopener");
    }
  });
  document.body.appendChild(win.root);

  // Card Gallery: a Gallery button in the title bar and its panel over the
  // editor (gallery/panel.js). Off with the Card Gallery setting.
  let gallery = null;
  if (!gallerySetting || gallerySetting.value()) {
    gallery = buildGalleryPanel({
      requestRead: () => {
        const key = currentEditor();
        const f = mounted && mounted.frames[key];
        if (!f) return "Open an editor first.";
        if (f.status === "loading") return "The editor is still loading.";
        f.el.contentWindow.postMessage({ tag: FRAME_MESSAGE, type: "read" }, EDITORS[key].origin);
        return null;
      },
      editorLabel: (key) => EDITORS[key || currentEditor()].label,
      wheelPages: () => !wheelSetting || !!wheelSetting.value(),
      reviewerKey: () => String((reviewerSetting && reviewerSetting.value()) || "").trim()
    });
    win.body.appendChild(gallery.el);
    mountGalleryNav({ win, gallery });
    gallery.opened();
  }

  // Step behind anything UnderScript opens on top of the page (same as
  // Tier List Maker): Bootstrap dialogs (z 1050) and the Esc menu
  // (.menu-backdrop, z 1010, created the first time it opens). And keep
  // under chat as chat windows open, close or come to the front.
  let menuBackdrop = null;
  const layerWatch = new MutationObserver(() => syncLayer());
  function syncLayer() {
    if (!menuBackdrop) {
      menuBackdrop = document.querySelector(".menu-backdrop");
      if (menuBackdrop) layerWatch.observe(menuBackdrop, { attributes: true, attributeFilter: ["style"] });
    }
    const dialogOpen = document.body.classList.contains("modal-open") || !!document.querySelector(".bootstrap-dialog.in, .modal.in");
    const menuOpen = !!menuBackdrop && menuBackdrop.style.display === "block";
    win.root.classList.toggle("wz-cm-under-modal", dialogOpen || menuOpen);
    placeUnderChat(win.root);
  }
  layerWatch.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true });
  // A click can bring a chat window to the front (a new layer).
  document.addEventListener("pointerdown", () => setTimeout(syncLayer, 0), { capture: true, signal });
  signal.addEventListener("abort", () => layerWatch.disconnect());

  // Messages from Wizascript inside the editors (frame.js): whether
  // feildmaster's editor drew, and the cards for the Card Gallery.
  window.addEventListener("message", (e) => {
    if (!mounted || !e.data || e.data.tag !== FRAME_MESSAGE) return;
    const key = Object.keys(mounted.frames).find((k) => mounted.frames[k].el.contentWindow === e.source);
    if (!key || e.origin !== EDITORS[key].origin) return;
    const f = mounted.frames[key];
    if (e.data.type === "cards") {
      log(`${EDITORS[key].label}: read ${(e.data.groups || []).length} group(s) for the gallery`);
      if (gallery) gallery.receiveCards({ ...e.data, source: key });
      return;
    }
    if (!e.data.status) return;
    clearTimeout(f.noReport);
    f.status = e.data.status;
    log(`${EDITORS[key].label}: ${e.data.status}${e.data.hotfixed ? " (hotfix applied)" : ""}`);
    updateNote();
  }, { signal });

  mounted = { controller, win, frames: {}, syncLayer, gallery };
  syncLayer();
}

// One editor loaded at a time: switching unloads the other (after its last save).
function showEditor(key) {
  const { win, frames } = mounted;
  win.pick.value = key;
  Object.keys(frames).forEach((k) => {
    if (k === key) return;
    clearTimeout(frames[k].noReport);
    frames[k].el.style.display = "none";
    unloadFrame(frames[k].el);
    delete frames[k];
  });
  if (!frames[key]) {
    const el = document.createElement("iframe");
    el.title = EDITORS[key].label;
    el.allow = "clipboard-read; clipboard-write";
    frames[key] = { el, status: "loading", noReport: null };
    win.body.insertBefore(el, win.loading);
    loadEditor(key);
  }
  updateNote();
}

function loadEditor(key) {
  const f = mounted.frames[key];
  const { win } = mounted;
  const started = performance.now();
  f.status = "loading";
  clearTimeout(f.noReport);
  win.loading.textContent = `Loading ${EDITORS[key].label}…`;
  win.loading.style.display = "";
  f.el.onload = () => {
    if (!mounted || mounted.frames[key] !== f) return;
    if (f.status === "loading") f.status = key === "feildmaster" ? "waiting" : "ok";
    win.loading.style.display = "none";
    log(`${EDITORS[key].label} loaded in ${Math.round(performance.now() - started)} ms`);
    if (key === "feildmaster") {
      f.noReport = setTimeout(() => {
        if (f.status === "waiting") { f.status = "silent"; updateNote(); }
      }, NO_REPORT_MS);
    }
    updateNote();
  };
  f.el.src = EDITORS[key].url;
}

function reloadEditor(key) {
  if (mounted && mounted.frames[key]) loadEditor(key);
  updateNote();
}

// The note across the top of the window when feildmaster's editor didn't
// draw: offers the hotfix (or, with it on already, the editor's own site).
function updateNote() {
  if (!mounted) return;
  const { note } = mounted.win;
  const key = currentEditor();
  const f = mounted.frames[key];
  const status = f ? f.status : "";
  note.replaceChildren();
  note.hidden = true;
  if (key !== "feildmaster" || !["broken", "silent"].includes(status)) return;

  const text = document.createElement("span");
  const button = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wz-cm-btn";
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  };
  const site = button("Open its site ↗", () => window.open(EDITORS[key].url, "_blank", "noopener"));
  if (status === "silent") {
    text.textContent = "If the editor stays black, open it on its own site instead.";
    note.append(text, site);
  } else if (!isHotfixOn()) {
    text.textContent = "Trouble loading? feildmaster's editor can't start inside the Card Maker yet. The hotfix lets it.";
    note.append(text, button("Turn on the hotfix", () => setHotfixEverywhere(true)), site);
  } else {
    text.textContent = "feildmaster's editor still didn't start, even with the hotfix.";
    note.append(text, site, button("Turn off the hotfix", () => setHotfixEverywhere(false)));
  }
  note.hidden = false;
}

// The setting on the tab and the GM copy frame.js reads always agree.
function setHotfixEverywhere(on) {
  setHotfix(on);
  if (hotfixSetting && hotfixSetting.value() !== on) hotfixSetting.set(on);
  if (mounted && mounted.frames.feildmaster) reloadEditor("feildmaster");
}

// ---- the footer button ---------------------------------------------------------------
function updateFooterButton() {
  if (!footerButton) return;
  footerButton.querySelector("a").setAttribute("aria-pressed", String(isCardMakerOpen()));
}

function addFooterButton() {
  const friends = document.querySelector("a span.nbFriends");
  const item = friends && friends.closest("li");
  if (!item) return false;
  injectCardMakerStyle();
  footerButton = document.createElement("li");
  footerButton.id = "wz-cardmaker-btn";
  const a = document.createElement("a");
  a.href = "#";
  a.title = "Card Maker";
  a.setAttribute("aria-label", "Card Maker");
  a.setAttribute("role", "button");
  a.setAttribute("aria-pressed", "false");
  const img = document.createElement("img");
  img.src = PACK_ICON;
  img.alt = "";
  a.appendChild(img);
  a.addEventListener("click", (e) => { e.preventDefault(); toggleCardMaker(); });
  footerButton.appendChild(a);
  item.parentNode.insertBefore(footerButton, item);
  return true;
}

// ---- settings ----------------------------------------------------------------------------
export function initCardMaker(plugin) {
  settings = createFeatureSettings(plugin, "cardMaker", {
    tab: "Card Maker",
    visible: () => isPluginEnabled("cardMaker")
  });
  editorSetting = settings.add("editor", {
    name: "Card Editor",
    note: "Which community card editor the Card Maker shows.",
    type: "select",
    options: EDITOR_LABELS,
    default: EDITORS[DEFAULT_EDITOR].label,
    onChange: () => { if (mounted) showEditor(currentEditor()); }
  });
  hotfixSetting = settings.add("feildHotfix", {
    name: "Hotfix: feildmaster's Editor",
    note: "Turn on if his editor stays black in the Card Maker.",
    type: "boolean",
    default: false,
    onChange: (value) => {
      setHotfix(!!value);
      if (mounted && mounted.frames.feildmaster) reloadEditor("feildmaster");
    }
  });

  gallerySetting = settings.add("gallery", {
    name: "Card Gallery",
    note: "Adds the Card Gallery to the Card Maker, to share cards you make.",
    type: "boolean",
    default: true,
    refresh: true
  });
  reviewerSetting = settings.add("galleryReviewerKey", {
    name: "Gallery Reviewer Key",
    note: "Only for the gallery's reviewer. Adds Review to the Card Maker.",
    type: "text",
    default: "",
    hidden: () => !!gallerySetting && !gallerySetting.value()
  });
  wheelSetting = settings.add("galleryWheelPages", {
    name: "Gallery: Scroll Wheel Pages",
    note: "Scroll the mouse wheel over the gallery to turn its pages.",
    type: "boolean",
    default: true,
    hidden: () => !!gallerySetting && !gallerySetting.value()
  });

  registerKeybind(plugin, {
    key: "toggleCardMaker",
    name: "Toggle Card Maker",
    defaultCode: "KeyK",
    packageLabel: "Card Maker",
    onMatch: () => toggleCardMaker()
  });

  if (!isPluginEnabled("cardMaker")) return;
  // GM copy follows the setting (e.g. after Restore).
  if (isHotfixOn() !== !!hotfixSetting.value()) setHotfix(!!hotfixSetting.value());

  if (!addFooterButton()) {
    // Footer drawn later than us on some pages: watch briefly for it.
    const watch = new MutationObserver(() => { if (addFooterButton()) watch.disconnect(); });
    watch.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => watch.disconnect(), 10000);
  }
}
