// packages/misc/notepad/widget.js
//
// Builds the Notepad's DOM chrome (header + body mount point) and
// wires header-drag positioning. Every listener here is bound with
// the AbortController `signal` the caller supplies, so a single
// controller.abort() in hideNotepad()/forceResetNotepad() removes all
// of it at once - the vanilla-DOM equivalent of Deck Tracker's
// hud.js pattern of a per-widget jQuery event namespace that gets
// `.off(ns)`'d before any rebind. The previous notepad attached raw,
// un-removable `document` listeners on every show, which piled up
// across repeated show/hide cycles instead of being replaced.

import { getSavedPosition, setSavedPosition } from "./storage.js";

const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 16;

export function buildNotepadShell(signal) {
  const root = document.createElement("div");
  root.className = "wizascript-notepad";

  const savedLayout = getSavedPosition();
  if (savedLayout) {
    root.style.left = savedLayout.left + "px";
    root.style.top = savedLayout.top + "px";
  } else {
    root.style.right = DEFAULT_RIGHT + "px";
    root.style.bottom = DEFAULT_BOTTOM + "px";
  }

  const header = document.createElement("div");
  header.className = "wizascript-notepad-header";
  const title = document.createElement("span");
  title.textContent = "Notepad";
  const headerButtons = document.createElement("span");
  headerButtons.className = "wizascript-notepad-header-buttons";
  header.append(title, headerButtons);

  const body = document.createElement("div");
  body.className = "wizascript-notepad-body";

  root.append(header, body);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const rect = root.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    header.style.cursor = "grabbing";
    e.preventDefault();
  }, { signal });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    root.style.left = e.clientX - offsetX + "px";
    root.style.top = e.clientY - offsetY + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
  }, { signal });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = "grab";
    const rect = root.getBoundingClientRect();
    setSavedPosition({ left: rect.left, top: rect.top });
  }, { signal });

  return { root, header, body, headerButtons };
}
