// packages/misc/tier-list/window.js
//
// The Tier List window's frame: title bar (drag to move, double-click
// to maximise), eight resize handles, and the maximise/restore state.
// Size, position, maximised state and picker visibility are saved.
//
// Sizing rules:
//  - never smaller than MIN_W x MIN_H, never larger than the viewport;
//  - maximised = fills the screen (so there's no separate "overlay"
//    mode - this is it);
//  - tiles follow the window width (about 9 per row) but stay between
//    MIN_TILE and the "Card Size" setting. Below that, rows wrap and
//    the tier area scrolls instead of tiles shrinking further.
//
// All listeners go through the caller's AbortController signal, same
// pattern as the Notepad.

import { loadWindowState, saveWindowState } from "./storage.js";

export const MIN_W = 400;
export const MIN_H = 340;
const DEFAULT_W = 680;
const DEFAULT_H = 500;
export const MIN_TILE = 52;
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function viewport() {
  return { w: document.documentElement.clientWidth || window.innerWidth, h: document.documentElement.clientHeight || window.innerHeight };
}

function clampGeometry(g) {
  const vp = viewport();
  const width = Math.max(Math.min(MIN_W, vp.w), Math.min(g.width, vp.w));
  const height = Math.max(Math.min(MIN_H, vp.h), Math.min(g.height, vp.h));
  const left = Math.max(0, Math.min(g.left, vp.w - width));
  const top = Math.max(0, Math.min(g.top, vp.h - height));
  return { left, top, width, height };
}

function defaultGeometry() {
  const vp = viewport();
  const width = Math.min(DEFAULT_W, vp.w);
  const height = Math.min(DEFAULT_H, vp.h);
  return { left: Math.round((vp.w - width) / 2), top: Math.round((vp.h - height) / 2), width, height };
}

export function buildWindow({ signal, getPreferredTile, onTitleChange }) {
  const saved = loadWindowState() || {};
  const ui = {
    geometry: clampGeometry(saved.geometry || defaultGeometry()),
    maximised: !!saved.maximised,
    pickerOpen: saved.pickerOpen !== false
  };

  const root = document.createElement("div");
  root.className = "wz-tl";

  const header = document.createElement("div");
  header.className = "wz-tl-header";

  const title = document.createElement("input");
  title.type = "text";
  title.className = "wz-tl-title";
  title.maxLength = 60;
  title.spellcheck = false;
  title.title = "Click to rename this list";
  title.addEventListener("change", () => onTitleChange(title.value), { signal });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") title.blur(); }, { signal });

  const buttons = document.createElement("span");
  buttons.style.cssText = "display:flex;gap:4px;flex:none;";

  const body = document.createElement("div");
  body.className = "wz-tl-body";

  // Empty space between the name and the buttons - the part of the
  // title bar that's always free to grab.
  const grip = document.createElement("div");
  grip.className = "wz-tl-grip";
  grip.title = "Drag to move, double-click to fill the screen";
  header.append(title, grip, buttons);
  root.append(header, body);
  EDGES.forEach((edge) => {
    const h = document.createElement("div");
    h.className = `wz-tl-resize wz-tl-resize-${edge}`;
    h.dataset.edge = edge;
    root.appendChild(h);
  });

  function persist() {
    saveWindowState({ geometry: ui.geometry, maximised: ui.maximised, pickerOpen: ui.pickerOpen });
  }

  function updateTileSize() {
    const width = ui.maximised ? viewport().w : ui.geometry.width;
    const preferred = getPreferredTile();
    const tile = Math.round(Math.max(MIN_TILE, Math.min(preferred, (width - 120) / 9)));
    root.style.setProperty("--wz-tl-tile", tile + "px");
  }

  function apply() {
    const g = ui.geometry;
    root.style.left = g.left + "px";
    root.style.top = g.top + "px";
    root.style.width = g.width + "px";
    root.style.height = g.height + "px";
    root.classList.toggle("wz-tl-max", ui.maximised);
    updateTileSize();
  }

  function setMaximised(value) {
    ui.maximised = !!value;
    apply();
    persist();
    onMaximiseChange.forEach((fn) => fn(ui.maximised));
  }
  const onMaximiseChange = new Set();

  // ---- move (title bar) ----
  // Moves and releases are followed on the whole page, not through
  // pointer capture: Controller Support's cursor sends its pointer
  // events to whatever is under it, so capture never kicks in and the
  // drag used to stop the moment the cursor left the bar or edge.
  function followPointer(onMove, onEnd) {
    const move = (ev) => onMove(ev);
    const end = () => {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
      onEnd();
    };
    document.addEventListener("pointermove", move, { capture: true, signal });
    document.addEventListener("pointerup", end, { capture: true, signal });
    document.addEventListener("pointercancel", end, { capture: true, signal });
  }

  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || ui.maximised) return;
    if (e.target.closest("input, button, select")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, left: ui.geometry.left, top: ui.geometry.top };
    header.style.cursor = "grabbing";
    followPointer((ev) => {
      ui.geometry = clampGeometry({ ...ui.geometry, left: start.left + ev.clientX - start.x, top: start.top + ev.clientY - start.y });
      apply();
    }, () => {
      header.style.cursor = "";
      persist();
    });
  }, { signal });

  header.addEventListener("dblclick", (e) => {
    if (e.target.closest("input, button, select")) return;
    setMaximised(!ui.maximised);
  }, { signal });

  // ---- resize (edges and corners) ----
  root.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".wz-tl-resize");
    if (!handle || e.button !== 0 || ui.maximised) return;
    e.preventDefault();
    e.stopPropagation();
    const edge = handle.dataset.edge;
    const start = { x: e.clientX, y: e.clientY, ...ui.geometry };
    const vp = viewport();
    followPointer((ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let { left, top, width, height } = start;
      if (edge.includes("e")) width = Math.min(start.width + dx, vp.w - start.left);
      if (edge.includes("s")) height = Math.min(start.height + dy, vp.h - start.top);
      if (edge.includes("w")) {
        width = Math.min(start.width - dx, start.left + start.width);
        width = Math.max(width, MIN_W);
        left = start.left + start.width - width;
      }
      if (edge.includes("n")) {
        height = Math.min(start.height - dy, start.top + start.height);
        height = Math.max(height, MIN_H);
        top = start.top + start.height - height;
      }
      ui.geometry = clampGeometry({ left, top, width: Math.max(MIN_W, width), height: Math.max(MIN_H, height) });
      apply();
    }, () => persist());
  }, { signal });

  // The browser window got smaller: keep ours inside it.
  window.addEventListener("resize", () => {
    ui.geometry = clampGeometry(ui.geometry);
    apply();
  }, { signal });

  apply();

  return {
    root,
    header,
    body,
    buttons,
    title,
    isMaximised: () => ui.maximised,
    setMaximised,
    onMaximiseChange: (fn) => onMaximiseChange.add(fn),
    isPickerOpen: () => ui.pickerOpen,
    setPickerOpen(value) { ui.pickerOpen = !!value; persist(); },
    refreshTileSize: updateTileSize
  };
}
