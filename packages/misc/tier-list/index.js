// packages/misc/tier-list/index.js
//
// Tier List Maker: a TierMaker-style tier list built from live card
// data, in a window that works on every page (including matches and
// Spectate). Purely manual - nothing here reads or reacts to the game.
//
// Hidden on every page load; the Toggle Tier List shortcut (or its x
// button) shows/hides it. Pieces:
//   model.js      data + every change (undo, autosave)
//   items.js      card data, names, pictures, picker search
//   window.js     frame: move, resize, maximise, saved geometry
//   tiers-view.js rows + tier editor
//   picker.js     search/filter panel (empty until used)
//   drag.js       pointer drag and drop
//   preview.js    full-card hover preview
//
// Disabled plugin = settings registered (so they exist), nothing else.

import { createFeatureSettings } from "../../core/settings.js";
import { isPluginEnabled } from "../../core/plugins.js";
import { registerKeybind } from "../../core/keybinds.js";
import { injectTierListStyle } from "./styles.js";
import * as model from "./model.js";
import { initItemData } from "./items.js";
import { buildWindow } from "./window.js";
import { createTiersView } from "./tiers-view.js";
import { createPicker } from "./picker.js";
import { attachDrag } from "./drag.js";
import { attachPreview } from "./preview.js";
import { buildTile } from "./tiers-view.js";
import { getCard, loadArtifacts, hasArtifacts } from "./items.js";
import { encodeCode, decodeCode, showExportDialog, showImportDialog } from "../../core/share-code.js";
import { matchesPage } from "../../core/page-match.js";
import { tagObjectsForCard } from "../card-tags/storage.js";

// Pages whose card elements carry real card ids (<div id="<cardId>"
// class="card">). In matches/Spectate the ids are per-match instances,
// so dragging in from the page is limited to these.
const CARD_PAGES = ["/Crafting", "/Decks"];

function pageItemKey(target) {
  if (!setting("pageDrag", true) || !matchesPage(CARD_PAGES)) return null;
  const el = target.closest && target.closest(".card[id]");
  if (!el || !getCard(el.id)) return null;
  return `card:${el.id}`;
}

const CARD_SIZES = { Small: 64, Medium: 88, Large: 120 };
const PREVIEW_DELAYS = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"];
const OPACITIES = ["100%", "90%", "80%", "70%", "60%", "50%"];
const RANKED_SHOW = "Greyed out";
const RANKED_HIDE = "Hidden";

let settings = null;
let mounted = null; // { controller, win, ... } | null

function preferredTile() {
  const v = settings ? settings.value("cardSize") : "Medium";
  return CARD_SIZES[v] || CARD_SIZES.Medium;
}

function setting(key, fallback) {
  return settings ? settings.value(key) : fallback;
}

// Off by default. Spectate is never affected - only your own matches.
function blockedHere() {
  return !!setting("hideInMatches", false) && matchesPage("/Game");
}

// Window look settings, applied to an open window straight away.
function applyLook() {
  if (!mounted) return;
  const root = mounted.win.root;
  const pct = parseInt(setting("opacity", "100%"), 10);
  root.style.setProperty("--wz-tl-opacity", String((Number.isFinite(pct) ? Math.min(100, Math.max(50, pct)) : 100) / 100));
  root.classList.toggle("wz-tl-nonames", !setting("showNames", true));
}

function previewDelayMs() {
  const v = parseFloat(settings ? settings.value("previewDelay") : "2");
  return (Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 2) * 1000;
}

// Card Tags only joins the search while that plugin is switched on.
function pickerOptions() {
  return {
    hideRanked: !!settings && settings.value("rankedInPanel") === RANKED_HIDE,
    tagsFor: isPluginEnabled("cardTags") ? (id) => tagObjectsForCard(id).map((t) => t.name) : null
  };
}

function headerButton(label, title) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "wz-tl-btn";
  b.textContent = label;
  b.title = title;
  return b;
}

export function isTierListOpen() {
  return !!mounted;
}

export function showTierList() {
  if (mounted || blockedHere()) return;
  injectTierListStyle();
  const controller = new AbortController();
  const { signal } = controller;

  const win = buildWindow({
    signal,
    getPreferredTile: preferredTile,
    onTitleChange: (value) => model.setTitle(value)
  });

  // ---- header buttons ----
  const listsBtn = headerButton("Lists \u25BE", "Switch, add, copy or delete tier lists");
  win.title.after(listsBtn);
  const undoBtn = headerButton("\u21B6", "Undo");
  const resetBtn = headerButton("Reset", "Clear every tier back to S–D (click twice)");
  const pickerBtn = headerButton("Items", "Show or hide the item panel");
  const maxBtn = headerButton("□", "Fill the screen");
  const closeBtn = headerButton("×", "Close");
  win.buttons.append(undoBtn, resetBtn, pickerBtn, maxBtn, closeBtn);

  const tiers = createTiersView({ body: win.body, signal });
  const picker = createPicker({ body: win.body, signal, getOptions: pickerOptions });

  function syncHeader() {
    const list = model.getActiveList();
    if (document.activeElement !== win.title) win.title.value = list.title;
    undoBtn.disabled = !model.canUndo();
    pickerBtn.classList.toggle("wz-tl-active", win.isPickerOpen());
    maxBtn.textContent = win.isMaximised() ? "❐" : "□";
    maxBtn.title = win.isMaximised() ? "Restore the window size" : "Fill the screen";
  }

  function renderAll() {
    tiers.render();
    picker.render();
    syncHeader();
  }

  undoBtn.addEventListener("click", () => model.undo(), { signal });

  // ---- lists menu ----
  let listsMenu = null;
  function closeListsMenu() {
    if (listsMenu) listsMenu.remove();
    listsMenu = null;
    listsBtn.classList.remove("wz-tl-active");
  }
  function openListsMenu() {
    closeListsMenu();
    const menu = document.createElement("div");
    menu.className = "wz-tl-menu";
    model.getLists().forEach((l) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "wz-tl-menu-item" + (l.active ? " wz-tl-active" : "");
      row.dataset.listId = l.id;
      const name = document.createElement("span");
      name.textContent = l.title;
      const count = document.createElement("span");
      count.className = "wz-tl-menu-count";
      count.textContent = String(l.count);
      row.append(name, count);
      row.addEventListener("click", () => { model.setActiveList(l.id); closeListsMenu(); });
      menu.appendChild(row);
    });
    const actions = document.createElement("div");
    actions.className = "wz-tl-menu-actions";
    const act = (label, title, fn) => {
      const b = headerButton(label, title);
      b.addEventListener("click", fn);
      actions.appendChild(b);
      return b;
    };
    act("+ New", "Start a new, empty tier list", () => { model.createList(); closeListsMenu(); });
    act("Copy", "Make a copy of this list", () => { model.duplicateList(); closeListsMenu(); });
    const del = act("Delete", "Delete this list (click twice; \u21B6 brings it back)", () => {
      if (!del.classList.contains("wz-tl-danger")) {
        del.classList.add("wz-tl-danger");
        del.textContent = "Sure?";
        return;
      }
      model.deleteActiveList();
      closeListsMenu();
    });
    act("Share\u2026", "Get a code for this list to send to someone", () => { closeListsMenu(); shareList(); });
    act("Import\u2026", "Add a list from a code someone sent you", () => { closeListsMenu(); importListDialog(); });
    menu.appendChild(actions);
    win.root.appendChild(menu);
    const r = listsBtn.getBoundingClientRect();
    const rr = win.root.getBoundingClientRect();
    menu.style.left = Math.max(4, r.left - rr.left) + "px";
    menu.style.top = r.bottom - rr.top + 4 + "px";
    listsMenu = menu;
    listsBtn.classList.add("wz-tl-active");
  }
  listsBtn.addEventListener("click", () => (listsMenu ? closeListsMenu() : openListsMenu()), { signal });
  document.addEventListener("pointerdown", (e) => {
    if (listsMenu && !listsMenu.contains(e.target) && e.target !== listsBtn) closeListsMenu();
  }, { signal, capture: true });

  // ---- share / import ----
  async function shareList() {
    const data = model.exportActiveList();
    const code = await encodeCode("TIER", data);
    const safe = (data.title || "tier-list").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "tier-list";
    showExportDialog({
      title: "Share Tier List",
      intro: `Send this code to share "${data.title}". They can add it with Lists \u25BE \u2192 Import\u2026`,
      code,
      fileName: `${safe}.txt`
    });
  }
  function importListDialog() {
    showImportDialog({
      title: "Import Tier List",
      intro: "Paste a tier list code. It's added as a new list; your own lists aren't changed.",
      actionLabel: "Import",
      onSubmit: async (text) => {
        const data = await decodeCode(text, "TIER");
        model.importList(data);
        ensureArtifacts();
      }
    });
  }

  // Artifact tiles need the artifact list for their pictures/names.
  // Tried at most once per opening, so an offline page doesn't refetch on every change.
  let artifactsTried = false;
  function ensureArtifacts() {
    if (artifactsTried || hasArtifacts() || !model.listUsesKind("artifact")) return;
    artifactsTried = true;
    loadArtifacts().then((ok) => { if (ok) renderAll(); });
  }

  // Bootstrap dialogs sit far below our window - step behind while one is open.
  const modalWatch = new MutationObserver(() => {
    win.root.classList.toggle("wz-tl-under-modal", document.body.classList.contains("modal-open") || !!document.querySelector(".bootstrap-dialog.in, .modal.in"));
  });
  modalWatch.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true });
  signal.addEventListener("abort", () => modalWatch.disconnect());

  // ---- editing text items (double-click) ----
  win.root.addEventListener("dblclick", (e) => {
    const tile = e.target.closest(".wz-tl-tile.wz-tl-text");
    if (!tile || e.target.closest("input, .wz-tl-tile-del")) return;
    const textId = tile.dataset.key.slice(5);
    const current = model.getTextLabel(textId);
    if (current === null) return;
    const label = tile.querySelector(".wz-tl-tile-name");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = model.MAX_TEXT;
    input.value = current;
    label.textContent = "";
    label.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== current) model.renameText(textId, input.value);
      else renderAll();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit(true);
      if (ev.key === "Escape") commit(false);
    });
    input.addEventListener("blur", () => commit(true));
  }, { signal });

  let resetArmed = null;
  resetBtn.addEventListener("click", () => {
    if (resetArmed) {
      clearTimeout(resetArmed);
      resetArmed = null;
      resetBtn.textContent = "Reset";
      resetBtn.classList.remove("wz-tl-danger");
      tiers.closeEditor();
      model.resetList();
      return;
    }
    resetBtn.textContent = "Sure?";
    resetBtn.classList.add("wz-tl-danger");
    resetArmed = setTimeout(() => {
      resetArmed = null;
      resetBtn.textContent = "Reset";
      resetBtn.classList.remove("wz-tl-danger");
    }, 3000);
  }, { signal });

  pickerBtn.addEventListener("click", () => {
    const open = !win.isPickerOpen();
    win.setPickerOpen(open);
    picker.setOpen(open);
    syncHeader();
    if (open) picker.focusSearch();
  }, { signal });
  picker.setOpen(win.isPickerOpen());

  maxBtn.addEventListener("click", () => win.setMaximised(!win.isMaximised()), { signal });
  win.onMaximiseChange(syncHeader);
  closeBtn.addEventListener("click", () => hideTierList(), { signal });

  // Typing in our fields must not reach the page's own hotkeys (e.g.
  // Space ending your turn in a match).
  ["keydown", "keyup", "keypress"].forEach((type) => {
    win.root.addEventListener(type, (e) => {
      if (e.target.closest("input, select, textarea")) e.stopPropagation();
    }, { signal });
  });

  // ---- drag and drop ----
  let preview = null;
  const drag = attachDrag({
    root: win.root,
    signal,
    pageItemKey,
    buildGhost: (key) => buildTile(key),
    onDragStart: () => { if (preview) preview.hide(); tiers.closeEditor(); closeListsMenu(); },
    onDrop: ({ key, from, target }) => {
      if (target.type === "tier") {
        model.placeItem(key, target.tierId, target.index);
      } else if ((target.type === "picker" || target.type === "outside") && from.type === "tier") {
        model.removeItem(key);
      }
    }
  });
  preview = attachPreview({ root: win.root, signal, isDragging: drag.isDragging, getDelayMs: previewDelayMs });

  const unsubscribe = model.subscribe(() => { renderAll(); ensureArtifacts(); });
  signal.addEventListener("abort", unsubscribe);
  window.addEventListener("beforeunload", () => model.flushSave(), { signal });

  document.body.appendChild(win.root);
  renderAll();
  ensureArtifacts();

  mounted = { controller, win, picker };
  applyLook();
}

export function hideTierList() {
  if (!mounted) return;
  model.flushSave();
  mounted.controller.abort();
  mounted.win.root.remove();
  mounted = null;
}

export function initTierList(plugin) {
  settings = createFeatureSettings(plugin, "tierlist", {
    tab: "Tier List",
    visible: () => isPluginEnabled("tierList")
  });
  settings.add("cardSize", {
    name: "Card Size",
    note: "How big cards get in a large window. They shrink in a small one.",
    type: "select",
    options: Object.keys(CARD_SIZES),
    default: "Medium",
    onChange: () => { if (mounted) mounted.win.refreshTileSize(); }
  });
  settings.add("opacity", {
    name: "Window Opacity",
    note: "See-through when the mouse is elsewhere; solid while you use it.",
    type: "select",
    options: OPACITIES,
    default: "100%",
    onChange: () => applyLook()
  });
  settings.add("showNames", {
    name: "Show Names on Tiles",
    note: "Turn off for art-only tiles. Text items always show their words.",
    type: "boolean",
    default: true,
    onChange: () => applyLook()
  });
  settings.add("previewDelay", {
    name: "Card Preview Delay (seconds)",
    note: "How long to rest the mouse on a card before its full preview shows.",
    type: "select",
    options: PREVIEW_DELAYS,
    default: "2"
  });
  settings.add("rankedInPanel", {
    name: "Ranked Items in the Item Panel",
    note: "Grey out items already in a tier, or hide them from the panel.",
    type: "select",
    options: [RANKED_SHOW, RANKED_HIDE],
    default: RANKED_SHOW,
    onChange: () => { if (mounted) mounted.picker.render(); }
  });

  settings.add("pageDrag", {
    name: "Drag Cards In From Crafting/Decks",
    note: "Hold and drag a card on those pages into the open tier list.",
    type: "boolean",
    default: true
  });
  settings.add("hideInMatches", {
    name: "Turn Off During Your Matches",
    note: "Closes it and ignores the shortcut while you play. Spectating is fine.",
    type: "boolean",
    default: false,
    onChange: () => { if (blockedHere()) hideTierList(); }
  });

  registerKeybind(plugin, {
    key: "toggleTierList",
    name: "Toggle Tier List",
    defaultCode: "KeyL",
    packageLabel: "Tier List",
    onMatch: () => {
      if (!isPluginEnabled("tierList")) return;
      if (mounted) hideTierList();
      else showTierList();
    }
  });

  if (!isPluginEnabled("tierList")) return;
  initItemData(plugin);
}
