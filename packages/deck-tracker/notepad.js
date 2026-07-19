// The Notepad They Said Was Fine - a lighthearted callback to the
// "pen and paper / notepad files" defense given during the moderation
// discussion. Deliberately the least "smart" thing in the whole suite:
// a canvas the player draws on directly by hand, with a select-toggle
// tool model rather than a drag-around one - pick "Draw" or "Erase"
// once, then press-and-hold left click on the canvas itself to
// draw/erase along the cursor's path, release to stop. No
// calculation, no game-event hooking, no automation of any kind.
//
// Position persists via the same always-on store every other tracker
// uses (registry.js's getSavedPosition/setSavedPosition), reusing a
// fixed key rather than a registered preset id, since this isn't a
// picker-listed preset - it's directly controlled by its own setting.
// The DRAWING itself also persists (as a saved PNG data URL) and is
// deliberately never auto-cleared, including on close - only the
// user's own "Clear" button or eraser strokes ever remove anything.
//
// Color and brush size are both live, on-widget controls rather than
// settings - right-click "Draw" for a 5-color palette (Black, White,
// Red, Blue, Yellow), and a slider directly on the widget for size,
// applying to whichever tool (draw/erase) is currently selected.

import { getSavedPosition, setSavedPosition } from "./registry.js";

const POSITION_KEY = "notepad";
const DRAWING_STORAGE_KEY = "wizascript.decktracker.notepadDrawing";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
const DEFAULT_THICKNESS = 5;

const COLORS = {
  Black: "#1a1a1a",
  White: "#ffffff",
  Red: "#e53935",
  Blue: "#2255cc",
  Yellow: "#f2c200"
};

let widgetEl = null;
let colorPopupEl = null;

function injectStyle() {
  if (document.getElementById("wizascript-notepad-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-notepad-style";
  style.textContent = `
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
}
.wizascript-notepad-canvas {
  background: #fffef8;
  border: 1px solid #d8cbb0;
  display: block;
  cursor: crosshair;
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
  min-width: 60px;
}
.wizascript-notepad-color-popup {
  position: fixed;
  z-index: 100002;
  background: #fff;
  border: 1px solid #999;
  border-radius: 5px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  padding: 6px;
  display: flex;
  gap: 5px;
}
.wizascript-notepad-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.3);
  cursor: pointer;
}
`;
  document.head.appendChild(style);
}

function saveDrawing(canvasEl) {
  try {
    GM_setValue(DRAWING_STORAGE_KEY, canvasEl.toDataURL("image/png"));
  } catch (e) {
    // Non-critical - worst case the drawing just doesn't persist this time.
  }
}

function loadDrawing(canvasEl, ctx) {
  let saved;
  try {
    saved = GM_getValue(DRAWING_STORAGE_KEY, null);
  } catch (e) {
    return;
  }
  if (!saved) return;

  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = saved;
}

function downloadAsPng(canvasEl) {
  const link = document.createElement("a");
  link.download = "notepad-doodle.png";
  link.href = canvasEl.toDataURL("image/png");
  link.click();
}

function closeColorPopup() {
  if (colorPopupEl) {
    colorPopupEl.remove();
    colorPopupEl = null;
  }
}

function bindWidgetDrag(widget, header) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", e => {
    dragging = true;
    const rect = widget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    header.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    widget.style.left = (e.clientX - offsetX) + "px";
    widget.style.top = (e.clientY - offsetY) + "px";
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = "grab";
    const rect = widget.getBoundingClientRect();
    setSavedPosition(POSITION_KEY, { left: rect.left, top: rect.top });
  });
}

export function showNotepad() {
  if (widgetEl) return; // already open

  injectStyle();

  let currentTool = "draw"; // "draw" | "erase"
  let currentColor = COLORS.Black;
  let currentThickness = DEFAULT_THICKNESS;
  let drawing = false;
  let lastX = null;
  let lastY = null;

  const widget = document.createElement("div");
  widget.className = "wizascript-notepad";

  const savedLayout = getSavedPosition(POSITION_KEY);
  if (savedLayout) {
    widget.style.left = savedLayout.left + "px";
    widget.style.top = savedLayout.top + "px";
  } else {
    widget.style.right = "16px";
    widget.style.bottom = "16px";
  }

  const header = document.createElement("div");
  header.className = "wizascript-notepad-header";
  header.innerHTML = `<span>Notepad</span>`;

  const headerButtons = document.createElement("span");
  headerButtons.className = "wizascript-notepad-header-buttons";
  const clearBtn = document.createElement("span");
  clearBtn.textContent = "Clear";
  const saveBtn = document.createElement("span");
  saveBtn.textContent = "Save PNG";
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  headerButtons.append(clearBtn, saveBtn, closeBtn);
  header.appendChild(headerButtons);

  const body = document.createElement("div");
  body.className = "wizascript-notepad-body";

  // ---- toolbar: draw/erase select-toggle, color indicator, size slider ----
  const toolbar = document.createElement("div");
  toolbar.className = "wizascript-notepad-toolbar";

  const drawBox = document.createElement("div");
  drawBox.className = "wizascript-notepad-tool-box active";
  drawBox.textContent = "Draw";
  const colorIndicator = document.createElement("span");
  colorIndicator.className = "wizascript-notepad-color-indicator";
  colorIndicator.style.background = currentColor;
  drawBox.appendChild(colorIndicator);
  drawBox.title = "Left-click to select. Right-click to change color.";

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

  // ---- canvas ----
  const canvas = document.createElement("canvas");
  canvas.className = "wizascript-notepad-canvas";
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");

  body.append(toolbar, canvas);
  widget.append(header, body);
  document.body.appendChild(widget);

  loadDrawing(canvas, ctx);
  bindWidgetDrag(widget, header);

  function selectTool(tool) {
    currentTool = tool;
    drawBox.classList.toggle("active", tool === "draw");
    eraseBox.classList.toggle("active", tool === "erase");
  }

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function useAt(x, y) {
    if (currentTool === "erase") {
      const size = currentThickness * 2.2; // eraser reads as chunkier than the pen at the same slider value
      ctx.clearRect(x - size / 2, y - size / 2, size, size);
    } else {
      ctx.lineWidth = currentThickness;
      ctx.lineCap = "round";
      ctx.strokeStyle = currentColor;
      ctx.beginPath();
      ctx.moveTo(lastX ?? x, lastY ?? y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastX = x;
    lastY = y;
  }

  canvas.addEventListener("mousedown", e => {
    if (e.button !== 0) return; // left click only
    drawing = true;
    const pt = getCanvasPoint(e);
    lastX = pt.x;
    lastY = pt.y;
    useAt(pt.x, pt.y); // marks a single dot even on a plain click, no drag needed
  });

  document.addEventListener("mousemove", e => {
    if (!drawing) return;
    const pt = getCanvasPoint(e);
    useAt(pt.x, pt.y);
  });

  document.addEventListener("mouseup", () => {
    if (!drawing) return;
    drawing = false;
    lastX = null;
    lastY = null;
    saveDrawing(canvas);
  });

  drawBox.addEventListener("click", () => selectTool("draw"));
  eraseBox.addEventListener("click", () => selectTool("erase"));

  drawBox.addEventListener("contextmenu", e => {
    e.preventDefault();
    closeColorPopup();

    const popup = document.createElement("div");
    popup.className = "wizascript-notepad-color-popup";
    popup.style.left = e.clientX + "px";
    popup.style.top = e.clientY + "px";

    Object.entries(COLORS).forEach(([name, hex]) => {
      const swatch = document.createElement("div");
      swatch.className = "wizascript-notepad-color-swatch";
      swatch.style.background = hex;
      swatch.title = name;
      swatch.addEventListener("click", ev => {
        ev.stopPropagation();
        currentColor = hex;
        colorIndicator.style.background = hex;
        closeColorPopup();
      });
      popup.appendChild(swatch);
    });

    document.body.appendChild(popup);
    colorPopupEl = popup;

    setTimeout(() => {
      document.addEventListener("click", closeColorPopup, { once: true });
    }, 0);
  });

  sizeSlider.addEventListener("input", () => {
    currentThickness = Number(sizeSlider.value);
  });

  clearBtn.addEventListener("mousedown", e => e.stopPropagation());
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveDrawing(canvas);
  });

  saveBtn.addEventListener("mousedown", e => e.stopPropagation());
  saveBtn.addEventListener("click", () => downloadAsPng(canvas));

  closeBtn.addEventListener("mousedown", e => e.stopPropagation());
  closeBtn.addEventListener("click", () => hideNotepad());

  widgetEl = widget;
}

export function hideNotepad() {
  closeColorPopup();
  if (!widgetEl) return;
  widgetEl.remove();
  widgetEl = null;
}

export function isNotepadOpen() {
  return widgetEl !== null;
}
