// Pure flood-fill core, operating directly on a Uint8ClampedArray of
// RGBA bytes (exactly what ImageData.data is) rather than any canvas
// API - this is what makes it possible to unit-test the actual fill
// logic (boundary detection, tolerance, enclosed-space handling)
// without needing a real 2D rendering context, which jsdom doesn't
// provide. canvas.js calls this with getImageData()'s real .data.
//
// Iterative (stack-based), not recursive - a naive recursive flood
// fill can blow the call stack on a fully-open canvas; at 240x200
// (48,000px max) an explicit stack comfortably handles the worst case.
export function floodFillPixels(data, width, height, startX, startY, fillRgb, tolerance = 24) {
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return false;

  const idx = (x, y) => (y * width + x) * 4;
  const startI = idx(x0, y0);
  const startR = data[startI], startG = data[startI + 1], startB = data[startI + 2], startA = data[startI + 3];
  const [fr, fg, fb] = fillRgb;
  const fa = 255;

  // Already the target color at full opacity - nothing to do.
  if (startR === fr && startG === fg && startB === fb && startA === fa) return false;

  // Compares against the CLICKED pixel's own color, not a fixed
  // "transparent vs not" rule - this handles both cases with one
  // algorithm: clicking an enclosed empty area (start alpha 0) fills
  // out to the surrounding ink, and clicking an already-filled area
  // (start alpha 255) re-fills that same region with a new color,
  // matching ordinary paint-bucket behavior.
  function matchesStart(i) {
    return (
      Math.abs(data[i] - startR) <= tolerance &&
      Math.abs(data[i + 1] - startG) <= tolerance &&
      Math.abs(data[i + 2] - startB) <= tolerance &&
      Math.abs(data[i + 3] - startA) <= tolerance
    );
  }

  const visited = new Uint8Array(width * height);
  const stack = [x0, y0];
  visited[y0 * width + x0] = 1;
  let filledAny = false;
  const filledCoords = []; // needed for the seam-fix dilation pass below

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const i = idx(x, y);
    data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa;
    filledAny = true;
    filledCoords.push(x, y);

    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  function tryPush(nx, ny) {
    const vIdx = ny * width + nx;
    if (visited[vIdx]) return;
    if (!matchesStart(idx(nx, ny))) return;
    visited[vIdx] = 1;
    stack.push(nx, ny);
  }

  // Seam fix: anti-aliased stroke edges have partial alpha (neither
  // fully transparent like the enclosed space, nor fully opaque like
  // the stroke's core), so they fall outside matchesStart()'s
  // tolerance and are left unfilled - a thin sliver of background
  // visible right where the fill meets the boundary. This pass grows
  // the filled region by one pixel, but ONLY into neighbors that are
  // partially transparent (0 < alpha < 255) - the signature of an
  // anti-aliased edge - so it closes that seam without bleeding into
  // solid, fully-opaque ink of a different color.
  if (filledAny) {
    for (let n = 0; n < filledCoords.length; n += 2) {
      const x = filledCoords[n], y = filledCoords[n + 1];
      growIntoSeam(x - 1, y);
      growIntoSeam(x + 1, y);
      growIntoSeam(x, y - 1);
      growIntoSeam(x, y + 1);
    }
  }

  function growIntoSeam(nx, ny) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const vIdx = ny * width + nx;
    if (visited[vIdx]) return; // already filled by the main pass
    const i = idx(nx, ny);
    const alpha = data[i + 3];
    if (alpha <= 0 || alpha >= 255) return; // not a partial-alpha seam pixel
    data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa;
    visited[vIdx] = 1;
  }

  return filledAny;
}
