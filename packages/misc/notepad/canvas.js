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
import { floodFillPixels } from "./flood-fill.js";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
export const DEFAULT_BACKGROUND = "rgb(255, 254, 248)";
const SAVE_DEBOUNCE_MS = 400;

// In-memory only, deliberately not persisted alongside the saved
// drawing - undo history resetting on reload/reopen is an accepted
// tradeoff for keeping this cheap (a handful of PNG-encoded canvas
// snapshots, capped low, never touching GM_setValue).
const MAX_HISTORY = 8;

// Renders any valid CSS color string to its resolved [r, g, b] via an
// offscreen 1x1 canvas, rather than writing/maintaining a CSS color
// parser - handles rgb(), hex, hsl(), named colors, etc. uniformly for
// free, since the browser's own color resolution does the work.
function resolveColorToRgb(cssColor) {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const pctx = probe.getContext("2d");
  pctx.fillStyle = cssColor;
  pctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

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

  // ---- undo/redo history (in-memory only, not persisted) ----
  let undoStack = [];
  let redoStack = [];
  let onHistoryChange = null; // (canUndo, canRedo) => void, set via setOnHistoryChange
  let restoreGeneration = 0; // guards against out-of-order async image loads if undo/redo is clicked rapidly

  function snapshotState() {
    return { strokesDataUrl: inkCanvas.toDataURL("image/png"), backgroundColor };
  }

  function notifyHistoryChange() {
    if (onHistoryChange) onHistoryChange(undoStack.length > 0, redoStack.length > 0);
  }

  function restoreState(state) {
    const myGeneration = ++restoreGeneration;
    paintBackground(state.backgroundColor);
    inkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!state.strokesDataUrl) {
      scheduleSave();
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (myGeneration !== restoreGeneration) return; // a newer restore already superseded this one
      inkCtx.drawImage(img, 0, 0);
      scheduleSave();
    };
    img.src = state.strokesDataUrl;
  }

  // Called right before any canvas-mutating action (a stroke starting,
  // a fill, a clear, a background change) - captures the state as it
  // was JUST before that action, so undo can step back to it. A new
  // action always invalidates any pending redo, matching how undo/redo
  // works everywhere else.
  function pushUndoSnapshot() {
    undoStack.push(snapshotState());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    notifyHistoryChange();
  }

  function undo() {
    if (!undoStack.length) return false;
    const current = snapshotState();
    const previous = undoStack.pop();
    redoStack.push(current);
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    restoreState(previous);
    notifyHistoryChange();
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    const current = snapshotState();
    const next = redoStack.pop();
    undoStack.push(current);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    restoreState(next);
    notifyHistoryChange();
    return true;
  }

  function clear() {
    pushUndoSnapshot();
    inkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scheduleSave();
  }

  function setBackgroundColor(color) {
    if (color === backgroundColor) return;
    pushUndoSnapshot();
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
    // Snapshotted once per stroke, here (not on every strokeTo call
    // during a drag) - undo should revert the WHOLE stroke as one
    // step, not each tiny segment fired during mousemove.
    pushUndoSnapshot();
    lastX = null;
    lastY = null;
    strokeTo(x, y, opts);
  }

  function endStroke() {
    lastX = null;
    lastY = null;
    scheduleSave();
  }

  // Flood-fills from (x, y) with the current pen color. Delegates the
  // actual algorithm to flood-fill.js's pure implementation - this
  // function's only job is the canvas-specific plumbing (reading
  // pixels out, resolving the CSS color string, writing them back).
  function fill(x, y) {
    pushUndoSnapshot();
    const fillRgb = resolveColorToRgb(strokeColor);
    const imageData = inkCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const changed = floodFillPixels(imageData.data, CANVAS_WIDTH, CANVAS_HEIGHT, x, y, fillRgb);
    if (!changed) {
      // Nothing actually changed (e.g. clicked the exact color
      // already there) - drop the snapshot we just pushed rather than
      // cluttering undo history with a no-op step.
      undoStack.pop();
      notifyHistoryChange();
      return;
    }
    inkCtx.putImageData(imageData, 0, 0);
    scheduleSave();
  }

  function downloadAsPng(filename = "notepad-doodle.png") {
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
    link.download = filename;
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
    fill,
    undo,
    redo,
    setOnHistoryChange: (cb) => { onHistoryChange = cb; },
    setBackgroundColor,
    downloadAsPng,
    getPointFromEvent,
    setStrokeColor: (color) => { strokeColor = color; },
    getBackgroundColor: () => backgroundColor
  };
}
