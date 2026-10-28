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
// players make in it. Browsers keep a framed site's saves separate from
// the same site opened on its own, so cards made here stay here.
//
// Disabled plugin = settings registered (so they exist), nothing else.

import { createFeatureSettings } from "../core/settings.js";
import { isPluginEnabled } from "../core/plugins.js";
import { registerKeybind } from "../core/keybinds.js";
import { injectCardMakerStyle } from "./styles.js";
import { buildWindow } from "./window.js";
import { EDITORS, EDITOR_LABELS, DEFAULT_EDITOR, editorForLabel, FRAME_MESSAGE } from "./editors.js";
import { isHotfixOn, setHotfix } from "./storage.js";
import PACK_ICON from "../../assets/pack.png";

// No word from Wizascript inside feildmaster's editor this long after it
// loads: Wizascript isn't running there, so offer the editor's own site.
const NO_REPORT_MS = 15000;

let settings = null;
let editorSetting = null;
let hotfixSetting = null;
let mounted = null; // { controller, win, frames, ... } | null - built on first open
let footerButton = null;

const log = (...a) => console.log("[Card Maker]", ...a);

function currentEditor() {
  return editorForLabel(editorSetting ? editorSetting.value() : EDITORS[DEFAULT_EDITOR].label);
}

export function isCardMakerOpen() {
  return !!mounted && mounted.win.root.style.display !== "none";
}

export function toggleCardMaker() {
  if (!isPluginEnabled("cardMaker")) return;
  if (isCardMakerOpen()) hideCardMaker();
  else showCardMaker();
}

export function hideCardMaker() {
  if (!mounted) return;
  mounted.win.root.style.display = "none";
  updateFooterButton();
}

export function showCardMaker() {
  if (!mounted) mount();
  mounted.win.root.style.display = "";
  mounted.win.refit();
  showEditor(currentEditor());
  mounted.syncLayer();
  updateFooterButton();
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
      else if (action === "reload") reloadEditor(key);
      else if (action === "site") window.open(EDITORS[key].url, "_blank", "noopener");
    }
  });
  document.body.appendChild(win.root);

  // Step behind anything UnderScript opens on top of the page (same as
  // Tier List Maker): Bootstrap dialogs (z 1050) and the Esc menu
  // (.menu-backdrop, z 1010, created the first time it opens).
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
  }
  layerWatch.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true });
  signal.addEventListener("abort", () => layerWatch.disconnect());

  // Reports from Wizascript inside feildmaster's editor (frame.js).
  window.addEventListener("message", (e) => {
    const f = mounted && mounted.frames.feildmaster;
    if (!f || e.source !== f.el.contentWindow || e.origin !== EDITORS.feildmaster.origin) return;
    if (!e.data || e.data.tag !== FRAME_MESSAGE) return;
    clearTimeout(f.noReport);
    f.status = e.data.status;
    log(`feildmaster's editor: ${e.data.status}${e.data.hotfixed ? " (hotfix applied)" : ""}`);
    updateNote();
  }, { signal });

  mounted = { controller, win, frames: {}, syncLayer };
}

// One frame per editor, made the first time it's shown and then only
// hidden, so switching editors or closing the window loses nothing.
function showEditor(key) {
  const { win, frames } = mounted;
  win.pick.value = key;
  Object.entries(frames).forEach(([k, f]) => { f.el.style.display = k === key ? "" : "none"; });
  if (!frames[key]) {
    const el = document.createElement("iframe");
    el.title = EDITORS[key].label;
    el.allow = "clipboard-read; clipboard-write";
    frames[key] = { el, status: "loading", noReport: null };
    win.body.insertBefore(el, win.loading);
    loadEditor(key);
  } else {
    win.loading.style.display = frames[key].status === "loading" ? "" : "none";
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
  if (currentEditor() === key) win.loading.style.display = "";
  f.el.onload = () => {
    if (f.status === "loading") f.status = key === "feildmaster" ? "waiting" : "ok";
    if (currentEditor() === key) win.loading.style.display = "none";
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
    onChange: () => { if (isCardMakerOpen()) showEditor(currentEditor()); }
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
