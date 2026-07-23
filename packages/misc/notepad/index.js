// packages/misc/notepad/index.js
//
// Wires the drawing surface (canvas.js), color picker (color-wheel.js)
// and shell/drag (widget.js) into the on-screen Notepad, and owns the
// single AbortController that scopes every listener a mount creates.
//
// Previously each of those three pieces bound its own permanent
// document-level listeners on every call to showNotepad(), with no
// way to remove them again - toggling the notepad off/on (or the
// force-reset hotkey) just kept adding more, on top of the previous
// generation's dead ones still running against detached DOM nodes.
// Routing everything through one controller here means
// hideNotepad()/forceResetNotepad() tear the whole thing down with a
// single controller.abort(), and a fresh show starts from a clean
// slate every time.
//
// Public API (showNotepad/hideNotepad/forceResetNotepad) is unchanged
// from the original single-file implementation - only its location
// moved (packages/misc/notepad.js -> packages/misc/notepad/index.js).

import { buildNotepadShell } from "./widget.js";
import { createDrawingSurface } from "./canvas.js";
import { buildColorPicker } from "./color-wheel.js";
import {
  clearSavedPosition, clearSavedDrawing,
  getSavedPenColor, setSavedPenColor, clearSavedPenColor,
  getRecentColors, clearRecentColors,
  clearSavedTitle
} from "./storage.js";
import { recordRecentColor, buildRecentColorsRow } from "./recent-colors.js";

const DEFAULT_THICKNESS = 5;

let mounted = null; // { root, controller } | null

// Strips characters that are invalid (or awkward) in filenames across
// Windows/macOS/Linux, collapses whitespace, and falls back to a
// sensible default for an empty/whitespace-only title.
function sanitizeFilename(rawTitle) {
  const cleaned = (rawTitle || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  return cleaned || "notepad-doodle";
}

export function showNotepad() {
  if (mounted) return;
  injectStyle();

  const controller = new AbortController();
  const { signal } = controller;

  const { root, body, headerButtons, titleInput } = buildNotepadShell(signal);
  const surface = createDrawingSurface();

  const DEFAULT_PEN_STATE = { hue: 0, saturation: 0, lightness: 0.1, color: "rgb(26, 26, 26)" };
  const savedPen = getSavedPenColor() ?? DEFAULT_PEN_STATE;

  let currentTool = "draw"; // "draw" | "erase"
  let currentThickness = DEFAULT_THICKNESS;
  let currentPenColor = savedPen.color;
  let pendingColor = currentPenColor;
  let drawing = false;
  surface.setStrokeColor(currentPenColor);

  // ---- header buttons ----
  const clearBtn = document.createElement("span");
  clearBtn.textContent = "Clear";
  const saveBtn = document.createElement("span");
  saveBtn.textContent = "Save PNG";
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "\u00D7";
  headerButtons.append(clearBtn, saveBtn, closeBtn);

  // ---- toolbar ----
  const mainColumn = document.createElement("div");
  mainColumn.className = "wizascript-notepad-main-column";
  const toolbar = document.createElement("div");
  toolbar.className = "wizascript-notepad-toolbar";

  const drawBox = document.createElement("div");
  drawBox.className = "wizascript-notepad-tool-box active";
  drawBox.title = "Click to select this tool.";
  const colorIndicator = document.createElement("span");
  colorIndicator.className = "wizascript-notepad-color-indicator";
  colorIndicator.style.background = currentPenColor;
  drawBox.append("Draw", colorIndicator);

  const eraseBox = document.createElement("div");
  eraseBox.className = "wizascript-notepad-tool-box";
  eraseBox.textContent = "Erase";

  const sizeSlider = document.createElement("input");
  sizeSlider.type = "range";
  sizeSlider.className = "wizascript-notepad-size-slider";
  sizeSlider.min = "1";
  sizeSlider.max = "30";
  sizeSlider.value = String(currentThickness);
  sizeSlider.title = "Brush size";

  toolbar.append(drawBox, eraseBox, sizeSlider);
  mainColumn.append(toolbar, surface.wrapper);

  // ---- color column ----
  const colorColumn = document.createElement("div");
  colorColumn.className = "wizascript-notepad-side-column";
  const colorLabel = document.createElement("div");
  colorLabel.className = "wizascript-notepad-side-label";
  colorLabel.textContent = "Color Picker";

  const picker = buildColorPicker({
    signal,
    initialHue: savedPen.hue,
    initialSaturation: savedPen.saturation,
    initialLightness: savedPen.lightness,
    onChange: (color) => { pendingColor = color; }
  });

  const applyPenBtn = document.createElement("button");
  applyPenBtn.type = "button";
  applyPenBtn.className = "wizascript-notepad-apply-btn";
  applyPenBtn.textContent = "Apply Pen Color";
  const applyBgBtn = document.createElement("button");
  applyBgBtn.type = "button";
  applyBgBtn.className = "wizascript-notepad-apply-btn";
  applyBgBtn.textContent = "Apply Paper Color";

  // Sets the active pen color (indicator, stroke color, persisted
  // state, and the recent-colors list) from a single { color, hue,
  // saturation, lightness } entry - shared by the "Apply Pen Color"
  // button and clicking a recent swatch, so both paths stay in sync.
  function applyPenColor(entry) {
    currentPenColor = entry.color;
    colorIndicator.style.background = entry.color;
    surface.setStrokeColor(entry.color);
    setSavedPenColor(entry);
    recentColorsRow.render(recordRecentColor(entry));
  }

  const recentColorsRow = buildRecentColorsRow({
    signal,
    onSelect: (entry) => {
      picker.setState(entry.hue, entry.saturation, entry.lightness);
      applyPenColor(entry);
    }
  });
  recentColorsRow.render(getRecentColors());

  colorColumn.append(colorLabel, picker.element, applyPenBtn, applyBgBtn, recentColorsRow.element);
  body.append(mainColumn, colorColumn);
  document.body.appendChild(root);

  // ---- tool selection ----
  function selectTool(tool) {
    currentTool = tool;
    drawBox.classList.toggle("active", tool === "draw");
    eraseBox.classList.toggle("active", tool === "erase");
    updateCursorIndicatorSize();
  }

  function updateCursorIndicatorSize() {
    const size = currentTool === "erase" ? currentThickness * 2.2 : currentThickness;
    surface.cursorIndicator.style.width = size + "px";
    surface.cursorIndicator.style.height = size + "px";
  }

  // ---- drawing interactions ----
  surface.inkCanvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    drawing = true;
    const pt = surface.getPointFromEvent(e);
    surface.beginStroke(pt.x, pt.y, { erase: currentTool === "erase", size: currentThickness });
  }, { signal });

  surface.inkCanvas.addEventListener("mouseenter", () => {
    surface.cursorIndicator.style.display = "block";
    updateCursorIndicatorSize();
  }, { signal });

  surface.inkCanvas.addEventListener("mouseleave", () => {
    surface.cursorIndicator.style.display = "none";
  }, { signal });

  surface.inkCanvas.addEventListener("mousemove", (e) => {
    const pt = surface.getPointFromEvent(e);
    surface.cursorIndicator.style.left = pt.x + "px";
    surface.cursorIndicator.style.top = pt.y + "px";
  }, { signal });

  document.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const pt = surface.getPointFromEvent(e);
    surface.strokeTo(pt.x, pt.y, { erase: currentTool === "erase", size: currentThickness });
  }, { signal });

  document.addEventListener("mouseup", () => {
    if (!drawing) return;
    drawing = false;
    surface.endStroke();
  }, { signal });

  // ---- toolbar / buttons ----
  drawBox.addEventListener("click", () => selectTool("draw"), { signal });
  eraseBox.addEventListener("click", () => selectTool("erase"), { signal });
  sizeSlider.addEventListener("input", () => {
    currentThickness = Number(sizeSlider.value);
    updateCursorIndicatorSize();
  }, { signal });

  applyPenBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  applyPenBtn.addEventListener("click", () => {
    applyPenColor({ color: pendingColor, ...picker.getState() });
  }, { signal });

  applyBgBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  applyBgBtn.addEventListener("click", () => surface.setBackgroundColor(pendingColor), { signal });

  clearBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  clearBtn.addEventListener("click", () => surface.clear(), { signal });

  saveBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  saveBtn.addEventListener("click", () => {
    // Read the input's live value rather than the debounced/persisted
    // one, so the exported filename always matches exactly what's
    // currently typed, even mid-debounce.
    surface.downloadAsPng(`${sanitizeFilename(titleInput.value)}.png`);
  }, { signal });

  closeBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  closeBtn.addEventListener("click", () => hideNotepad(), { signal });

  mounted = { root, controller };
}

export function hideNotepad() {
  if (!mounted) return;
  mounted.controller.abort(); // removes every listener bound in showNotepad(), in one shot
  mounted.root.remove();
  mounted = null;
}

export function forceResetNotepad() {
  hideNotepad();
  clearSavedPosition();
  clearSavedDrawing();
  clearSavedPenColor();
  clearRecentColors();
  clearSavedTitle();
  console.log("[Wizascript] Notepad forcibly reset - drawing, position, colors, and title cleared.");
}

function injectStyle() {
  if (document.getElementById("wizascript-notepad-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-notepad-style";
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);
}

const STYLE_CSS = `
.wizascript-notepad {
  position: fixed;
  /* Deliberately much higher than Deck Tracker's widgets (z-index 8).
     Those spawn over open board space and rarely get dragged, so a
     low z-index rarely collides with anything. The notepad is
     user-draggable to ANY point on screen, including under native
     Undercards chrome (menus, top bar, tooltips, etc.) that can sit
     above z-index 8 in some screen regions - which silently eats
     clicks on whatever notepad control happens to be underneath it,
     while areas that aren't covered (e.g. the canvas) keep working
     normally. A near-max z-index means the notepad wins that stacking
     fight regardless of where it's dropped. */
  z-index: 2147483000;
  background: #fdf6e3;
  border: 2px solid #8a7355;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  font-family: Arial, sans-serif;
  user-select: none;
}
.wizascript-notepad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background: #8a7355;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  cursor: grab;
  border-radius: 4px 4px 0 0;
}
.wizascript-notepad-header-buttons span {
  cursor: pointer;
  margin-left: 6px;
  font-size: 12px;
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
  padding: 1px 5px;
}
.wizascript-notepad-title-input {
  /* Fixed rather than flex:1 - the header previously let the
     focusable/drag-blocking area stretch all the way to the header
     buttons, which ate into the space meant for dragging the notepad
     around. ~72px roughly lines up with where "Erase" starts in the
     toolbar below - plenty of room for a short name without
     encroaching further. */
  flex: none;
  width: 72px;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  font-family: inherit;
  padding: 1px 2px;
  cursor: text;
  text-overflow: ellipsis;
}
.wizascript-notepad-title-input:hover,
.wizascript-notepad-title-input:focus {
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
}
.wizascript-notepad-body {
  padding: 8px;
  display: flex;
  gap: 6px;
}
.wizascript-notepad-main-column {
  display: flex;
  flex-direction: column;
}
.wizascript-notepad-canvas-wrapper {
  position: relative;
}
.wizascript-notepad-canvas {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px solid #d8cbb0;
  display: block;
}
.wizascript-notepad-canvas-bg {
  pointer-events: none;
}
.wizascript-notepad-canvas-ink {
  cursor: none;
}
.wizascript-notepad-cursor-indicator {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.75);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.7);
  transform: translate(-50%, -50%);
  display: none;
  z-index: 2;
}
.wizascript-notepad-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wizascript-notepad-tool-box {
  padding: 3px 10px;
  border: 2px solid #8a7355;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #5a4a35;
  background: #efe4cf;
  cursor: pointer;
}
.wizascript-notepad-tool-box.active {
  background: #d4a017;
  color: #fff;
  border-color: #a97e0f;
}
.wizascript-notepad-color-indicator {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  margin-left: 5px;
  vertical-align: middle;
}
.wizascript-notepad-size-slider {
  flex: 1;
  min-width: 50px;
}
.wizascript-notepad-side-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 108px;
}
.wizascript-notepad-side-label {
  font-size: 9px;
  color: #6b5a42;
}
.wizascript-notepad-colorpicker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.wizascript-notepad-wheel-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
}
.wizascript-notepad-wheel {
  border-radius: 50%;
  cursor: crosshair;
}
.wizascript-notepad-wheel-indicator {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.wizascript-notepad-lightness-row {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
}
.wizascript-notepad-lightness-label {
  font-size: 8px;
  color: #6b5a42;
}
.wizascript-notepad-lightness-slider {
  flex: 1;
  min-width: 40px;
}
.wizascript-notepad-color-preview {
  width: 100%;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.3);
}
.wizascript-notepad-apply-btn {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #8a7355;
  background: #efe4cf;
  color: #5a4a35;
  cursor: pointer;
  font-weight: bold;
  width: 100%;
}
.wizascript-notepad-recent-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  margin-top: 4px;
}
.wizascript-notepad-recent-colors {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}
.wizascript-notepad-recent-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.5);
  cursor: pointer;
}
`;
