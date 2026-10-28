// packages/card-maker/styles.js
//
// Card Maker CSS, injected once. Same layers as Tier List Maker: above the
// page, below the Notepad, and down to Z_UNDER while an UnderScript dialog
// or its Esc menu is open.

const STYLE_ID = "wizascript-cardmaker-style";
export const Z_WINDOW = 2147482000;
const Z_UNDER = 1000;
export const BAR_H = 30;

const CSS = `
.wz-cm { position: fixed; z-index: ${Z_WINDOW}; display: flex; flex-direction: column; box-sizing: border-box;
  background: #0d0d0d; color: #fff; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 6px 24px rgba(0,0,0,0.7);
  font: 12px Arial, sans-serif; user-select: none; }
.wz-cm *, .wz-cm *::before, .wz-cm *::after { box-sizing: border-box; }
.wz-cm.wz-cm-under-modal { z-index: ${Z_UNDER}; }
.wz-cm.wz-cm-max { left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; border-radius: 0; }
.wz-cm.wz-cm-min { height: ${BAR_H + 4}px !important; }
.wz-cm.wz-cm-min .wz-cm-body, .wz-cm.wz-cm-min .wz-cm-resize, .wz-cm.wz-cm-max .wz-cm-resize { display: none; }
.wz-cm-header { flex: none; height: ${BAR_H}px; display: flex; align-items: center; gap: 6px; padding: 0 6px;
  background: #222; border-bottom: 1px solid #555; cursor: grab; touch-action: none; }
.wz-cm.wz-cm-max .wz-cm-header { cursor: default; }
.wz-cm-icon { width: 18px; height: 18px; image-rendering: pixelated; flex: none; }
.wz-cm-title { font: bold 13px Arial, sans-serif; white-space: nowrap; }
.wz-cm-grip { flex: 1 1 auto; align-self: stretch; min-width: 16px; }
.wz-cm-pick { background: #333; color: #fff; border: 1px solid #777; border-radius: 3px; font: 12px Arial, sans-serif; height: 22px; max-width: 210px; min-width: 0; }
.wz-cm-btn { flex: none; min-width: 24px; height: 22px; padding: 0 6px; border: 1px solid #777; border-radius: 3px;
  background: #333; color: #fff; font: 13px Arial, sans-serif; line-height: 20px; cursor: pointer; }
.wz-cm-btn:hover { background: #444; border-color: #aaa; }
.wz-cm-body { flex: 1 1 auto; min-height: 0; position: relative; background: #111; }
.wz-cm-body iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #111; }
.wz-cm-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #aaa; pointer-events: none; }
.wz-cm-shield { position: absolute; inset: 0; z-index: 5; display: none; }
.wz-cm.wz-cm-busy .wz-cm-shield { display: block; }
.wz-cm-note { position: absolute; left: 0; right: 0; top: 0; z-index: 4; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 8px 10px; background: #3a2a00; border-bottom: 1px solid #e0a800; color: #fff; font: 12px Arial, sans-serif; user-select: text; }
.wz-cm-note[hidden] { display: none; }
.wz-cm-note span { flex: 1 1 260px; }
.wz-cm-resize { position: absolute; z-index: 6; touch-action: none; }
.wz-cm-resize-n, .wz-cm-resize-s { left: 8px; right: 8px; height: 7px; cursor: ns-resize; }
.wz-cm-resize-n { top: -4px; } .wz-cm-resize-s { bottom: -4px; }
.wz-cm-resize-e, .wz-cm-resize-w { top: 8px; bottom: 8px; width: 7px; cursor: ew-resize; }
.wz-cm-resize-e { right: -4px; } .wz-cm-resize-w { left: -4px; }
.wz-cm-resize-ne, .wz-cm-resize-nw, .wz-cm-resize-se, .wz-cm-resize-sw { width: 14px; height: 14px; }
.wz-cm-resize-ne { top: -5px; right: -5px; cursor: nesw-resize; } .wz-cm-resize-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.wz-cm-resize-nw { top: -5px; left: -5px; cursor: nwse-resize; } .wz-cm-resize-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
#wz-cardmaker-btn img { width: 18px; height: 18px; image-rendering: pixelated; vertical-align: -4px; }
#wz-cardmaker-btn a[aria-pressed="true"] img { filter: drop-shadow(0 0 3px #fff); }
`;

export function injectCardMakerStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}
