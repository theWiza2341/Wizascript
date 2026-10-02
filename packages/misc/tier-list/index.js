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

const CARD_SIZES = { Small: 64, Medium: 88, Large: 120 };

let settings = null;
let mounted = null; // { controller, win, ... } | null

function preferredTile() {
  const v = settings ? settings.value("cardSize") : "Medium";
  return CARD_SIZES[v] || CARD_SIZES.Medium;
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
  if (mounted) return;
  injectTierListStyle();
  const controller = new AbortController();
  const { signal } = controller;

  const win = buildWindow({
    signal,
    getPreferredTile: preferredTile,
    onTitleChange: (value) => model.setTitle(value)
  });

  // ---- header buttons ----
  const undoBtn = headerButton("↶", "Undo");
  const resetBtn = headerButton("Reset", "Clear every tier back to S–D (click twice)");
  const pickerBtn = headerButton("Cards", "Show or hide the card search panel");
  const maxBtn = headerButton("□", "Fill the screen");
  const closeBtn = headerButton("×", "Close");
  win.buttons.append(undoBtn, resetBtn, pickerBtn, maxBtn, closeBtn);

  const tiers = createTiersView({ body: win.body, signal });
  const picker = createPicker({ body: win.body, signal });

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
    onDragStart: () => { if (preview) preview.hide(); tiers.closeEditor(); },
    onDrop: ({ key, from, target }) => {
      if (target.type === "tier") {
        model.placeItem(key, target.tierId, target.index);
      } else if ((target.type === "picker" || target.type === "outside") && from.type === "tier") {
        model.removeItem(key);
      }
    }
  });
  preview = attachPreview({ root: win.root, signal, isDragging: drag.isDragging });

  const unsubscribe = model.subscribe(renderAll);
  signal.addEventListener("abort", unsubscribe);
  window.addEventListener("beforeunload", () => model.flushSave(), { signal });

  document.body.appendChild(win.root);
  renderAll();

  mounted = { controller, win };
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
