// packages/patch-maker/input-blocker.js

import { isRegisteredKeybindEvent } from "../core/keybinds.js";

function isEditingOverlayField() {
  const ae = document.activeElement;
  return !!(ae && (ae.classList.contains("uc-li-text") || ae.classList.contains("uc-section-label") || ae.tagName === "H2" && ae.getAttribute("contenteditable") === "true"));
}
function isViewerMode() {
  const overlay = document.getElementById("uc-patch-overlay");
  return !!(overlay && overlay.classList.contains("viewer-mode"));
}
function inputBlocker(e) {
  if (!isEditingOverlayField() || isViewerMode()) return;
  // Was a hardcoded check for Ctrl/Shift+Arrow specifically - now
  // deferred to the shared keybind registry, so this carve-out stays
  // correct automatically even if Patch Maker's bindings get
  // remapped to entirely different keys, instead of silently going
  // stale against a fixed assumption.
  if (isRegisteredKeybindEvent(e)) return;
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (e.key === "Escape" || e.key === "Enter") {
    e.preventDefault();
    if (e.key === "Enter") document.activeElement.blur();
  }
}
export function enableInputBlocker() {
  window.addEventListener("keydown", inputBlocker, true);
  window.addEventListener("keyup", inputBlocker, true);
  document.addEventListener("keydown", inputBlocker, true);
  document.addEventListener("keyup", inputBlocker, true);
}
export function disableInputBlocker() {
  window.removeEventListener("keydown", inputBlocker, true);
  window.removeEventListener("keyup", inputBlocker, true);
  document.removeEventListener("keydown", inputBlocker, true);
  document.removeEventListener("keyup", inputBlocker, true);
}
