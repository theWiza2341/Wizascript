// packages/card-maker/gallery/nav.js
//
// Editor | Browse | Submit, one bar in the Card Maker's title bar, so the
// gallery is always one click away. (Chosen over a side rail and a banner,
// 2026-10-28.)

import { h } from "./dom.js";

const VIEWS = [["editor", "Editor", "✎"], ["browse", "Browse", "▤"], ["submit", "Submit", "⬆"]];
const STYLE_ID = "wizascript-cardgallery-nav-style";
const DT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;

const CSS = `
.wz-gn-seg { display: flex; flex: none; height: 24px; margin-left: 6px; border: 2px solid #fff; background: #000; }
.wz-gn-seg button { display: flex; align-items: center; gap: 5px; background: none; border: 0; border-right: 2px solid #fff; color: #ccc; padding: 0 12px; font: 13px ${DT}; cursor: pointer; }
.wz-gn-seg button:last-child { border-right: 0; }
.wz-gn-seg button:hover { color: #fff; background: #222; }
.wz-gn-seg button.on { background: #ffd84a; color: #000; }
.wz-gn-seg .ic { font-size: 12px; }
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
    h("button", { type: "button", "data-view": v, title: v === "editor" ? "Back to the editor" : `Card Gallery: ${label}`, onclick: () => gallery.setView(v) },
      h("span", { class: "ic", text: icon }), h("span", { text: label }))));
  header.insertBefore(seg, header.querySelector(".wz-cm-grip"));
  function sync() {
    const view = gallery.view();
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
  }
  gallery.onChange(sync);
  sync();
}
