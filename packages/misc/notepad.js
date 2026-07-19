// The Notepad They Said Was Fine - a lighthearted callback to the
// "pen and paper / notepad files" defense given during the moderation
// discussion. Deliberately the least "smart" thing in the whole suite:
// a canvas the player draws on directly by hand, with a select-toggle
// tool model - pick "Draw" or "Erase" once, then press-and-hold left
// click on the canvas itself to draw/erase along the cursor's path,
// release to stop. No calculation, no game-event hooking, no
// automation of any kind.
//
// Lives in the "misc" package (not deck-tracker) specifically so it
// persists and works OUTSIDE of matches too, not just Game/Spectate
// pages - deck-tracker gates its whole feature behind isGamePage(),
// which would have blocked the notepad from working anywhere else.
// This means position persistence is self-contained here (a small,
// dedicated GM_setValue-backed store) rather than importing from
// deck-tracker's registry.js, which would have created a cross-
// package dependency for no good reason.
//
// Color selection is a full hue/saturation wheel plus a separate
// lightness slider (HSL), rather than a fixed palette - lets the user
// reach genuine tints (like pink) and shades that a discrete swatch
// set can't represent, at the cost of being a bit more involved to
// use than clicking a preset color.
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

const POSITION_STORAGE_KEY = "wizascript.misc.notepadPosition";
const DRAWING_STORAGE_KEY = "wizascript.misc.notepadDrawing";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
const DEFAULT_THICKNESS = 5;
const DEFAULT_BACKGROUND = "rgb(255, 254, 248)";

const WHEEL_SIZE = 96;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_FIXED_LIGHTNESS = 0.5; // the wheel itself always renders at 50% lightness for visual consistency/recognizability; the separate slider controls the ACTUAL lightness used

let widgetEl = null;

// ---- self-contained position persistence (no deck-tracker dependency) ----

function getSavedPosition() {
  try {
    const raw = GM_getValue(POSITION_STORAGE_KEY, null);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSavedPosition(layout) {
  try {
    GM_setValue(POSITION_STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    // Non-critical - worst case position just doesn't persist this time.
  }
}

// ---- color math ----

function hslToRgbString(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `rgb(${R}, ${G}, ${B})`;
}

function parseRgbString(rgbString) {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return { r: 255, g: 255, b: 255 };
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function drawColorWheel(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
  const data = imageData.data;

  for (let y = 0; y < WHEEL_SIZE; y++) {
    for (let x = 0; x < WHEEL_SIZE; x++) {
      const dx = x - WHEEL_RADIUS;
      const dy = y - WHEEL_RADIUS;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * WHEEL_SIZE + x) * 4;

      if (dist > WHEEL_RADIUS) {
        data[idx + 3] = 0; // transparent outside the circle
        continue;
      }

      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      const saturation = Math.min(1, dist / WHEEL_RADIUS);

      const rgbString = hslToRgbString(angle, saturation, WHEEL_FIXED_LIGHTNESS);
      const rgb = parseRgbString(rgbString);
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Reusable wheel + lightness slider + live preview swatch. Fires
// onChange continuously as the user drags either control - the
// CONSUMER decides whether to act on every change immediately (cheap,
// like the pen color) or only on a deliberate confirmation (like the
// background, since re-painting the whole canvas is comparatively
// expensive and shouldn't happen dozens of times per second while
// dragging).
function buildColorPicker({ initialHue = 0, initialSaturation = 1, initialLightness = 0.5, onChange }) {
  let hue = initialHue;
  let saturation = initialSaturation;
  let lightness = initialLightness;

  const container = document.createElement("div");
  container.className = "wizascript-notepad-colorpicker";

  const wheelWrapper = document.createElement("div");
  wheelWrapper.className = "wizascript-notepad-wheel-wrapper";

  const wheelCanvas = document.createElement("canvas");
  wheelCanvas.width = WHEEL_SIZE;
  wheelCanvas.height = WHEEL_SIZE;
  wheelCanvas.className = "wizascript-notepad-wheel";
  drawColorWheel(wheelCanvas);

  const indicator = document.createElement("div");
  indicator.className = "wizascript-notepad-wheel-indicator";

  wheelWrapper.append(wheelCanvas, indicator);

  const lightnessRow = document.createElement("div");
  lightnessRow.className = "wizascript-notepad-lightness-row";
  const lightnessLabel = document.createElement("span");
  lightnessLabel.className = "wizascript-notepad-lightness-label";
  lightnessLabel.textContent = "Dark";
  const lightnessSlider = document.createElement("input");
  lightnessSlider.type = "range";
  lightnessSlider.min = "0";
  lightnessSlider.max = "100";
  lightnessSlider.value = String(Math.round(lightness * 100));
  lightnessSlider.className = "wizascript-notepad-lightness-slider";
  const lightnessLabelEnd = document.createElement("span");
  lightnessLabelEnd.className = "wizascript-notepad-lightness-label";
  lightnessLabelEnd.textContent = "Light";
  lightnessRow.append(lightnessLabel, lightnessSlider, lightnessLabelEnd);

  const preview = document.createElement("div");
  preview.className = "wizascript-notepad-color-preview";

  function updateIndicatorPosition() {
    const rad = hue * Math.PI / 180;
    const dist = saturation * WHEEL_RADIUS;
    indicator.style.left = (WHEEL_RADIUS + Math.cos(rad) * dist) + "px";
    indicator.style.top = (WHEEL_RADIUS + Math.sin(rad) * dist) + "px";
  }

  function currentColor() {
    return hslToRgbString(hue, saturation, lightness);
  }

  function notify() {
    const color = currentColor();
    preview.style.background = color;
    onChange(color);
  }

  function pickFromEvent(e) {
    const rect = wheelCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - WHEEL_RADIUS;
    const dy = y - WHEEL_RADIUS;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > WHEEL_RADIUS) return;

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    hue = angle;
    saturation = Math.min(1, dist / WHEEL_RADIUS);
    updateIndicatorPosition();
    notify();
  }

  let picking = false;
  wheelCanvas.addEventListener("mousedown", e => {
    picking = true;
    pickFromEvent(e);
  });
  document.addEventListener("mousemove", e => {
    if (!picking) return;
    pickFromEvent(e);
  });
  document.addEventListener("mouseup", () => {
    picking = false;
  });

  lightnessSlider.addEventListener("input", () => {
    lightness = Number(lightnessSlider.value) / 100;
    notify();
  });

  updateIndicatorPosition();
  notify();

  container.append(wheelWrapper, lightnessRow, preview);
  return { element: container, getColor: currentColor };
}

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
  gap: 8px;
}
.wizascript-notepad-main-column {
  display: flex;
  flex-direction: column;
}
.wizascript-notepad-canvas {
  border: 1px solid #d8cbb0;
  display: block;
  cursor: none !important;
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
  width: ${WHEEL_SIZE}px;
  height: ${WHEEL_SIZE}px;
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
.wizascript-notepad-apply-bg-btn {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #8a7355;
  background: #efe4cf;
  color: #5a4a35;
  cursor: pointer;
  font-weight: bold;
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

function downloadAsPng(canvasEl) {
  const link = document.createElement("a");
  link.download = "notepad-doodle.png";
  link.href = canvasEl.toDataURL("image/png");
  link.click();
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
    setSavedPosition({ left: rect.left, top: rect.top });
  });
}

export function showNotepad() {
  if (widgetEl) return; // already open

  injectStyle();

  let currentTool = "draw"; // "draw" | "erase"
  let currentPenColor = "rgb(26, 26, 26)"; // black
  let backgroundColor = DEFAULT_BACKGROUND;
  let pendingColor = "rgb(26, 26, 26)"; // shared between the pen and paper "Apply" buttons
  let currentThickness = DEFAULT_THICKNESS;
  let drawing = false;
  let lastX = null;
  let lastY = null;

  const widget = document.createElement("div");
  widget.className = "wizascript-notepad";

  const savedLayout = getSavedPosition();
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
  drawBox.title = "Click to select this tool.";

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

  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.position = "relative";
  canvasWrapper.style.width = CANVAS_WIDTH + "px";
  canvasWrapper.style.height = CANVAS_HEIGHT + "px";

  const cursorIndicator = document.createElement("div");
  cursorIndicator.style.position = "absolute";
  cursorIndicator.style.pointerEvents = "none";
  cursorIndicator.style.borderRadius = "50%";
  cursorIndicator.style.border = "1.5px solid rgba(0,0,0,0.75)";
  cursorIndicator.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.7)";
  cursorIndicator.style.transform = "translate(-50%, -50%)";
  cursorIndicator.style.display = "none";

  canvasWrapper.append(canvas, cursorIndicator);

  mainColumn.append(toolbar, canvasWrapper);

  // ---- shared color wheel side column: one wheel, two "Apply" targets ----
  const colorColumn = document.createElement("div");
  colorColumn.className = "wizascript-notepad-side-column";
  const colorLabel = document.createElement("div");
  colorLabel.className = "wizascript-notepad-side-label";
  colorLabel.textContent = "Color Picker";
  const sharedPicker = buildColorPicker({
    initialHue: 0, initialSaturation: 0, initialLightness: 0.1,
    onChange: color => { pendingColor = color; }
  });
  const applyPenBtn = document.createElement("button");
  applyPenBtn.className = "wizascript-notepad-apply-bg-btn";
  applyPenBtn.textContent = "Apply Pen Color";
  const applyBgBtn = document.createElement("button");
  applyBgBtn.className = "wizascript-notepad-apply-bg-btn";
  applyBgBtn.textContent = "Apply Paper Color";
  colorColumn.append(colorLabel, sharedPicker.element, applyPenBtn, applyBgBtn);

  body.append(mainColumn, colorColumn);
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
  // with the new one (within a tolerance, to catch anti-aliased
  // blended edge pixels from stroke boundaries), leaving any actual
  // drawing untouched - lets you switch paper color without losing
  // what's already been drawn.
  function changeBackground(newColor) {
    if (newColor === backgroundColor) return;

    const oldRgb = parseRgbString(backgroundColor);
    const newRgb = parseRgbString(newColor);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
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
    backgroundColor = newColor;
    saveDrawing(canvas);
  }

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
    const isErase = currentTool === "erase";
    const size = isErase ? currentThickness * 2.2 : currentThickness;
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
    if (e.button !== 0) return;
    drawing = true;
    const pt = getCanvasPoint(e);
    lastX = pt.x;
    lastY = pt.y;
    useAt(pt.x, pt.y);
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

  sizeSlider.addEventListener("input", () => {
    currentThickness = Number(sizeSlider.value);
    updateCursorIndicatorSize();
  });

  applyPenBtn.addEventListener("mousedown", e => e.stopPropagation());
  applyPenBtn.addEventListener("click", () => {
    currentPenColor = pendingColor;
    colorIndicator.style.background = pendingColor;
  });

  applyBgBtn.addEventListener("mousedown", e => e.stopPropagation());
  applyBgBtn.addEventListener("click", () => changeBackground(pendingColor));

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
  if (!widgetEl) return;
  widgetEl.remove();
  widgetEl = null;
}

export function isNotepadOpen() {
  return widgetEl !== null;
}
