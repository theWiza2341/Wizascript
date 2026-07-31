// packages/misc/notepad/canvas.js
//
// A layered drawing surface: one background (paper color) canvas at
// the bottom, up to 6 transparent ink layers stacked above it, and a
// dedicated transparent interaction canvas on top of everything purely
// for capturing mouse events and computing coordinates - it is never
// itself drawn into. Strokes/fill/clear all act on whichever layer is
// currently marked active; switching the active layer is just a
// pointer change, so mouse listeners never need to be rebound.
//
// Layers are numbered 1 (bottom, the default/permanent base layer)
// through 6 (top). A fresh notepad has only layer 1. Layers are added
// from the top (a stack push) and can only be removed from the top
// (a stack pop) - this sidesteps the need to renumber everything above
// a removed middle layer, at the cost of only being able to remove
// your most-recently-added layer at a time. Layer 1 can never be
// removed.

import { getSavedDrawing, setSavedDrawing } from "./storage.js";
import { floodFillPixels } from "./flood-fill.js";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 200;
export const DEFAULT_BACKGROUND = "rgb(255, 254, 248)";
const SAVE_DEBOUNCE_MS = 400;
const MAX_LAYERS = 6;

// In-memory only, deliberately not persisted alongside the saved
// drawing - undo history resetting on reload/reopen is an accepted
// tradeoff for keeping this cheap. Scoped to layer CONTENT only
// (strokes/fill/clear) - adding or removing a layer is not itself
// undo-able in this version, to avoid also having to reconcile the
// layer-button UI's own state as part of restoring a snapshot.
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
  wrapper.appendChild(backgroundCanvas);
  const bgCtx = backgroundCanvas.getContext("2d");

  // Dedicated hit-test surface, always the topmost canvas layer -
  // purely for mouse event capture and coordinate math via
  // getBoundingClientRect(); nothing is ever drawn into it directly.
  const interactionCanvas = document.createElement("canvas");
  interactionCanvas.width = CANVAS_WIDTH;
  interactionCanvas.height = CANVAS_HEIGHT;
  interactionCanvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-ink";

  const cursorIndicator = document.createElement("div");
  cursorIndicator.className = "wizascript-notepad-cursor-indicator";

  // interactionCanvas and cursorIndicator get appended last, after
  // layers exist, so they stay on top - see ensureLayerExists() below.

  let backgroundColor = DEFAULT_BACKGROUND;
  let strokeColor = "rgb(26, 26, 26)";
  let saveTimer = null;
  let lastX = null;
  let lastY = null;

  // ---- layers ----
  const layers = []; // { canvas, ctx }, index 0 = layer 1 (bottom-most ink layer)
  let activeLayerIndex = 1; // 1-based, matching the user-facing layer numbers
  let onLayersChange = null; // (layerCount, activeLayerIndex) => void

  function notifyLayersChange() {
    if (onLayersChange) onLayersChange(layers.length, activeLayerIndex);
  }

  function createLayerCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-layer";
    return canvas;
  }

  // Inserts a freshly created layer canvas into the DOM directly above
  // the current topmost ink layer (or directly above the background
  // if this is the very first layer) - always right below whatever
  // interaction/cursor elements currently sit on top, so a new layer
  // is correctly stacked above earlier layers but never above the
  // interaction canvas itself.
  function insertLayerCanvas(canvas) {
    const insertBefore = interactionCanvas.isConnected ? interactionCanvas : null;
    wrapper.insertBefore(canvas, insertBefore);
  }

  function addLayerInternal() {
    const canvas = createLayerCanvas();
    insertLayerCanvas(canvas);
    layers.push({ canvas, ctx: canvas.getContext("2d") });
    return layers[layers.length - 1];
  }

  // Public: adds a new blank layer on top, up to MAX_LAYERS. Not
  // undo-able (see the MAX_HISTORY comment above) - this only changes
  // which layers exist, not any layer's content.
  function addLayer() {
    if (layers.length >= MAX_LAYERS) return false;
    addLayerInternal();
    activeLayerIndex = layers.length; // newly added layer becomes active
    scheduleSave();
    notifyLayersChange();
    return true;
  }

  // Public: removes the topmost layer (a stack pop) - layer 1 can
  // never be removed. If the removed layer was active, falls back to
  // the new topmost layer.
  function removeLayer() {
    if (layers.length <= 1) return false;
    const removed = layers.pop();
    removed.canvas.remove();
    if (activeLayerIndex > layers.length) activeLayerIndex = layers.length;
    scheduleSave();
    notifyLayersChange();
    return true;
  }

  function setActiveLayer(layerNum) {
    if (layerNum < 1 || layerNum > layers.length) return;
    activeLayerIndex = layerNum;
    notifyLayersChange();
  }

  function getActiveLayer() {
    return activeLayerIndex;
  }

  function getLayerCount() {
    return layers.length;
  }

  function activeCtx() {
    return layers[activeLayerIndex - 1].ctx;
  }

  function setOnLayersChange(cb) {
    onLayersChange = cb;
  }

  // ---- background / persistence ----
  function paintBackground(color) {
    backgroundColor = color;
    bgCtx.fillStyle = color;
    bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function snapshotState() {
    return {
      layers: layers.map((l) => l.canvas.toDataURL("image/png")),
      backgroundColor
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setSavedDrawing(snapshotState());
    }, SAVE_DEBOUNCE_MS);
  }

  // Loads a single layer's dataURL into its canvas asynchronously,
  // resolving once drawn (or immediately if there's nothing to load).
  function loadLayerContent(ctx, dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl) {
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = () => {
        console.warn("[Notepad] A saved layer failed to load - leaving it blank.");
        resolve();
      };
      img.src = dataUrl;
    });
  }

  function loadInitial() {
    const saved = getSavedDrawing();
    paintBackground(saved?.backgroundColor || DEFAULT_BACKGROUND);

    // Migrates the old single-layer save format ({ strokesDataUrl,
    // backgroundColor }) into the new per-layer shape, so updating to
    // this version doesn't lose anyone's existing drawing - it just
    // becomes layer 1.
    const savedLayerUrls = saved?.layers || (saved?.strokesDataUrl ? [saved.strokesDataUrl] : [null]);

    const count = Math.max(1, Math.min(MAX_LAYERS, savedLayerUrls.length));
    for (let i = 0; i < count; i++) {
      addLayerInternal();
    }
    activeLayerIndex = Math.min(saved?.activeLayerIndex || 1, layers.length);

    return Promise.all(layers.map((l, i) => loadLayerContent(l.ctx, savedLayerUrls[i])));
  }

  const initialLoad = loadInitial();

  wrapper.append(interactionCanvas, cursorIndicator);

  // ---- undo/redo history (in-memory only, not persisted) ----
  let undoStack = [];
  let redoStack = [];
  let onHistoryChange = null; // (canUndo, canRedo) => void
  let restoreGeneration = 0; // guards against out-of-order async loads if undo/redo is clicked rapidly

  function notifyHistoryChange() {
    if (onHistoryChange) onHistoryChange(undoStack.length > 0, redoStack.length > 0);
  }

  async function restoreState(state) {
    const myGeneration = ++restoreGeneration;
    paintBackground(state.backgroundColor);
    // Reconciles layer COUNT to match the snapshot (adding/removing
    // canvases as needed), without touching activeLayerIndex - undo
    // reverts drawn content, not which layer you're currently viewing.
    while (layers.length < state.layers.length) addLayerInternal();
    while (layers.length > state.layers.length) {
      const removed = layers.pop();
      removed.canvas.remove();
    }
    if (activeLayerIndex > layers.length) activeLayerIndex = layers.length || 1;

    layers.forEach((l) => l.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    await Promise.all(layers.map((l, i) => loadLayerContent(l.ctx, state.layers[i])));
    if (myGeneration !== restoreGeneration) return; // a newer restore already superseded this one
    scheduleSave();
    notifyLayersChange();
  }

  // Called right before any layer-content-mutating action (a stroke
  // starting, a fill, a clear) - captures the state as it was JUST
  // before that action. A new action always invalidates any pending
  // redo, matching how undo/redo works everywhere else.
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

  // ---- drawing ----
  function clear() {
    pushUndoSnapshot();
    activeCtx().clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scheduleSave();
  }

  function setBackgroundColor(color) {
    if (color === backgroundColor) return;
    pushUndoSnapshot();
    paintBackground(color);
    scheduleSave();
  }

  function strokeTo(x, y, { erase, size }) {
    const ctx = activeCtx();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = erase ? size * 2.2 : size;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    // Color is irrelevant when erasing (destination-out only uses alpha),
    // but strokeStyle still needs to be a valid value.
    ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : strokeColor;
    ctx.beginPath();
    ctx.moveTo(lastX ?? x, lastY ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
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

  // Flood-fills from (x, y) with the current pen color, on the active
  // layer. Delegates the actual algorithm to flood-fill.js's pure
  // implementation - this function's only job is the canvas-specific
  // plumbing (reading pixels out, resolving the CSS color string,
  // writing them back).
  function fill(x, y) {
    pushUndoSnapshot();
    const ctx = activeCtx();
    const fillRgb = resolveColorToRgb(strokeColor);
    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const changed = floodFillPixels(imageData.data, CANVAS_WIDTH, CANVAS_HEIGHT, x, y, fillRgb);
    if (!changed) {
      // Nothing actually changed (e.g. clicked the exact color
      // already there) - drop the snapshot we just pushed rather than
      // cluttering undo history with a no-op step.
      undoStack.pop();
      notifyHistoryChange();
      return;
    }
    ctx.putImageData(imageData, 0, 0);
    scheduleSave();
  }

  function downloadAsPng(filename = "notepad-doodle.png") {
    // Flattens the background and every existing layer, in order, for
    // the exported file - the layer split is an implementation
    // detail, not something that should show up in a saved image.
    const flattened = document.createElement("canvas");
    flattened.width = CANVAS_WIDTH;
    flattened.height = CANVAS_HEIGHT;
    const fctx = flattened.getContext("2d");
    fctx.drawImage(backgroundCanvas, 0, 0);
    layers.forEach((l) => fctx.drawImage(l.canvas, 0, 0));
    const link = document.createElement("a");
    link.download = filename;
    link.href = flattened.toDataURL("image/png");
    link.click();
  }

  function getPointFromEvent(e) {
    const rect = interactionCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return {
    wrapper,
    inkCanvas: interactionCanvas, // kept as `inkCanvas` for index.js's existing mouse-listener wiring
    cursorIndicator,
    ready: initialLoad, // resolves once any saved layers have finished loading
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
    getBackgroundColor: () => backgroundColor,
    addLayer,
    removeLayer,
    setActiveLayer,
    getActiveLayer,
    getLayerCount,
    setOnLayersChange
  };
}
