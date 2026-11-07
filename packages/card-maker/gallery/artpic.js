// packages/card-maker/gallery/artpic.js
//
// Artifact pictures (a PNG of an artifact, usually from UC Editor's group
// download) are wide strips: [icon + name] | [rarity] | [text], about 700px
// wide. Squeezed into one card's space their text can't be read, so they're
// redrawn as a card-shaped tile, like the gallery's own artifacts: the icon
// and name on top, then the rarity, then the text, re-wrapped word by word to
// the tile's width (from the picture's own pixels; nothing is retyped). A
// short text fits one card's space; a long one gets two (CARD_W * 2 + 3).
// Anything that isn't such a strip is just shown scaled (at most two spaces).
//
// Done when shown (not when uploaded), so posts made before this work too.
// Results are cached per picture; tiles drawn before it's ready are updated
// in place and the panel is asked to lay out again (onArtPicsChange).

const ONE = 176, TWO = 176 * 2 + 3, H = 246, BORDER = 2, PAD = 8;
const cache = new Map(); // src -> Promise<{ url, w, h } | null>
const ready = new Map(); // src -> its result, once known
const listeners = [];
let notifyTimer = 0;
export function onArtPicsChange(f) { listeners.push(f); }
function changed() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => listeners.forEach((f) => { try { f(); } catch (e) { /* keep going */ } }), 30);
}

function load(src) {
  return new Promise((ok) => {
    const img = new Image();
    if (!/^(data|blob):/.test(src)) img.crossOrigin = "anonymous"; // gallery art (raw.githubusercontent allows it)
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

// The picture's pixels -> the pieces of a UC Editor artifact strip, or null.
export function stripPieces(px, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  // Background: the most common colour (UC Editor: black).
  const counts = new Map();
  for (let i = 0; i < px.length; i += 16) {
    const k = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bk = 0, best = -1;
  for (const [k, n] of counts) if (n > best) { best = n; bk = k; }
  let bg = [((bk >> 8) & 15) * 16 + 8, ((bk >> 4) & 15) * 16 + 8, (bk & 15) * 16 + 8];
  for (let i = 0; i < px.length; i += 16) { // a real pixel of it, so the redrawn tile matches exactly
    if (((px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4)) === bk) { bg = [px[i], px[i + 1], px[i + 2]]; break; }
  }
  const ink = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (px[i + 3] >= 40 && Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 60) ink[p] = 1;
  }
  const colShare = (x, y0, y1) => { let n = 0; for (let y = y0; y <= y1; y++) n += ink[y * w + x]; return n / (y1 - y0 + 1); };
  const rowShare = (y, x0, x1) => { let n = 0; for (let x = x0; x <= x1; x++) n += ink[y * w + x]; return n / (x1 - x0 + 1); };
  if (w < 120 || h < 20 || w / h < 2.2) return null; // not a strip
  // The outer border: full lines of ink on every side.
  let l = 0, r = w - 1, t = 0, b = h - 1;
  const midY0 = Math.floor(h * 0.2), midY1 = Math.ceil(h * 0.8);
  while (l < 8 && colShare(l, midY0, midY1) > 0.9) l++;
  while (r > w - 9 && colShare(r, midY0, midY1) > 0.9) r--;
  while (t < 8 && rowShare(t, l, r) > 0.9) t++;
  while (b > h - 9 && rowShare(b, l, r) > 0.9) b--;
  if (l === 0 || t === 0) return null; // no border: not an editor artifact
  const border = [px[at(0, h >> 1)], px[at(0, h >> 1) + 1], px[at(0, h >> 1) + 2]];
  // Dividers: lines at least 2px wide running down most of the inside
  // (the icon's 1px frame doesn't count; text never runs that tall).
  const run = (x) => { let best = 0, n = 0; for (let y = t; y <= b; y++) { n = ink[y * w + x] ? n + 1 : 0; if (n > best) best = n; } return best; };
  const tall = Math.max(16, Math.round((b - t + 1) * 0.6));
  let dividers = [];
  for (let x = l + 3; x <= r - 3; x++) {
    if (run(x) >= tall) {
      const last = dividers[dividers.length - 1];
      if (last && x - last[1] <= 1) last[1] = x; else dividers.push([x, x]);
    }
  }
  dividers = dividers.filter(([a, z]) => z - a >= 1);
  if (!dividers.length || dividers.length > 3) return null;
  const bounds = [l, ...dividers.flatMap(([a, z]) => [a - 1, z + 1]), r];
  const trim = (x0, x1) => {
    let y0 = t, y1 = b;
    const rowHas = (y) => { for (let x = x0; x <= x1; x++) if (ink[y * w + x]) return true; return false; };
    const colHas = (x) => { for (let y = y0; y <= y1; y++) if (ink[y * w + x]) return true; return false; };
    while (y0 < y1 && !rowHas(y0)) y0++;
    while (y1 > y0 && !rowHas(y1)) y1--;
    while (x0 < x1 && !colHas(x0)) x0++;
    while (x1 > x0 && !colHas(x1)) x1--;
    return x1 - x0 < 2 || y1 - y0 < 2 ? null : { x0, y0, x1, y1 };
  };
  const pieces = [];
  for (let i = 0; i < bounds.length; i += 2) pieces.push(trim(bounds[i], bounds[i + 1]));
  const desc = pieces.pop();
  const head = pieces.filter(Boolean);
  if (!desc || !head.length) return null;
  return { ink, border, bg, head, desc, lines: textLines(ink, w, desc) };
}

// The text, as lines of words: rows split at blank rows, words at gaps wider
// than the font's letter spacing. Forced line breaks (a short line whose next
// word would have fitted) are kept.
function textLines(ink, w, box) {
  const rowHas = (y) => { for (let x = box.x0; x <= box.x1; x++) if (ink[y * w + x]) return true; return false; };
  const rows = [];
  let s = -1;
  for (let y = box.y0; y <= box.y1 + 1; y++) {
    const on = y <= box.y1 && rowHas(y);
    if (on && s < 0) s = y;
    else if (!on && s >= 0) { rows.push([s, y - 1]); s = -1; }
  }
  if (!rows.length) return null;
  const heights = rows.map(([a, z]) => z - a + 1).sort((a, b) => a - b);
  const lineH = heights[heights.length >> 1];
  const gap = Math.max(5, Math.round(lineH * 0.38));
  const lines = rows.map(([y0, y1]) => {
    const colHas = (x) => { for (let y = y0; y <= y1; y++) if (ink[y * w + x]) return true; return false; };
    const words = [];
    let ws = -1, empty = 0;
    for (let x = box.x0; x <= box.x1 + gap; x++) {
      if (x <= box.x1 && colHas(x)) { if (ws < 0) ws = x; empty = 0; }
      else if (ws >= 0 && (++empty >= gap || x > box.x1)) { words.push([ws, x - empty]); ws = -1; empty = 0; }
    }
    // Baseline: where most columns' ink ends (descenders and underlines are the few).
    const ends = new Map();
    for (let x = box.x0; x <= box.x1; x++) {
      for (let y = y1; y >= y0; y--) if (ink[y * w + x]) { ends.set(y, (ends.get(y) || 0) + 1); break; }
    }
    let base = y1, most = 0;
    for (const [y, n] of ends) if (n > most || (n === most && y < base)) { most = n; base = y; }
    return { y0, y1, base, words };
  });
  const gaps = [];
  lines.forEach((ln) => { for (let i = 1; i < ln.words.length; i++) gaps.push(ln.words[i][0] - ln.words[i - 1][1] - 1); });
  gaps.sort((a, b) => a - b);
  const space = gaps.length ? gaps[gaps.length >> 1] : gap + 2;
  lines.forEach((ln, i) => {
    const next = lines[i + 1];
    ln.forced = !!next && next.words.length > 0 && ln.words.length > 0 &&
      ln.words[ln.words.length - 1][1] + space + (next.words[0][1] - next.words[0][0] + 1) <= box.x1 - 2;
  });
  const pitches = [];
  for (let i = 1; i < lines.length; i++) pitches.push(lines[i].y0 - lines[i - 1].y0);
  pitches.sort((a, b) => a - b);
  return { lines, space, pitch: pitches.length ? pitches[pitches.length >> 1] : lineH + 4 };
}

// Words placed into a width: [{ src: [x0, x1, y0, y1], x, y }], and the height used.
function flow(text, width) {
  const out = [];
  let x = 0, y = 0;
  // Words from different lines share one baseline.
  const asc = Math.max(...text.lines.map((ln) => ln.base - ln.y0));
  const offset = (ln) => asc - (ln.base - ln.y0);
  const wide = Math.max(...text.lines.flatMap((ln) => ln.words.map(([a, z]) => z - a + 1)), 0);
  if (wide > width) return null;
  text.lines.forEach((ln) => {
    ln.words.forEach(([a, z]) => {
      const ww = z - a + 1;
      if (x > 0 && x + text.space + ww > width) { x = 0; y += text.pitch; }
      else if (x > 0) x += text.space;
      out.push({ src: [a, z, ln.y0, ln.y1], x, y: y + offset(ln) });
      x += ww;
    });
    if (ln.forced) { x = 0; y += text.pitch; }
  });
  if (text.lines[text.lines.length - 1].forced) y -= text.pitch;
  const bottom = Math.max(0, ...out.map((o) => o.y + o.src[3] - o.src[2] + 1));
  return { words: out, height: Math.max(bottom, y + text.pitch) };
}

// Lay the pieces out in one or two card spaces; null if the text can't be split.
export function layoutStrip(p) {
  if (!p.lines) return null;
  for (const tw of [ONE, TWO]) {
    const inner = tw - 2 * (BORDER + PAD);
    const heads = [];
    let x = 0, y = 0, rowH = 0, fits = true;
    for (const b of p.head) {
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      if (bw > inner) { fits = false; break; }
      if (x > 0 && x + 10 + bw > inner) { x = 0; y += rowH + 6; rowH = 0; }
      else if (x > 0) x += 10;
      heads.push({ b, x, y });
      x += bw; rowH = Math.max(rowH, bh);
    }
    if (!fits) continue;
    // Pieces on one row share its middle.
    heads.forEach((hd) => {
      const rowItems = heads.filter((o) => o.y === hd.y);
      const tall = Math.max(...rowItems.map((o) => o.b.y1 - o.b.y0 + 1));
      hd.dy = Math.floor((tall - (hd.b.y1 - hd.b.y0 + 1)) / 2);
    });
    const headH = y + rowH;
    const text = flow(p.lines, inner);
    if (!text) continue;
    const need = BORDER + PAD + headH + 9 + text.height + PAD + BORDER;
    if (tw === ONE && need > H) continue;
    return { w: tw, h: Math.max(H, need), heads, headH, text };
  }
  return null;
}

function draw(img, p, lay) {
  const c = document.createElement("canvas");
  c.width = lay.w; c.height = lay.h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = `rgb(${p.bg.join(",")})`; g.fillRect(0, 0, lay.w, lay.h);
  g.fillStyle = `rgb(${p.border.join(",")})`;
  g.fillRect(0, 0, lay.w, BORDER); g.fillRect(0, lay.h - BORDER, lay.w, BORDER);
  g.fillRect(0, 0, BORDER, lay.h); g.fillRect(lay.w - BORDER, 0, BORDER, lay.h);
  const ox = BORDER + PAD, oy = BORDER + PAD;
  lay.heads.forEach(({ b, x, y, dy }) => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    g.drawImage(img, b.x0, b.y0, bw, bh, ox + x, oy + y + dy, bw, bh);
  });
  const ty = oy + lay.headH + 3;
  g.fillRect(BORDER, ty, lay.w - 2 * BORDER, 1);
  lay.text.words.forEach(({ src: [x0, x1, y0, y1], x, y }) => {
    g.drawImage(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox + x, ty + 6 + y, x1 - x0 + 1, y1 - y0 + 1);
  });
  return c.toDataURL("image/png");
}

export function restackArtifact(src) {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) {
    cache.set(src, load(src).then((img) => {
      if (!img) return null;
      const w = img.naturalWidth, h = img.naturalHeight;
      let px;
      try {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0);
        px = g.getImageData(0, 0, w, h).data;
      } catch (e) {
        return { w, h, url: null }; // can't read it: shown scaled
      }
      const pieces = stripPieces(px, w, h);
      const lay = pieces && layoutStrip(pieces);
      return lay ? { url: draw(img, pieces, lay), w: lay.w, h: lay.h, restacked: true } : { w, h, url: null };
    }).catch(() => null).then((r) => { ready.set(src, r); return r; }));
  }
  return cache.get(src);
}

// Width to show a picture that couldn't be redrawn: its own size, at most two spaces.
const plainWidth = (w) => Math.min(w || ONE, w > ONE * 1.15 ? TWO : ONE);

// The tile for an artifact picture. Shown at one space until it's measured.
export function artPicTile(h, src) {
  const img = h("img", { class: "wz-gl-artpic", src, alt: "", style: { width: ONE + "px" } });
  const apply = (r) => {
    if (!r) return false;
    if (r.url) { img.src = r.url; img.style.width = r.w + "px"; img.classList.add("wz-gl-restacked"); }
    else img.style.width = plainWidth(r.w) + "px";
    return true;
  };
  if (ready.has(src)) apply(ready.get(src)); // already worked out: no re-layout needed
  else restackArtifact(src).then((r) => { if (apply(r)) changed(); });
  return img;
}
