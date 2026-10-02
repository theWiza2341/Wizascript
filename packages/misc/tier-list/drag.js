// packages/misc/tier-list/drag.js
//
// Pointer-based drag and drop for tiles (pointer events rather than
// HTML5 drag-and-drop: one code path for mouse, pen and touch, and the
// same code will take cards dragged in from the page in dev2).
//
// A press only becomes a drag after the pointer moves DRAG_THRESHOLD px,
// so a plain click is still a click. While dragging, a ghost copy of the
// tile follows the pointer and a white bar shows where it will land.
//
// The drop itself is reported back through onDrop(); this file never
// changes the tier list on its own (see model.js).

import { Z_FLOATING } from "./styles.js";

const DRAG_THRESHOLD = 6;

// Where in a row of wrapping tiles the pointer is: the index of the
// first tile the pointer is "before" in reading order.
function insertionIndex(tiles, x, y) {
  for (let i = 0; i < tiles.length; i++) {
    const r = tiles[i].getBoundingClientRect();
    if (y < r.top) return i;
    if (y <= r.bottom && x < r.left + r.width / 2) return i;
  }
  return tiles.length;
}

// root: the tier list window. onDrop({ key, from, target }) where
// target is { type: "tier", tierId, index } | { type: "picker" } |
// { type: "outside" }. onDragStart() is called once a drag really starts.
export function attachDrag({ root, signal, onDrop, onDragStart }) {
  let pending = null; // pointer is down on a tile, not moved enough yet
  let active = null;  // a drag is in progress
  let suppressClick = false;

  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !root.contains(el)) return { type: "outside" };
    const row = el.closest(".wz-tl-row");
    if (row) return { type: "tier", tierId: row.dataset.tierId, rowItems: row.querySelector(".wz-tl-row-items") };
    if (el.closest(".wz-tl-picker")) return { type: "picker" };
    return { type: "none" };
  }

  function clearHighlights() {
    if (!active) return;
    if (active.marker) active.marker.remove();
    active.marker = null;
    root.querySelectorAll(".wz-tl-drop-out, .wz-tl-drop-in").forEach((n) => n.classList.remove("wz-tl-drop-out", "wz-tl-drop-in"));
  }

  function update(x, y) {
    active.ghost.style.left = x - active.offsetX + "px";
    active.ghost.style.top = y - active.offsetY + "px";
    const t = targetAt(x, y);
    clearHighlights();
    active.target = t;
    if (t.type === "tier") {
      const tiles = [...t.rowItems.querySelectorAll(".wz-tl-tile")].filter((n) => n !== active.tile);
      t.index = insertionIndex(tiles, x, y);
      const marker = document.createElement("div");
      marker.className = "wz-tl-marker";
      if (t.index < tiles.length) t.rowItems.insertBefore(marker, tiles[t.index]);
      else t.rowItems.appendChild(marker);
      active.marker = marker;
    } else if (t.type === "picker" && active.from.type === "tier") {
      const picker = root.querySelector(".wz-tl-picker");
      if (picker) picker.classList.add("wz-tl-drop-in");
    } else if (t.type === "outside" && active.from.type === "tier") {
      root.classList.add("wz-tl-drop-out");
    }
  }

  function begin(x, y) {
    const { tile, key, from, offsetX, offsetY } = pending;
    const rect = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    ghost.classList.add("wz-tl-ghost");
    ghost.classList.remove("wz-tl-placed");
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.zIndex = String(Z_FLOATING);
    // The ghost lives on <body>, outside the window, so it needs the
    // window's size variable copied over.
    ghost.style.setProperty("--wz-tl-tile", getComputedStyle(root).getPropertyValue("--wz-tl-tile"));
    document.body.appendChild(ghost);
    tile.classList.add("wz-tl-dragging");
    active = { tile, key, from, ghost, offsetX, offsetY, target: null, marker: null };
    pending = null;
    if (onDragStart) onDragStart();
    update(x, y);
  }

  function finish(cancelled) {
    if (!active) return;
    const { key, from, target, tile, ghost } = active;
    clearHighlights();
    ghost.remove();
    tile.classList.remove("wz-tl-dragging");
    active = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancelled || !target) return;
    const clean = target.type === "tier"
      ? { type: "tier", tierId: target.tierId, index: target.index }
      : { type: target.type };
    onDrop({ key, from, target: clean });
  }

  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const tile = e.target.closest(".wz-tl-tile");
    if (!tile || !root.contains(tile) || !tile.dataset.key) return;
    e.preventDefault(); // no text selection / native image drag
    const row = tile.closest(".wz-tl-row");
    const rect = tile.getBoundingClientRect();
    pending = {
      tile,
      key: tile.dataset.key,
      from: row ? { type: "tier", tierId: row.dataset.tierId } : { type: "picker" },
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };
  }, { signal });

  document.addEventListener("pointermove", (e) => {
    if (pending) {
      if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < DRAG_THRESHOLD) return;
      begin(e.clientX, e.clientY);
    }
    if (active) {
      e.preventDefault();
      update(e.clientX, e.clientY);
    }
  }, { signal });

  document.addEventListener("pointerup", (e) => {
    pending = null;
    if (active) {
      update(e.clientX, e.clientY);
      finish(false);
    }
  }, { signal });

  document.addEventListener("pointercancel", () => {
    pending = null;
    finish(true);
  }, { signal });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) finish(true);
  }, { signal });

  // A drag ends with a click on whatever is under the pointer - eat it.
  document.addEventListener("click", (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, { signal, capture: true });

  return {
    isDragging: () => !!active,
    cancel: () => { pending = null; finish(true); }
  };
}
