// packages/misc/notepad/recent-colors.js
//
// The small "recently used pen colors" swatch row shown at the bottom
// of the notepad's color column. Clicking a swatch moves the color
// wheel to that exact hue/saturation/lightness AND makes it the
// active pen color immediately, so alternating between a handful of
// colors while drawing is a single click rather than a wheel re-pick
// plus a separate "Apply Pen Color" click each time.

import { getRecentColors, setRecentColors } from "./storage.js";

const MAX_RECENT = 5;

// entry: { color, hue, saturation, lightness }. Re-recording an
// already-present color just moves it back to the front (true MRU
// order) instead of creating a duplicate swatch.
export function recordRecentColor(entry) {
  const existing = getRecentColors();
  const deduped = existing.filter((c) => c.color !== entry.color);
  const next = [entry, ...deduped].slice(0, MAX_RECENT);
  setRecentColors(next);
  return next;
}

export function buildRecentColorsRow({ signal, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "wizascript-notepad-recent-wrap";

  const label = document.createElement("div");
  label.className = "wizascript-notepad-side-label";
  label.textContent = "Recent Colors";

  const row = document.createElement("div");
  row.className = "wizascript-notepad-recent-colors";

  wrap.append(label, row);

  function render(colors) {
    row.innerHTML = "";
    colors.forEach((entry) => {
      const swatch = document.createElement("span");
      swatch.className = "wizascript-notepad-recent-swatch";
      swatch.style.background = entry.color;
      swatch.title = entry.color;
      swatch.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
      swatch.addEventListener("click", () => onSelect(entry), { signal });
      row.appendChild(swatch);
    });
  }

  return { element: wrap, render };
}
