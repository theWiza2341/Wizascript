// The Notepad They Said Was Fine - a lighthearted callback to the
// "pen and paper / notepad files" defense given during the moderation
// discussion. This is deliberately the least "smart" thing in the
// whole suite: a canvas the player draws on by hand, with a pen and
// eraser they physically drag around and hold over the surface. No
// calculation, no game-event hooking, no automation of any kind -
// exactly the kind of tool moderation explicitly said was fine.
//
// Interaction model, per the user's own description: the pen/eraser
// are draggable icons, not the canvas itself. Click-and-hold one,
// then move the cursor (treated as "the tip") over the notepad to draw
// or erase along its path; release to stop. This deliberately differs
// from a typical "click the canvas directly" drawing tool.
//
// Position persists via the same always-on store every other tracker
// uses (registry.js's getSavedPosition/setSavedPosition), reusing a
// fixed key rather than a registered preset id, since this isn't a
// picker-listed preset at all - it's directly controlled by its own
// setting. The DRAWING itself also persists (as a saved PNG data URL)
// and is deliberately never auto-cleared, including on close - only
// the user's own "Clear" button or eraser strokes ever remove
// anything, since some players may want to keep doodling on the same
// notepad across matches.

import { getSavedPosition, setSavedPosition } from "./registry.js";

const POSITION_KEY = "notepad";
const DRAWING_STORAGE_KEY = "wizascript.decktracker.notepadDrawing";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
const PEN_COLOR = "#2255cc";

const THICKNESS_PX = {
  Small: 2,
  Medium: 5,
  Large: 10
};
const ERASER_SIZE_PX = {
  Small: 14,
  Medium: 22,
  Large: 32
};

let widgetEl = null;

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
  position: relative;
  padding: 8px;
}
.wizascript-notepad-canvas {
  background: #fffef8;
  border: 1px solid #d8cbb0;
  display: block;
}
.wizascript-notepad-toolbox {
  position: absolute;
  top: 8px;
  right: -34px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.wizascript-notepad-pen {
  width: 10px;
  height: 32px;
  background: linear-gradient(#333 0 70%, #d4a017 70% 100%);
  border-radius: 4px 4px 1px 1px;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0,0,0,0.4);
}
.wizascript-notepad-eraser {
  width: 22px;
  height: 14px;
  background: #e08fa0;
  border: 1px solid #b8657a;
  border-radius: 3px;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0,0,0,0.4);
}
.wizascript-notepad-tool.wizascript-notepad-dragging {
  position: fixed;
  z-index: 100001;
  cursor: grabbing;
  pointer-events: none;
}
`;
  document.head.appendChild(style);
}

// Reused for both the pen and the eraser - the only difference is
// whether it draws or erases, and the brush size used while doing so.
function makeToolDraggable(toolEl, canvasEl, ctx, isEraser, getThicknessKey) {
  let dragging = false;
  let lastX = null;
  let lastY = null;

  function pointFromEvent(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, overCanvas: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom };
  }

  function useAt(x, y) {
    const key = getThicknessKey();
    if (isEraser) {
      const size = ERASER_SIZE_PX[key] ?? ERASER_SIZE_PX.Medium;
      ctx.clearRect(x - size / 2, y - size / 2, size, size);
    } else {
      const size = THICKNESS_PX[key] ?? THICKNESS_PX.Medium;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.strokeStyle = PEN_COLOR;
      ctx.beginPath();
      if (lastX !== null) {
        ctx.moveTo(lastX, lastY);
      } else {
        ctx.moveTo(x, y);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastX = x;
    lastY = y;
  }

  toolEl.addEventListener("mousedown", e => {
    dragging = true;
    lastX = null;
    lastY = null;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const point = pointFromEvent(e);
    if (point.overCanvas) {
      useAt(point.x, point.y);
    } else {
      lastX = null;
      lastY = null;
    }
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    lastX = null;
    lastY = null;
    saveDrawing(canvasEl);
  });
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

export function showNotepad(getPenThicknessKey) {
  if (widgetEl) return; // already open

  injectStyle();

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

  const buttons = document.createElement("span");
  buttons.className = "wizascript-notepad-header-buttons";
  const clearBtn = document.createElement("span");
  clearBtn.textContent = "Clear";
  const saveBtn = document.createElement("span");
  saveBtn.textContent = "Save PNG";
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  buttons.append(clearBtn, saveBtn, closeBtn);
  header.appendChild(buttons);

  const body = document.createElement("div");
  body.className = "wizascript-notepad-body";

  const canvas = document.createElement("canvas");
  canvas.className = "wizascript-notepad-canvas";
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");

  const toolbox = document.createElement("div");
  toolbox.className = "wizascript-notepad-toolbox";
  const pen = document.createElement("div");
  pen.className = "wizascript-notepad-pen";
  pen.title = "Click and hold, then drag over the notepad to draw";
  const eraser = document.createElement("div");
  eraser.className = "wizascript-notepad-eraser";
  eraser.title = "Click and hold, then drag over the notepad to erase";
  toolbox.append(pen, eraser);

  body.append(canvas, toolbox);
  widget.append(header, body);
  document.body.appendChild(widget);

  loadDrawing(canvas, ctx);

  bindWidgetDrag(widget, header);
  makeToolDraggable(pen, canvas, ctx, false, getPenThicknessKey);
  makeToolDraggable(eraser, canvas, ctx, true, getPenThicknessKey);

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
  if (!widgetEl) return;
  widgetEl.remove();
  widgetEl = null;
}

export function isNotepadOpen() {
  return widgetEl !== null;
}
