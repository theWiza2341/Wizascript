// packages/misc/tier-list/styles.js
//
// All Tier List Maker CSS, injected once. Sizes hang off one variable,
// --wz-tl-tile (set by window.js from the window width and the "Card
// Size" setting), so the whole layout scales together.

const STYLE_ID = "wizascript-tierlist-style";

// Above everything on the page except the Notepad (2147483000), which
// is small and should stay reachable on top of a maximised tier list.
export const Z_WINDOW = 2147482000;
export const Z_FLOATING = 2147483100; // card preview, drag ghost

export function injectTierListStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}

const CSS = `
.wz-tl {
  --wz-tl-tile: 72px;
  --wz-tl-tile-h: calc(var(--wz-tl-tile) * 0.8);
  --wz-tl-label: max(56px, var(--wz-tl-tile));
  position: fixed;
  z-index: ${Z_WINDOW};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #0d0d0d;
  color: #fff;
  border: 2px solid #fff;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.7);
  font-family: Arial, sans-serif;
  font-size: 12px;
  user-select: none;
}
.wz-tl *, .wz-tl *::before, .wz-tl *::after { box-sizing: border-box; }
/* Window Opacity setting: see-through only while the mouse is elsewhere
   (and never mid-drag or with a menu/editor open), so it stays readable
   while you use it. */
.wz-tl { opacity: var(--wz-tl-opacity, 1); transition: opacity 0.15s; }
.wz-tl:hover, .wz-tl:focus-within, .wz-tl.wz-tl-busy, .wz-tl.wz-tl-pad { opacity: 1; }
/* Controller d-pad mode: the highlighted item (colour = Controller
   Support's "Selection Outline Color"), drawn inside the element so
   scrolling containers don't clip it. */
.wz-tl .wz-tl-pad-focus {
  outline: 3px solid var(--wz-tl-pad-color, #3ea6ff) !important;
  outline-offset: -3px;
  box-shadow: 0 0 8px var(--wz-tl-pad-color, #3ea6ff);
}
.wz-tl .wz-tl-row-items.wz-tl-pad-focus { outline-offset: -2px; }
.wz-tl .wz-tl-tile.wz-tl-pad-held { opacity: 0.45; outline: 2px dashed #fff; outline-offset: -3px; }
.wz-tl .wz-tl-tile.wz-tl-pad-held.wz-tl-pad-focus { opacity: 0.7; }
.wz-tl-send {
  position: absolute;
  z-index: 7;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 90px;
  max-height: calc(100% - 8px);
  overflow-y: auto;
  padding: 5px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background: #1c1c1c;
  box-shadow: 0 4px 14px rgba(0,0,0,0.7);
}
.wz-tl-send-title { color: #bbb; font-size: 11px; text-align: center; }
.wz-tl-send-tier {
  min-height: 24px;
  padding: 2px 8px;
  border: 1px solid #000;
  border-radius: 3px;
  color: #000;
  font: bold 13px Arial, sans-serif;
  cursor: pointer;
}
.wz-tl-send-tier.wz-tl-active::after { content: "  \\2713"; }
/* Show Names on Tiles = off. Text items keep their label (it IS the tile). */
.wz-tl-nonames .wz-tl-tile:not(.wz-tl-text) .wz-tl-tile-name,
.wz-tl-ghost.wz-tl-nonames:not(.wz-tl-text) .wz-tl-tile-name { display: none; }
.wz-tl.wz-tl-max { left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; border-radius: 0; }
.wz-tl.wz-tl-max .wz-tl-resize { display: none; }

.wz-tl-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #222;
  border-bottom: 1px solid #555;
  cursor: grab;
  touch-action: none;
}
.wz-tl.wz-tl-max .wz-tl-header { cursor: default; }
.wz-tl-grip { flex: 1 1 auto; min-width: 16px; align-self: stretch; }
.wz-tl-title {
  flex: 0 1 220px;
  min-width: 60px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #fff;
  font: bold 13px Arial, sans-serif;
  padding: 2px 4px;
  outline: none;
  text-overflow: ellipsis;
}
.wz-tl-title:hover, .wz-tl-title:focus { border-color: #666; background: rgba(255,255,255,0.06); }
.wz-tl-btn {
  flex: none;
  padding: 2px 7px;
  border: 1px solid #777;
  border-radius: 3px;
  background: #333;
  color: #fff;
  font: 12px Arial, sans-serif;
  line-height: 16px;
  cursor: pointer;
  white-space: nowrap;
}
.wz-tl-btn:hover { background: #444; border-color: #aaa; }
.wz-tl-btn:disabled { opacity: 0.35; cursor: default; background: #333; border-color: #777; }
.wz-tl-btn.wz-tl-active { background: #4464bd; border-color: #8ea6e8; }
.wz-tl-btn.wz-tl-danger { background: #8b1e1e; border-color: #e05555; }

.wz-tl-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden; }

.wz-tl-tiers { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.wz-tl-row { display: flex; align-items: stretch; border-bottom: 1px solid #000; background: #1a1a1a; }
.wz-tl-row-label {
  flex: none;
  width: var(--wz-tl-label);
  min-height: calc(var(--wz-tl-tile-h) + 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: #000;
  font-weight: bold;
  font-size: max(12px, calc(var(--wz-tl-tile) * 0.22));
  text-align: center;
  word-break: break-word;
  cursor: pointer;
}
.wz-tl-row-items {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 3px;
  padding: 3px;
  min-height: calc(var(--wz-tl-tile-h) + 6px);
}
.wz-tl-row-tools {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 1px 3px;
  background: #000;
}
.wz-tl-row-tools button {
  width: 20px;
  height: 15px;
  padding: 0;
  border: 1px solid #555;
  border-radius: 3px;
  background: #222;
  color: #ddd;
  font-size: 9px;
  line-height: 13px;
  cursor: pointer;
}
.wz-tl-row-tools button:hover { background: #3a3a3a; color: #fff; }
.wz-tl-add-row { display: block; margin: 6px auto; }

.wz-tl-tile {
  position: relative;
  flex: none;
  width: var(--wz-tl-tile);
  height: var(--wz-tl-tile-h);
  border: 2px solid var(--wz-tl-rarity, #888);
  border-radius: 3px;
  background: #000 center / contain no-repeat;
  image-rendering: pixelated;
  cursor: grab;
  touch-action: none;
  overflow: hidden;
}
.wz-tl-tile-name {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 1px 2px;
  background: rgba(0,0,0,0.72);
  color: #fff;
  font-size: max(9px, calc(var(--wz-tl-tile) * 0.12));
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.wz-tl-tile.wz-tl-noimg .wz-tl-tile-name { top: 0; display: flex; align-items: center; justify-content: center; white-space: normal; }
.wz-tl-tile.wz-tl-placed { opacity: 0.35; }
.wz-tl-tile.wz-tl-placed::after {
  content: "\\2713";
  position: absolute;
  top: 1px; right: 3px;
  color: #7fff7f;
  font-weight: bold;
  font-size: 12px;
  text-shadow: 0 0 2px #000;
}
.wz-tl-tile.wz-tl-dragging { opacity: 0.25; }
.wz-tl-marker {
  flex: none;
  width: 4px;
  height: var(--wz-tl-tile-h);
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 0 6px #8ea6e8;
}
.wz-tl-ghost {
  position: fixed;
  z-index: ${Z_FLOATING};
  pointer-events: none;
  opacity: 0.9;
  transform: rotate(-3deg);
  box-shadow: 0 6px 16px rgba(0,0,0,0.7);
}
.wz-tl-ghost.wz-tl-ghost-remove { opacity: 0.55; filter: grayscale(1); }
.wz-tl-ghost.wz-tl-ghost-remove::before {
  content: "\\00D7";
  position: absolute;
  z-index: 1;
  top: 1px; right: 3px;
  color: #ff6b6b;
  font: bold 16px Arial, sans-serif;
  text-shadow: 0 0 3px #000;
}
.wz-tl-picker.wz-tl-drop-in { background: #1b2238; }

.wz-tl-picker {
  flex: 0 1 auto;
  max-height: 60%;
  transition: background 0.1s;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 2px solid #555;
  background: #141414;
}
.wz-tl-picker.wz-tl-hidden { display: none; }
.wz-tl-filters { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 5px 6px; }
.wz-tl-search-row { flex: none; display: flex; gap: 4px; }
.wz-tl-search-row input {
  flex: none;
  width: 150px;
  height: 26px;
  padding: 2px 6px;
  border: 1px solid #666;
  border-radius: 3px;
  background: #000;
  color: #fff;
  font: 12px Arial, sans-serif;
}
.wz-tl-card-toggles { display: contents; }
.wz-tl-type-tabs { flex: none; display: flex; border: 1px solid #555; border-radius: 4px; overflow: hidden; }
.wz-tl-type-tab {
  height: 26px;
  padding: 0 7px;
  border: none;
  border-right: 1px solid #555;
  background: #1c1c1c;
  color: #bbb;
  font: 12px Arial, sans-serif;
  cursor: pointer;
}
.wz-tl-type-tab:last-child { border-right: none; }
.wz-tl-type-tab:hover { background: #2a2a2a; color: #fff; }
.wz-tl-type-tab.wz-tl-active { background: #4464bd; color: #fff; }
.wz-tl-tile-del {
  position: absolute;
  z-index: 2;
  top: 1px; left: 1px;
  width: 16px; height: 16px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: rgba(0,0,0,0.75);
  color: #ff8080;
  font: bold 13px/16px Arial, sans-serif;
  cursor: pointer;
}
.wz-tl-tile-del:hover { background: #8b1e1e; color: #fff; }
.wz-tl-tile.wz-tl-text { background: #262626; }
/* Soul sprites are much bigger than card art for their content - shrink
   them so the heart sits above the name instead of filling the tile. */
.wz-tl-results .wz-tl-tile.wz-tl-text .wz-tl-tile-name { padding-top: 16px; }
.wz-tl-tile.wz-tl-soul { background-size: auto 46%; background-position: center 30%; }
/* While a dialog (Settings, Share / Import) or UnderScript's Esc menu
   (z-index 1010) is open, sit under it. */
.wz-tl.wz-tl-under-modal { z-index: 1000; }
.wz-tl-tile.wz-tl-text .wz-tl-tile-name { background: transparent; font-weight: bold; padding: 2px; line-height: 1.1; word-break: break-word; }
.wz-tl-tile.wz-tl-text .wz-tl-tile-name input {
  width: 100%;
  border: 1px solid #8ea6e8;
  background: #000;
  color: #fff;
  font: inherit;
  text-align: center;
  pointer-events: auto;
}
.wz-tl-toggle-group { flex: none; display: flex; gap: 2px; padding: 1px; border-radius: 4px; background: rgba(255,255,255,0.05); }
.wz-tl-toggle {
  height: 26px;
  min-width: 26px;
  padding: 2px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  opacity: 0.45;
  filter: grayscale(0.7);
}
.wz-tl-toggle img { max-height: 20px; max-width: 32px; image-rendering: pixelated; pointer-events: none; }
.wz-tl-toggle:hover { opacity: 0.8; filter: none; }
.wz-tl-toggle.wz-tl-on { opacity: 1; filter: none; border-color: #fff; background: rgba(68,100,189,0.55); }
.wz-tl-toggle-text { color: #fff; font: bold 10px Arial, sans-serif; }
.wz-tl-results { flex: 0 1 auto; height: calc(var(--wz-tl-tile-h) * 2 + 9px); min-height: min(calc(var(--wz-tl-tile-h) + 6px), 40px); overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 3px; padding: 0 6px 6px; }
.wz-tl-hint { flex: none; padding: 0 8px 4px; color: #aaa; font-size: 12px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.wz-tl-resize { position: absolute; z-index: 2; touch-action: none; }
.wz-tl-resize-n, .wz-tl-resize-s { left: 8px; right: 8px; height: 7px; cursor: ns-resize; }
.wz-tl-resize-n { top: -4px; }
.wz-tl-resize-s { bottom: -4px; }
.wz-tl-resize-e, .wz-tl-resize-w { top: 8px; bottom: 8px; width: 7px; cursor: ew-resize; }
.wz-tl-resize-e { right: -4px; }
.wz-tl-resize-w { left: -4px; }
.wz-tl-resize-ne, .wz-tl-resize-nw, .wz-tl-resize-se, .wz-tl-resize-sw { width: 14px; height: 14px; }
.wz-tl-resize-ne { top: -5px; right: -5px; cursor: nesw-resize; }
.wz-tl-resize-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.wz-tl-resize-nw { top: -5px; left: -5px; cursor: nwse-resize; }
.wz-tl-resize-se { bottom: -5px; right: -5px; cursor: nwse-resize; }

.wz-tl-editor {
  position: absolute;
  z-index: 5;
  width: 230px;
  max-width: calc(100% - 12px);
  padding: 8px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background: #1c1c1c;
  box-shadow: 0 4px 14px rgba(0,0,0,0.7);
}
.wz-tl-editor input[type="text"] {
  width: 100%;
  margin-bottom: 6px;
  padding: 3px 5px;
  border: 1px solid #666;
  border-radius: 3px;
  background: #000;
  color: #fff;
  font: 13px Arial, sans-serif;
}
.wz-tl-swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; align-items: center; }
.wz-tl-swatch { width: 20px; height: 20px; border: 1px solid #000; border-radius: 3px; cursor: pointer; }
.wz-tl-swatch.wz-tl-active { box-shadow: 0 0 0 2px #fff; }
.wz-tl-swatches input[type="color"] { width: 24px; height: 22px; padding: 0; border: none; background: none; cursor: pointer; }
.wz-tl-editor-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.wz-tl-editor-buttons .wz-tl-btn { width: 100%; }

.wz-tl-menu {
  position: absolute;
  z-index: 6;
  min-width: 200px;
  width: 260px;
  max-width: calc(100% - 8px);
  max-height: 60%;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background: #1c1c1c;
  box-shadow: 0 4px 14px rgba(0,0,0,0.7);
}
.wz-tl-menu-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #ddd;
  font: 12px Arial, sans-serif;
  text-align: left;
  cursor: pointer;
}
.wz-tl-menu-item span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wz-tl-menu-item:hover { background: #2e2e2e; color: #fff; }
.wz-tl-menu-item.wz-tl-active { background: #4464bd; color: #fff; }
.wz-tl-menu-count { flex: none; opacity: 0.6; }
.wz-tl-menu-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #444; }
.wz-tl-preview {
  position: fixed;
  z-index: ${Z_FLOATING};
  pointer-events: none;
}
.wz-tl-preview-fallback {
  width: 200px;
  padding: 4px;
  border: 2px solid #fff;
  border-radius: 4px;
  background: #000;
  color: #fff;
  font: bold 13px Arial, sans-serif;
  text-align: center;
}
.wz-tl-preview-fallback div {
  height: 120px;
  margin-bottom: 4px;
  background: center / contain no-repeat;
  image-rendering: pixelated;
}
`;
