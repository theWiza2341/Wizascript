// packages/card-maker/window.js
//
// The Card Maker's window: title bar (drag to move, double-click to fill
// the screen), eight resize handles, shrink-to-title-bar and fill-screen
// states. Same rules as Tier List Maker's window.js:
//  - never smaller than MIN_W x MIN_H, never larger than the screen;
//  - always fully on screen, and kept above the page footer, so the Pack
//    button that closes it is never hidden (filling the screen still
//    covers everything; the title bar's x closes it then);
//  - moves are followed on the whole page (capture phase), which also
//    suits Controller Support's cursor.
// The editor is a frame from another site, which would swallow the
// pointer while it passes over it; a see-through shield covers it during
// a move or resize.

import { loadWindowState, saveWindowState } from "./storage.js";
import { BAR_H } from "./styles.js";

export const MIN_W = 420;
export const MIN_H = 300;
const DEFAULT_W = 900;
const DEFAULT_H = 640;
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function viewport() {
  const w = document.documentElement.clientWidth || window.innerWidth;
  const h = document.documentElement.clientHeight || window.innerHeight;
  const footer = document.querySelector("footer");
  const top = footer ? footer.getBoundingClientRect().top : NaN;
  // Only a footer sitting along the bottom of the screen counts.
  return { w, h: top > h / 2 && top < h ? Math.floor(top) : h };
}

function headerButton(action, label, title) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "wz-cm-btn";
  b.dataset.action = action;
  b.textContent = label;
  b.title = title;
  return b;
}

export function buildWindow({ signal, icon, editors, onPick, onAction }) {
  const saved = loadWindowState() || {};
  const ui = { geometry: null, maximised: !!saved.maximised, minimised: !!saved.minimised };

  const clamp = (g) => {
    const vp = viewport();
    const width = Math.max(Math.min(MIN_W, vp.w), Math.min(g.width, vp.w));
    const height = Math.max(Math.min(MIN_H, vp.h), Math.min(g.height, vp.h));
    const shown = ui.minimised ? BAR_H + 4 : height;
    return {
      width,
      height,
      left: Math.max(0, Math.min(g.left, vp.w - width)),
      top: Math.max(0, Math.min(g.top, vp.h - shown))
    };
  };
  // Default: the right-hand side, leaving the left (where chat usually is) free.
  const defaults = () => {
    const vp = viewport();
    const width = Math.min(DEFAULT_W, vp.w - 16);
    const height = Math.min(DEFAULT_H, vp.h - 16);
    return { left: vp.w - width - 8, top: 8, width, height };
  };
  ui.geometry = clamp(saved.geometry || defaults());

  const root = document.createElement("div");
  root.className = "wz-cm";

  const header = document.createElement("div");
  header.className = "wz-cm-header";
  header.title = "Drag to move, double-click to fill the screen";
  const img = document.createElement("img");
  img.className = "wz-cm-icon";
  img.src = icon;
  img.alt = "";
  const title = document.createElement("span");
  title.className = "wz-cm-title";
  title.textContent = "Card Maker";
  const pick = document.createElement("select");
  pick.className = "wz-cm-pick";
  pick.title = "Which card editor to use";
  Object.entries(editors).forEach(([key, e]) => {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = e.label;
    pick.appendChild(o);
  });
  pick.addEventListener("change", () => onPick(pick.value), { signal });
  const grip = document.createElement("div");
  grip.className = "wz-cm-grip";
  const buttons = {
    reload: headerButton("reload", "↻", "Reload the editor"),
    site: headerButton("site", "↗", "Open the editor's own site in a new tab"),
    min: headerButton("min", "_", "Shrink to the title bar"),
    max: headerButton("max", "□", "Fill the screen"),
    close: headerButton("close", "×", "Close (the editor stays loaded until you refresh)")
  };
  header.append(img, title, pick, grip, ...Object.values(buttons));

  const body = document.createElement("div");
  body.className = "wz-cm-body";
  const loading = document.createElement("div");
  loading.className = "wz-cm-loading";
  const shield = document.createElement("div");
  shield.className = "wz-cm-shield";
  const note = document.createElement("div");
  note.className = "wz-cm-note";
  note.hidden = true;
  body.append(loading, note, shield);
  root.append(header, body);
  EDGES.forEach((edge) => {
    const h = document.createElement("div");
    h.className = `wz-cm-resize wz-cm-resize-${edge}`;
    h.dataset.edge = edge;
    root.appendChild(h);
  });

  const persist = () => saveWindowState({ geometry: ui.geometry, maximised: ui.maximised, minimised: ui.minimised });

  function apply() {
    const g = ui.geometry;
    root.style.left = g.left + "px";
    root.style.top = g.top + "px";
    root.style.width = g.width + "px";
    root.style.height = g.height + "px";
    root.classList.toggle("wz-cm-max", ui.maximised);
    root.classList.toggle("wz-cm-min", ui.minimised && !ui.maximised);
    buttons.max.textContent = ui.maximised ? "❐" : "□";
    buttons.max.title = ui.maximised ? "Back to the window" : "Fill the screen";
    buttons.min.textContent = ui.minimised ? "▭" : "_";
    buttons.min.title = ui.minimised ? "Show the editor again" : "Shrink to the title bar";
  }

  function setMaximised(value) {
    ui.maximised = !!value;
    if (ui.maximised) ui.minimised = false;
    apply();
    persist();
  }

  function setMinimised(value) {
    ui.minimised = !!value;
    if (ui.minimised) ui.maximised = false;
    ui.geometry = clamp(ui.geometry);
    apply();
    persist();
  }

  function followPointer(onMove, onEnd) {
    root.classList.add("wz-cm-busy");
    const move = (ev) => onMove(ev);
    const end = () => {
      root.classList.remove("wz-cm-busy");
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
    if (e.button !== 0 || ui.maximised || e.target.closest("button, select")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, left: ui.geometry.left, top: ui.geometry.top };
    header.style.cursor = "grabbing";
    followPointer((ev) => {
      ui.geometry = clamp({ ...ui.geometry, left: start.left + ev.clientX - start.x, top: start.top + ev.clientY - start.y });
      apply();
    }, () => {
      header.style.cursor = "";
      persist();
    });
  }, { signal });

  header.addEventListener("dblclick", (e) => {
    if (e.target.closest("button, select")) return;
    setMaximised(!ui.maximised);
  }, { signal });

  root.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".wz-cm-resize");
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
        width = Math.max(MIN_W, Math.min(start.width - dx, start.left + start.width));
        left = start.left + start.width - width;
      }
      if (edge.includes("n")) {
        height = Math.max(MIN_H, Math.min(start.height - dy, start.top + start.height));
        top = start.top + start.height - height;
      }
      ui.geometry = clamp({ left, top, width: Math.max(MIN_W, width), height: Math.max(MIN_H, height) });
      apply();
    }, persist);
  }, { signal });

  root.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "min") setMinimised(!ui.minimised);
    else if (action === "max") setMaximised(!ui.maximised);
    else if (action) onAction(action);
  }, { signal });

  // The browser window got smaller: keep ours inside it.
  window.addEventListener("resize", () => {
    ui.geometry = clamp(ui.geometry);
    apply();
  }, { signal });

  apply();

  return {
    root,
    body,
    loading,
    note,
    pick,
    // Called each time the window is shown: the page may have changed size.
    refit() { ui.geometry = clamp(ui.geometry); apply(); },
    isMaximised: () => ui.maximised,
    setMaximised
  };
}
