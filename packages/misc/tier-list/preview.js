// packages/misc/tier-list/preview.js
//
// Hovering a card tile shows the full card. The site's own hover
// preview sits far below our window's z-index, so we draw our own:
// the game's appendCard() (the same renderer UnderScript's battle log
// uses) when the page has it, otherwise a big picture + name.

import { getPageWindow } from "../../core/page-window.js";
import { resolveItem } from "./items.js";

const DELAY_MS = 300;

export function attachPreview({ root, signal, isDragging }) {
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

  root.addEventListener("pointerover", (e) => {
    const tile = e.target.closest(".wz-tl-tile");
    if (!tile || !tile.dataset.key || isDragging()) return;
    if (box && box.dataset.key === tile.dataset.key) return;
    hide();
    timer = setTimeout(() => {
      if (isDragging() || !tile.isConnected) return;
      const item = resolveItem(tile.dataset.key);
      box = render(item);
      box.dataset.key = tile.dataset.key;
      document.body.appendChild(box);
      position();
    }, DELAY_MS);
  }, { signal });

  root.addEventListener("pointerout", (e) => {
    const tile = e.target.closest(".wz-tl-tile");
    if (!tile) return;
    if (e.relatedTarget && tile.contains(e.relatedTarget)) return;
    hide();
  }, { signal });

  root.addEventListener("pointermove", (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    position();
  }, { signal });

  root.addEventListener("pointerdown", hide, { signal });
  signal.addEventListener("abort", hide);

  return { hide };
}
