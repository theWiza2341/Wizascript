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
// from is { type: "tier", tierId } | { type: "picker" } | { type: "page" }
// and target is { type: "tier", tierId, index } | { type: "picker" } |
// { type: "outside" }. onDragStart() is called once a drag really starts.
//
// Dragging cards in from the page: pageItemKey(element) returns an item
// key for a press on a real card on the page (null otherwise), and
// buildGhost(key) draws the tile that follows the pointer. A press on a
// page card is left completely alone (its normal click still works)
// unless the pointer then moves past the threshold.
export function attachDrag({ root, signal, onDrop, onDragStart, pageItemKey, buildGhost }) {
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
    root.querySelectorAll(".wz-tl-drop-in").forEach((n) => n.classList.remove("wz-tl-drop-in"));
    active.ghost.classList.remove("wz-tl-ghost-remove");
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
    } else if ((t.type === "picker" || t.type === "outside") && active.from.type === "tier") {
      // Dropping here unranks the card: the ghost fades and shows an x
      // (no outline on the window - that was too loud).
      active.ghost.classList.add("wz-tl-ghost-remove");
      if (t.type === "picker") {
        const picker = root.querySelector(".wz-tl-picker");
        if (picker) picker.classList.add("wz-tl-drop-in");
      }
    }
  }

  function begin(x, y) {
    const { tile, key, from, offsetX, offsetY } = pending;
    const fromPage = from.type === "page";
    const ghost = fromPage ? buildGhost(key) : tile.cloneNode(true);
    ghost.classList.add("wz-tl-ghost");
    ghost.classList.remove("wz-tl-placed");
    // The ghost lives on <body>, outside the window, so it needs the
    // window's size variable copied over.
    const size = getComputedStyle(root).getPropertyValue("--wz-tl-tile");
    ghost.style.setProperty("--wz-tl-tile", size);
    if (fromPage) {
      ghost.style.width = size;
      ghost.style.height = `calc(${size} * 0.8)`;
    } else {
      const rect = tile.getBoundingClientRect();
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
    }
    ghost.style.zIndex = String(Z_FLOATING);
    document.body.appendChild(ghost);
    if (tile) tile.classList.add("wz-tl-dragging");
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
    if (tile) tile.classList.remove("wz-tl-dragging");
    active = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancelled || !target) return;
    const clean = target.type === "tier"
      ? { type: "tier", tierId: target.tierId, index: target.index }
      : { type: target.type };
    onDrop({ key, from, target: clean });
  }

  // Press on a card on the page itself (outside our window).
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !pageItemKey || root.contains(e.target)) return;
    const key = pageItemKey(e.target);
    if (!key) return;
    pending = {
      tile: null,
      key,
      from: { type: "page" },
      startX: e.clientX,
      startY: e.clientY,
      offsetX: 20,
      offsetY: 20
    };
  }, { signal, capture: true });

  // While dragging a page card, the browser's own image drag and text
  // selection would fight ours.
  ["dragstart", "selectstart"].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (active || (pending && pending.from.type === "page")) e.preventDefault();
    }, { signal, capture: true });
  });

  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".wz-tl-tile-del, input")) return;
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
