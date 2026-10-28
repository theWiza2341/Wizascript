// packages/card-maker/gallery/nav.js
//
// How the player gets between the editor, Browse and Submit. TEMPORARY:
// three styles to compare, picked in the gallery's Prototype bar:
//   a  Title bar - Editor | Browse | Submit as one bar in the title bar,
//                  always there.
//   b  Side rail - a rail down the window's left edge with big labelled
//                  buttons.
//   c  Banner    - a big yellow Card Gallery button in the title bar; in
//                  the gallery, a banner with big Browse / Submit tabs and
//                  "◀ Editor".

import { h } from "./dom.js";

const VIEWS = [["editor", "Editor", "✎"], ["browse", "Browse", "▤"], ["submit", "Submit", "⬆"]];
const STYLE_ID = "wizascript-cardgallery-nav-style";
const RAIL_W = 78;
const DT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;

const CSS = `
.wz-gn-seg, .wz-gn-big, .wz-gn-rail { display: none; }
.wz-cm[data-wz-nav="a"] .wz-gn-seg { display: flex; }
.wz-cm[data-wz-nav="b"] .wz-gn-rail { display: flex; }
.wz-cm[data-wz-nav="c"] .wz-gn-big { display: inline-flex; }

.wz-gn-seg { flex: none; height: 24px; margin-left: 6px; border: 2px solid #fff; background: #000; }
.wz-gn-seg button { display: flex; align-items: center; gap: 5px; background: none; border: 0; border-right: 2px solid #fff; color: #ccc; padding: 0 12px; font: 13px ${DT}; cursor: pointer; }
.wz-gn-seg button:last-child { border-right: 0; }
.wz-gn-seg button:hover { color: #fff; background: #222; }
.wz-gn-seg button.on { background: #ffd84a; color: #000; }
.wz-gn-seg .ic { font-size: 12px; }

.wz-gn-big { flex: none; align-items: center; gap: 6px; height: 24px; padding: 0 14px; background: #ffd84a; color: #000; border: 2px solid #ffd84a; font: 14px ${DT}; cursor: pointer; box-shadow: 0 0 10px rgba(255, 216, 74, .45); }
.wz-gn-big:hover { background: #ffe27a; }
.wz-gn-big.on { background: #000; color: #ffd84a; box-shadow: none; }

.wz-gn-rail { position: absolute; left: 0; top: 0; bottom: 0; width: ${RAIL_W}px; z-index: 8; flex-direction: column; gap: 6px; padding: 8px 6px; box-sizing: border-box; background: #050505; border-right: 2px solid #333; }
.wz-gn-rail button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0 8px; background: #000; border: 2px solid #555; color: #bbb; font: 12px ${DT}; cursor: pointer; }
.wz-gn-rail button .ic { font-size: 20px; line-height: 20px; }
.wz-gn-rail button:hover { border-color: #fff; color: #fff; }
.wz-gn-rail button.on { border-color: #ffd84a; color: #ffd84a; background: #17150c; }
.wz-gn-rail .sep { height: 2px; background: #333; margin: 2px 4px; }
.wz-cm[data-wz-nav="b"] .wz-cm-body > iframe,
.wz-cm[data-wz-nav="b"] .wz-cm-body > .wz-cm-loading,
.wz-cm[data-wz-nav="b"] .wz-cm-body > .wz-cm-note,
.wz-cm[data-wz-nav="b"] .wz-cm-body > .wz-gl-panel { left: ${RAIL_W}px !important; }
.wz-cm[data-wz-nav="b"] .wz-cm-body > iframe { width: auto !important; right: 0 !important; }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

const viewButton = (gallery, [v, label, icon]) =>
  h("button", { type: "button", "data-view": v, title: v === "editor" ? "Back to the editor" : `Card Gallery: ${label}`, onclick: () => gallery.setView(v) },
    h("span", { class: "ic", text: icon }), h("span", { text: label }));

export function mountGalleryNav({ win, gallery }) {
  injectStyle();
  const header = win.root.querySelector(".wz-cm-header");
  const seg = h("div", { class: "wz-gn-seg" }, VIEWS.map((v) => viewButton(gallery, v)));
  const big = h("button", { type: "button", class: "wz-gn-big", onclick: () => gallery.setView(gallery.view() === "editor" ? "browse" : "editor") });
  const rail = h("div", { class: "wz-gn-rail" }, viewButton(gallery, VIEWS[0]), h("div", { class: "sep" }), VIEWS.slice(1).map((v) => viewButton(gallery, v)));
  header.insertBefore(seg, header.querySelector(".wz-cm-grip"));
  header.insertBefore(big, header.querySelector('[data-action="reload"]'));
  win.body.appendChild(rail);

  function sync() {
    const view = gallery.view();
    win.root.setAttribute("data-wz-nav", gallery.navStyle());
    [seg, rail].forEach((box) => box.querySelectorAll("button[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === view)));
    big.classList.toggle("on", view !== "editor");
    big.replaceChildren(h("span", { text: view === "editor" ? "★" : "◀" }), h("span", { text: view === "editor" ? "Card Gallery" : "Editor" }));
    big.title = view === "editor" ? "Open the Card Gallery" : "Back to the editor";
  }
  gallery.onChange(sync);
  sync();
}
