// packages/misc/tier-list/preview.js
//
// Resting the pointer on the same tile for a while (the "Card Preview
// Delay" setting, 1-5s; without pressing a button) shows the full card -
// long enough that moving the mouse around, or dragging, never pops it
// up by accident.
//
// The site's own hover
// preview sits far below our window's z-index, so we draw our own:
// the game's appendCard() (the same renderer UnderScript's battle log
// uses) when the page has it, otherwise a big picture + name.

import { getPageWindow } from "../../core/page-window.js";
import { resolveItem } from "./items.js";

// getDelayMs() is read each time a wait starts, so a changed setting
// applies straight away.
export function attachPreview({ root, signal, isDragging, getDelayMs = () => 2000 }) {
  let timer = null;
  let box = null;
  let lastX = 0;
  let lastY = 0;

  function hide() {
    clearTimeout(timer);
    timer = null;
    if (box) box.remove();
    box = null;
  }

  function position() {
    if (!box) return;
    const r = box.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = lastX + 18;
    let top = lastY + 12;
    if (left + r.width > vw - 4) left = Math.max(4, lastX - r.width - 18);
    if (top + r.height > vh - 4) top = Math.max(4, vh - r.height - 4);
    box.style.left = left + "px";
    box.style.top = top + "px";
  }

  function render(item) {
    const el = document.createElement("div");
    el.className = "wz-tl-preview";
    const pageWindow = getPageWindow();
    const $ = pageWindow.$;
    if (item.card && typeof pageWindow.appendCard === "function" && $) {
      try {
        const holder = $("<div>");
        pageWindow.appendCard(JSON.parse(JSON.stringify(item.card)), holder);
        if (holder.children().length) {
          el.appendChild(holder[0]);
          return el;
        }
      } catch (e) { /* fall through to the simple preview */ }
    }
    const fallback = document.createElement("div");
    fallback.className = "wz-tl-preview-fallback";
    const pic = document.createElement("div");
    if (item.image) pic.style.backgroundImage = `url("${item.image}")`;
    else pic.style.display = "none";
    fallback.append(pic, item.label);
    el.appendChild(fallback);
    return el;
  }

  let overTile = null; // tile the pointer is resting on
  let pressed = false;

  function arm() {
    clearTimeout(timer);
    timer = null;
    const tile = overTile;
    if (!tile || pressed || isDragging() || box) return;
    // Text items are just their label - nothing more to show.
    if (tile.classList.contains("wz-tl-text")) return;
    timer = setTimeout(() => {
      if (pressed || isDragging() || !tile.isConnected || overTile !== tile) return;
      const item = resolveItem(tile.dataset.key);
      box = render(item);
      box.dataset.key = tile.dataset.key;
      document.body.appendChild(box);
      position();
    }, getDelayMs());
  }

  root.addEventListener("pointerover", (e) => {
    const tile = e.target.closest(".wz-tl-tile");
    if (!tile || !tile.dataset.key || tile === overTile) return;
    hide();
    overTile = tile;
    arm();
  }, { signal });

  root.addEventListener("pointerout", (e) => {
    const tile = e.target.closest(".wz-tl-tile");
    if (!tile || tile !== overTile) return;
    if (e.relatedTarget && tile.contains(e.relatedTarget)) return;
    overTile = null;
    hide();
  }, { signal });

  root.addEventListener("pointermove", (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    position();
  }, { signal });

  // Any press cancels it; letting go over the same tile starts the wait again.
  document.addEventListener("pointerdown", () => {
    pressed = true;
    hide();
  }, { signal, capture: true });
  document.addEventListener("pointerup", () => {
    pressed = false;
    if (overTile && overTile.isConnected) arm();
    else overTile = null;
  }, { signal, capture: true });

  signal.addEventListener("abort", hide);

  return { hide };
}
