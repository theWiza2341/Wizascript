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

import { getSavedPosition, setSavedPosition, getSavedTitle, setSavedTitle } from "./storage.js";

const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 16;
const DEFAULT_TITLE = "Notepad";
const TITLE_SAVE_DEBOUNCE_MS = 400;

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

  // Editable in place - doubles as both the on-screen label and the
  // name used for the downloaded PNG. Kept visually inconspicuous
  // (transparent, borderless, matches the header's own text styling)
  // so it doesn't look like a form field until it's focused.
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "wizascript-notepad-title-input";
  titleInput.maxLength = 60;
  titleInput.spellcheck = false;
  titleInput.value = getSavedTitle() || DEFAULT_TITLE;

  // Same stopPropagation-on-mousedown pattern the header buttons use -
  // otherwise every click into the field to edit it would also be
  // read by the drag handler below as "start dragging the notepad".
  titleInput.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });

  let titleSaveTimer = null;
  titleInput.addEventListener("input", () => {
    clearTimeout(titleSaveTimer);
    titleSaveTimer = setTimeout(() => {
      setSavedTitle(titleInput.value.trim() || DEFAULT_TITLE);
    }, TITLE_SAVE_DEBOUNCE_MS);
  }, { signal });

  const headerButtons = document.createElement("span");
  headerButtons.className = "wizascript-notepad-header-buttons";
  header.append(titleInput, headerButtons);

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

  return { root, header, body, headerButtons, titleInput };
}
