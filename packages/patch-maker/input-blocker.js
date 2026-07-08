// Blocks UC/UnderScript global hotkeys while an overlay text field is
// focused, so typing normal characters doesn't accidentally trigger
// another plugin's global keydown/keyup listener mid-edit. This was
// present in the original standalone script (ucInputBlocker) but was
// dropped entirely during the initial port - restoring it here.

function isEditingOverlayField() {
  const ae = document.activeElement;
  return !!(ae && (
    ae.classList.contains("uc-li-text") ||
    ae.classList.contains("uc-section-label") ||
    (ae.tagName === "H2" && ae.getAttribute("contenteditable") === "true")
  ));
}

function isViewerMode() {
  const overlay = document.getElementById("uc-patch-overlay");
  return !!(overlay && overlay.classList.contains("viewer-mode"));
}

function inputBlocker(e) {
  if (!isEditingOverlayField() || isViewerMode()) return;

  // Patch Maker's own Ctrl/Shift+Arrow shortcuts still need to reach
  // their element-level handlers - don't swallow those here.
  const isOwnShortcut =
    !e.altKey && !e.metaKey && (e.ctrlKey || e.shiftKey) &&
    (e.key === "ArrowUp" || e.key === "ArrowDown");
  if (isOwnShortcut) return;

  // Stop this from reaching document/window-level global hotkey
  // listeners. Deliberately NOT calling preventDefault() for normal
  // characters, or typing would break.
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
