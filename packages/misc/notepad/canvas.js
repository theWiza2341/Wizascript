// packages/misc/notepad/canvas.js
//
// A two-layer drawing surface: a background (paper color) canvas and
// a transparent ink canvas stacked on top of it via CSS, saved and
// restored as two independent pieces of state.
//
// The old implementation used a single canvas and simulated "erase"
// by stroking with the current background color, then re-tinted the
// paper by flood-replacing any pixel within a color-distance
// tolerance of the old background. That also recolored anti-aliased
// stroke edges and any ink that happened to land close to the paper
// color, and it relied on inferring the saved background from a
// single sampled pixel that a stroke could trivially corrupt.
// Splitting ink from paper removes the need for any of that: erasing
// uses destination-out compositing (correct regardless of paper
// color), and changing the paper color is just repainting the bottom
// layer - the ink layer is never touched or reinterpreted.

import { getSavedDrawing, setSavedDrawing } from "./storage.js";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
export const DEFAULT_BACKGROUND = "rgb(255, 254, 248)";
const SAVE_DEBOUNCE_MS = 400;

export function createDrawingSurface() {
  const wrapper = document.createElement("div");
  wrapper.className = "wizascript-notepad-canvas-wrapper";
  wrapper.style.width = CANVAS_WIDTH + "px";
  wrapper.style.height = CANVAS_HEIGHT + "px";

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = CANVAS_WIDTH;
  backgroundCanvas.height = CANVAS_HEIGHT;
  backgroundCanvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-bg";

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = CANVAS_WIDTH;
  inkCanvas.height = CANVAS_HEIGHT;
  inkCanvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-ink";

  const cursorIndicator = document.createElement("div");
  cursorIndicator.className = "wizascript-notepad-cursor-indicator";

  wrapper.append(backgroundCanvas, inkCanvas, cursorIndicator);

  const bgCtx = backgroundCanvas.getContext("2d");
  const inkCtx = inkCanvas.getContext("2d");

  let backgroundColor = DEFAULT_BACKGROUND;
  let strokeColor = "rgb(26, 26, 26)";
  let saveTimer = null;
  let lastX = null;
  let lastY = null;

  function paintBackground(color) {
    backgroundColor = color;
    bgCtx.fillStyle = color;
    bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setSavedDrawing({
        strokesDataUrl: inkCanvas.toDataURL("image/png"),
        backgroundColor
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function loadInitial() {
    const saved = getSavedDrawing();
    paintBackground(saved?.backgroundColor || DEFAULT_BACKGROUND);
    if (!saved?.strokesDataUrl) return;
    const img = new Image();
    img.onload = () => inkCtx.drawImage(img, 0, 0);
    img.onerror = () => console.warn("[Notepad] Saved drawing failed to load - starting with a blank page.");
    img.src = saved.strokesDataUrl;
  }
  loadInitial();

  function clear() {
    inkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scheduleSave();
  }

  function setBackgroundColor(color) {
    if (color === backgroundColor) return;
    paintBackground(color);
    scheduleSave();
  }

  function strokeTo(x, y, { erase, size }) {
    inkCtx.lineCap = "round";
    inkCtx.lineJoin = "round";
    inkCtx.lineWidth = erase ? size * 2.2 : size;
    inkCtx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    // Color is irrelevant when erasing (destination-out only uses alpha),
    // but strokeStyle still needs to be a valid value.
    inkCtx.strokeStyle = erase ? "rgba(0,0,0,1)" : strokeColor;
    inkCtx.beginPath();
    inkCtx.moveTo(lastX ?? x, lastY ?? y);
    inkCtx.lineTo(x, y);
    inkCtx.stroke();
    lastX = x;
    lastY = y;
  }

  function beginStroke(x, y, opts) {
    lastX = null;
    lastY = null;
    strokeTo(x, y, opts);
  }

  function endStroke() {
    lastX = null;
    lastY = null;
    scheduleSave();
  }

  function downloadAsPng() {
    // Flatten both layers for the exported file - the on-screen split
    // is an implementation detail, not something that should show up
    // in a saved image.
    const flattened = document.createElement("canvas");
    flattened.width = CANVAS_WIDTH;
    flattened.height = CANVAS_HEIGHT;
    const fctx = flattened.getContext("2d");
    fctx.drawImage(backgroundCanvas, 0, 0);
    fctx.drawImage(inkCanvas, 0, 0);
    const link = document.createElement("a");
    link.download = "notepad-doodle.png";
    link.href = flattened.toDataURL("image/png");
    link.click();
  }

  function getPointFromEvent(e) {
    const rect = inkCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return {
    wrapper,
    inkCanvas,
    cursorIndicator,
    beginStroke,
    strokeTo,
    endStroke,
    clear,
    setBackgroundColor,
    downloadAsPng,
    getPointFromEvent,
    setStrokeColor: (color) => { strokeColor = color; },
    getBackgroundColor: () => backgroundColor
  };
}
