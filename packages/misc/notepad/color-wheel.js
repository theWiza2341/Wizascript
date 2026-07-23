// packages/misc/notepad/color-wheel.js
//
// Small HSL hue/saturation wheel + lightness slider used for both the
// pen and paper color pickers.
//
// The wheel-drag listeners are bound with the AbortController
// `signal` the caller passes in (the notepad's own mount lifecycle)
// instead of being permanently attached to `document`. The old
// version called document.addEventListener('mousemove'/'mouseup', ...)
// fresh on every showNotepad(), with no way to remove them again -
// toggling the notepad off and back on left the previous generation's
// listeners running forever alongside the new one.

const WHEEL_SIZE = 96;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_FIXED_LIGHTNESS = 0.5;

function hslToRgbString(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `rgb(${R}, ${G}, ${B})`;
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
        data[idx + 3] = 0;
        continue;
      }
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const saturation = Math.min(1, dist / WHEEL_RADIUS);
      const [r, g, b] = hslToRgbString(angle, saturation, WHEEL_FIXED_LIGHTNESS)
        .match(/\d+/g)
        .map(Number);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// signal is required - the caller owns the AbortController and is
// responsible for aborting it when the notepad is hidden/reset.
export function buildColorPicker({ signal, initialHue = 0, initialSaturation = 1, initialLightness = 0.5, onChange }) {
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
  const darkLabel = document.createElement("span");
  darkLabel.className = "wizascript-notepad-lightness-label";
  darkLabel.textContent = "Dark";
  const lightnessSlider = document.createElement("input");
  lightnessSlider.type = "range";
  lightnessSlider.min = "0";
  lightnessSlider.max = "100";
  lightnessSlider.value = String(Math.round(lightness * 100));
  lightnessSlider.className = "wizascript-notepad-lightness-slider";
  const lightLabel = document.createElement("span");
  lightLabel.className = "wizascript-notepad-lightness-label";
  lightLabel.textContent = "Light";
  lightnessRow.append(darkLabel, lightnessSlider, lightLabel);

  const preview = document.createElement("div");
  preview.className = "wizascript-notepad-color-preview";

  function updateIndicatorPosition() {
    const rad = (hue * Math.PI) / 180;
    const dist = saturation * WHEEL_RADIUS;
    indicator.style.left = WHEEL_RADIUS + Math.cos(rad) * dist + "px";
    indicator.style.top = WHEEL_RADIUS + Math.sin(rad) * dist + "px";
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
    const dx = e.clientX - rect.left - WHEEL_RADIUS;
    const dy = e.clientY - rect.top - WHEEL_RADIUS;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > WHEEL_RADIUS) return;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    hue = angle;
    saturation = Math.min(1, dist / WHEEL_RADIUS);
    updateIndicatorPosition();
    notify();
  }

  let picking = false;
  wheelCanvas.addEventListener("mousedown", (e) => {
    picking = true;
    pickFromEvent(e);
  }, { signal });
  document.addEventListener("mousemove", (e) => {
    if (picking) pickFromEvent(e);
  }, { signal });
  document.addEventListener("mouseup", () => {
    picking = false;
  }, { signal });
  lightnessSlider.addEventListener("input", () => {
    lightness = Number(lightnessSlider.value) / 100;
    notify();
  }, { signal });

  updateIndicatorPosition();
  notify();
  container.append(wheelWrapper, lightnessRow, preview);
  return { element: container, getColor: currentColor };
}
