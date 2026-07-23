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
// from the previous implementation, so packages/misc/index.js does
// not need to change other than its import path - see the note at
// the bottom of this file.

import { buildNotepadShell } from "./widget.js";
import { createDrawingSurface } from "./canvas.js";
import { buildColorPicker } from "./color-wheel.js";
import { clearSavedPosition, clearSavedDrawing } from "./storage.js";

const DEFAULT_THICKNESS = 5;

let mounted = null; // { root, controller } | null

export function showNotepad() {
  if (mounted) return;
  injectStyle();

  const controller = new AbortController();
  const { signal } = controller;

  const { root, body, headerButtons } = buildNotepadShell(signal);
  const surface = createDrawingSurface();

  let currentTool = "draw"; // "draw" | "erase"
  let currentThickness = DEFAULT_THICKNESS;
  let currentPenColor = "rgb(26, 26, 26)";
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
    initialHue: 0,
    initialSaturation: 0,
    initialLightness: 0.1,
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

  colorColumn.append(colorLabel, picker.element, applyPenBtn, applyBgBtn);
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
    currentPenColor = pendingColor;
    colorIndicator.style.background = pendingColor;
    surface.setStrokeColor(pendingColor);
  }, { signal });

  applyBgBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  applyBgBtn.addEventListener("click", () => surface.setBackgroundColor(pendingColor), { signal });

  clearBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  clearBtn.addEventListener("click", () => surface.clear(), { signal });

  saveBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
  saveBtn.addEventListener("click", () => surface.downloadAsPng(), { signal });

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
  console.log("[Wizascript] Notepad forcibly reset - drawing and position cleared.");
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
  z-index: 8;
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
`;

// NOTE: if packages/misc/index.js does `import { showNotepad, hideNotepad,
// forceResetNotepad } from "./notepad.js"`, update that path to
// "./notepad/index.js" (or "./notepad" if your bundler resolves
// directory imports to index.js automatically - esbuild does this by
// default, so "./notepad" alone should already work).
