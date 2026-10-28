// packages/card-maker/gallery/nav.js
//
// Editor | Browse | Submit, one bar in the Card Maker's title bar, so the
// gallery is always one click away. (Chosen over a side rail and a banner,
// 2026-10-28.) The gallery's reviewer also gets Review, with a count of
// uploads waiting.

import { h } from "./dom.js";

const VIEWS = [["editor", "Editor", "✎"], ["browse", "Browse", "▤"], ["submit", "Submit", "⬆"], ["review", "Review", "✓"]];
const STYLE_ID = "wizascript-cardgallery-nav-style";
const DT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;

const CSS = `
.wz-gn-seg { display: flex; flex: none; height: 24px; margin-left: 6px; border: 2px solid #fff; background: #000; }
.wz-gn-seg button { display: flex; align-items: center; gap: 5px; background: none; border: 0; color: #ccc; padding: 0 12px; font: 13px ${DT}; cursor: pointer; }
.wz-gn-seg button + button { border-left: 2px solid #fff; }
.wz-gn-seg button:hover { color: #fff; background: #222; }
.wz-gn-seg button.on { background: #ffd84a; color: #000; }
.wz-gn-seg .ic { font-size: 12px; }
.wz-gn-seg .count { background: #e05a5a; color: #fff; border-radius: 8px; padding: 0 5px; font: 10px/14px Arial, sans-serif; }
.wz-gn-seg button.on .count { background: #000; color: #ffd84a; }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

export function mountGalleryNav({ win, gallery }) {
  injectStyle();
  const header = win.root.querySelector(".wz-cm-header");
  const seg = h("div", { class: "wz-gn-seg" }, VIEWS.map(([v, label, icon]) =>
    h("button", { type: "button", "data-view": v, title: v === "editor" ? "Back to the editor" : v === "review" ? "Uploads waiting for your review" : `Card Gallery: ${label}`, onclick: () => gallery.setView(v) },
      h("span", { class: "ic", text: icon }), h("span", { text: label }), v === "review" ? h("span", { class: "count" }) : null)));
  header.insertBefore(seg, header.querySelector(".wz-cm-grip"));
  function sync() {
    const view = gallery.view();
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
    const review = seg.querySelector('[data-view="review"]');
    review.style.display = gallery.isReviewer() ? "" : "none";
    const n = gallery.pendingCount();
    const count = review.querySelector(".count");
    count.textContent = n ? String(n) : "";
    count.style.display = n ? "" : "none";
  }
  gallery.onChange(sync);
  sync();
}
