// The Notepad They Said Was Fine - a lighthearted callback to the
// "pen and paper / notepad files" defense given during the moderation
// discussion. Deliberately the least "smart" thing in the whole suite:
// a canvas the player draws on directly by hand, with a select-toggle
// tool model - pick "Draw" or "Erase" once, then press-and-hold left
// click on the canvas itself to draw/erase along the cursor's path,
// release to stop. No calculation, no game-event hooking, no
// automation of any kind.
//
// Position persists via the same always-on store every other tracker
// uses (registry.js's getSavedPosition/setSavedPosition), reusing a
// fixed key rather than a registered preset id, since this isn't a
// picker-listed preset - it's directly controlled by its own setting.
// The DRAWING itself also persists (as a saved PNG data URL) and is
// deliberately never auto-cleared, including on close - only the
// user's own "Clear" button or eraser strokes ever remove anything.
//
// IMPORTANT: the background color is painted directly onto the
// canvas's own pixel buffer, not just set via CSS - confirmed that a
// CSS-only background would export as transparent via toDataURL(),
// not the visible color, since canvas.toDataURL() only ever reflects
// actual pixel data, never page styling layered behind it. This also
// means the eraser tool paints with the CURRENT background color
// rather than using clearRect (which would punch a transparent hole
// straight through to the page behind it, not restore the paper
// color).

import { getSavedPosition, setSavedPosition } from "./registry.js";

const POSITION_KEY = "notepad";
const DRAWING_STORAGE_KEY = "wizascript.decktracker.notepadDrawing";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
const DEFAULT_THICKNESS = 5;
const DEFAULT_BACKGROUND = "#fffef8";

// Shared between the pen palette and the background palette - ROYGBIV
// plus Black and White, per the user's request.
const COLORS = {
  Black: "#1a1a1a",
  White: "#ffffff",
  Red: "#e53935",
  Orange: "#fb8c00",
  Yellow: "#f2c200",
  Green: "#43a047",
  Blue: "#2255cc",
  Indigo: "#3f51b5",
  Violet: "#8e24aa"
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
  display: flex;
  gap: 6px;
}
.wizascript-notepad-main-column {
  display: flex;
  flex-direction: column;
}
.wizascript-notepad-canvas {
  border: 1px solid #d8cbb0;
  display: block;
  cursor: crosshair !important;
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
.wizascript-notepad-bg-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 2px;
}
.wizascript-notepad-bg-label {
  font-size: 9px;
  color: #6b5a42;
  text-align: center;
  margin-bottom: 2px;
}
.wizascript-notepad-bg-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.3);
  cursor: pointer;
}
.wizascript-notepad-bg-swatch.active {
  outline: 2px solid #2255cc;
  outline-offset: 1px;
}
.wizascript-notepad-color-popup {
  position: fixed;
  z-index: 100002;
  background: #fff;
  border: 1px solid #999;
  border-radius: 5px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function saveDrawing(canvasEl) {
  try {
    GM_setValue(DRAWING_STORAGE_KEY, canvasEl.toDataURL("image/png"));
  } catch (e) {
    // Non-critical - worst case the drawing just doesn't persist this time.
  }
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
  let currentPenColor = COLORS.Black;
  let backgroundColor = DEFAULT_BACKGROUND;
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

  const mainColumn = document.createElement("div");
  mainColumn.className = "wizascript-notepad-main-column";

  // ---- toolbar: draw/erase select-toggle, color indicator, size slider ----
  const toolbar = document.createElement("div");
  toolbar.className = "wizascript-notepad-toolbar";

  const drawBox = document.createElement("div");
  drawBox.className = "wizascript-notepad-tool-box active";
  drawBox.textContent = "Draw";
  const colorIndicator = document.createElement("span");
  colorIndicator.className = "wizascript-notepad-color-indicator";
  colorIndicator.style.background = currentPenColor;
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

  // Native cursor hidden entirely over the canvas - a custom indicator
  // (below) is drawn instead, guaranteed to match the exact same
  // coordinates the drawing code itself uses, eliminating any
  // possible mismatch between "where the cursor looks like it is" and
  // "where the mark actually appears" - confirmed via screenshot that
  // the native crosshair's hotspot and the actual drawn point didn't
  // visually line up.
  canvas.style.cursor = "none";

  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.position = "relative";
  canvasWrapper.style.width = CANVAS_WIDTH + "px";
  canvasWrapper.style.height = CANVAS_HEIGHT + "px";

  const cursorIndicator = document.createElement("div");
  cursorIndicator.style.position = "absolute";
  cursorIndicator.style.pointerEvents = "none";
  cursorIndicator.style.borderRadius = "50%";
  cursorIndicator.style.border = "1.5px solid rgba(0,0,0,0.75)";
  cursorIndicator.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.7)"; // faint outer ring, keeps it visible on dark backgrounds too
  cursorIndicator.style.transform = "translate(-50%, -50%)"; // centers the indicator ON the coordinate, rather than top-left aligning it there
  cursorIndicator.style.display = "none";

  canvasWrapper.append(canvas, cursorIndicator);

  mainColumn.append(toolbar, canvasWrapper);

  // ---- background color strip (right side) ----
  const bgColumn = document.createElement("div");
  bgColumn.className = "wizascript-notepad-bg-column";
  const bgLabel = document.createElement("div");
  bgLabel.className = "wizascript-notepad-bg-label";
  bgLabel.textContent = "Paper";
  bgColumn.appendChild(bgLabel);

  const bgSwatches = {};
  Object.entries(COLORS).forEach(([name, hex]) => {
    const swatch = document.createElement("div");
    swatch.className = "wizascript-notepad-bg-swatch";
    swatch.style.background = hex;
    swatch.title = name;
    if (hex.toLowerCase() === DEFAULT_BACKGROUND.toLowerCase()) {
      swatch.classList.add("active");
    }
    swatch.addEventListener("click", () => changeBackground(hex));
    bgSwatches[hex] = swatch;
    bgColumn.appendChild(swatch);
  });

  body.append(mainColumn, bgColumn);
  widget.append(header, body);
  document.body.appendChild(widget);

  // Fills the ENTIRE canvas pixel buffer with the background color -
  // not just a CSS property, since toDataURL() only ever reflects
  // real pixel data.
  function paintBackground(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Replaces every pixel currently matching the OLD background color
  // with the new one, leaving any actual drawing (any other color)
  // untouched - lets you switch paper color without losing what's
  // already been drawn. The one accepted edge case: a stroke drawn in
  // the exact same color as the current background would be
  // indistinguishable from background and get swapped too - but since
  // it wasn't visible against that background anyway, this doesn't
  // lose anything the user could actually see.
  function changeBackground(newColor) {
    if (newColor === backgroundColor) return;

    const oldRgb = hexToRgb(backgroundColor);
    const newRgb = hexToRgb(newColor);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Tolerance range rather than an exact match - stroke edges
    // (round line caps especially) are anti-aliased, meaning the
    // pixels right at an eraser or pen stroke's boundary are a BLEND
    // with the background, not pure background color. An exact match
    // would skip those blended pixels entirely, leaving a faint ring
    // of the OLD background color surviving right at every stroke
    // edge - confirmed by the user as visible remnants after
    // switching paper color.
    const TOLERANCE = 40;

    for (let i = 0; i < data.length; i += 4) {
      const dr = Math.abs(data[i] - oldRgb.r);
      const dg = Math.abs(data[i + 1] - oldRgb.g);
      const db = Math.abs(data[i + 2] - oldRgb.b);
      if (dr <= TOLERANCE && dg <= TOLERANCE && db <= TOLERANCE) {
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (bgSwatches[backgroundColor]) bgSwatches[backgroundColor].classList.remove("active");
    backgroundColor = newColor;
    if (bgSwatches[backgroundColor]) bgSwatches[backgroundColor].classList.add("active");

    saveDrawing(canvas);
  }

  // Loads the saved PNG directly if one exists - it already includes
  // whatever background color was active last time, since the whole
  // canvas (background + drawing) is saved as one flat image. Falls
  // back to a fresh, plain-background fill for a genuinely first-ever
  // use.
  function loadDrawing() {
    let saved;
    try {
      saved = GM_getValue(DRAWING_STORAGE_KEY, null);
    } catch (e) {
      saved = null;
    }

    if (!saved) {
      paintBackground(backgroundColor);
      return;
    }

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.onerror = () => paintBackground(backgroundColor);
    img.src = saved;
  }

  loadDrawing();
  bindWidgetDrag(widget, header);

  function selectTool(tool) {
    currentTool = tool;
    drawBox.classList.toggle("active", tool === "draw");
    eraseBox.classList.toggle("active", tool === "erase");
    updateCursorIndicatorSize();
  }

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function useAt(x, y) {
    // Both tools now use the same connected-line stroke technique -
    // the eraser previously stamped an isolated square at each point
    // (fillRect), which left visible gaps between stamps on a fast
    // drag since nothing connected consecutive points the way the
    // pen's line does. Stroking a line for both eliminates that
    // entirely, same as it already worked correctly for the pen.
    const isErase = currentTool === "erase";
    const size = isErase ? currentThickness * 2.2 : currentThickness; // eraser reads chunkier than the pen at the same slider value
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = isErase ? backgroundColor : currentPenColor;
    ctx.beginPath();
    ctx.moveTo(lastX ?? x, lastY ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
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

  function updateCursorIndicatorSize() {
    const size = currentTool === "erase" ? currentThickness * 2.2 : currentThickness;
    cursorIndicator.style.width = size + "px";
    cursorIndicator.style.height = size + "px";
  }

  canvas.addEventListener("mouseenter", () => {
    cursorIndicator.style.display = "block";
    updateCursorIndicatorSize();
  });

  canvas.addEventListener("mouseleave", () => {
    cursorIndicator.style.display = "none";
  });

  canvas.addEventListener("mousemove", e => {
    const pt = getCanvasPoint(e);
    cursorIndicator.style.left = pt.x + "px";
    cursorIndicator.style.top = pt.y + "px";
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
        currentPenColor = hex;
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
    updateCursorIndicatorSize();
  });

  clearBtn.addEventListener("mousedown", e => e.stopPropagation());
  clearBtn.addEventListener("click", () => {
    paintBackground(backgroundColor);
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
