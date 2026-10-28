// packages/card-maker/gallery/parts.js
//
// Turns what the editors give (their saved data, a UC Editor .uceditor
// group file, or a PNG download as a fallback) into gallery parts:
//   { id, type, name, desc, cost, atk, hp, soul, rarity, rarityIcon,
//     tribes, art, artFrom, note, source, from, editorGroup, group }
// Art is stored at the gallery's sizes: 160x90 (monster/spell), 160x183
// (enchantment), 64x64 (artifact, shown at 32x32). Pictures (PNG) keep
// the picture itself, re-padded to 176x246, with the art cut from where
// the game puts it; their names are typed by the player.

import { CARD_W, CARD_H } from "./render.js";

export const ART = { Monster: [160, 90], Spell: [160, 90], Enchantment: [160, 183], Artifact: [64, 64] };
const ARTIFACT_MAX_W = 704;
const UCE = "https://sernon158.github.io/uc-editor/";

export function loadImg(src) {
  return new Promise((ok, bad) => {
    const i = new Image();
    if (/^https?:/.test(src) && !src.startsWith(location.origin)) i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error("image failed to load"));
    i.src = src;
  });
}

export const readFile = (f, how) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r[how](f); });

// Resize art to the stored size. Pixel art scaled by a whole number stays
// sharp; anything else is smoothed.
async function fit(src, w, h, mode = "cover") {
  if (!src) return null;
  const img = await loadImg(src);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = mode === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const whole = Math.abs(s - Math.round(s)) < 0.01 || Math.abs(1 / s - Math.round(1 / s)) < 0.01;
  g.imageSmoothingEnabled = !whole;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return { src: c.toDataURL("image/png"), from: `${iw}x${ih}` };
}

// One rarity name for both editors: "LEGENDARY" -> "BASE_LEGENDARY".
const rarityKey = (type, r) => (!r ? null : type === "Artifact" || r.includes("_") ? r : "BASE_" + r);

export async function partFromRaw(raw, { source, from, editorGroup }) {
  const [w, h] = ART[raw.type] || ART.Monster;
  let art = null;
  let note = "";
  try { art = await fit(raw.image, w, h, raw.type === "Artifact" ? "contain" : "cover"); } catch (e) { note = "art didn't load"; }
  if (art && raw.type !== "Artifact" && raw.type !== "Enchantment" && raw.imageType && raw.imageType !== "standard") note = `${raw.imageType} art cropped to 160x90`;
  return {
    type: raw.type,
    name: raw.name || "",
    desc: raw.desc || "",
    cost: raw.cost ?? null,
    atk: raw.atk ?? null,
    hp: raw.hp ?? null,
    soul: raw.soul || null,
    rarity: rarityKey(raw.type, raw.rarity),
    rarityIcon: raw.rarityIcon || null,
    tribes: (raw.tribes || []).filter((t) => t && t.icon).slice(0, 4),
    art: art ? art.src : null,
    artFrom: art ? art.from : "",
    note,
    source,
    from,
    editorGroup,
    group: null
  };
}

// A UC Editor group file (its group menu -> Download File): hex-encoded JSON.
export function readUcEditorFile(text) {
  const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(text.trim().match(/../g).map((b) => parseInt(b, 16)))));
  const abs = (u) => (!u ? null : /^(data|blob|https?):/.test(u) ? u : new URL(u, UCE).href);
  const cssUrl = (v) => (/url\(["']?([^"')]+)["']?\)/.exec(v || "") || [])[1] || (v && v !== "none" ? v : null);
  const rarityName = (u) => (/([A-Z]+_[A-Z]+)\.png/i.exec(u || "") || [])[1] || null;
  const parts = [];
  for (const a of json.artifacts || []) parts.push({ type: "Artifact", name: a.name, desc: a.desc || "", rarity: a.rarity || null, image: abs(a.image) });
  for (const c of json.cards || []) {
    const type = { 0: "Monster", 1: "Spell", 99: "Enchantment" }[c.cardType];
    if (!type) continue;
    const r = cssUrl(c.rarity);
    parts.push({
      type,
      name: c.name,
      desc: c.desc || "",
      cost: type === "Monster" ? (c.stats || [])[0] : type === "Spell" ? c.stats : null,
      atk: type === "Monster" ? (c.stats || [])[1] : null,
      hp: type === "Monster" ? (c.stats || [])[2] : null,
      soul: c.spellSoul || null,
      rarity: c.isRarityCustom ? null : rarityName(r),
      rarityIcon: c.isRarityCustom ? abs(r) : null,
      tribes: (c.tribes || []).map((t) => ({ name: t.name || null, icon: abs(t.src) })),
      imageType: c.imageType || "standard",
      image: abs(cssUrl(c.image))
    });
  }
  return { name: json.name || "Group", parts };
}

// A PNG from either editor (a card, an artifact or a whole group): every
// card or artifact found becomes a picture part.
export async function picturesFromPng(dataUrl, { from, editorGroup }) {
  const r = extractPicture(await loadImg(dataUrl));
  const single = r.parts.length === 1;
  const out = [];
  for (const p of r.parts) {
    let art = null;
    if (p.type !== "Artifact") { // the art sits where the game puts it
      const [aw, ah] = ART[p.type];
      const top = p.type === "Enchantment" ? 54 : 36;
      const c = document.createElement("canvas");
      c.width = aw; c.height = ah;
      c.getContext("2d").drawImage(await loadImg(p.src), 8, top, aw, ah, 0, 0, aw, ah);
      art = c.toDataURL();
    }
    out.push({ type: p.type, name: single ? editorGroup : "", picture: p.src, art, artFrom: p.from, note: "picture only", source: "picture", from, editorGroup, group: null });
  }
  return out;
}

// ---- the picture extractor (from the console tests) ----
export function extractPicture(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  // Background = the most common colour (fully transparent counts as background).
  const counts = new Map();
  for (let i = 0; i < px.length; i += 16) {
    if (px[i + 3] < 40) continue;
    const k = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bgKey = 0, best = -1;
  for (const [k, n] of counts) if (n > best) { best = n; bgKey = k; }
  const bg = [((bgKey >> 8) & 15) * 16 + 8, ((bgKey >> 4) & 15) * 16 + 8, (bgKey & 15) * 16 + 8];
  const on = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < on.length; p++, i += 4) {
    if (px[i + 3] >= 40 && Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 60) on[p] = 1;
  }
  const rowHas = (y, x0, x1) => { for (let x = x0; x <= x1; x++) if (on[y * w + x]) return true; return false; };
  const colHas = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (on[y * w + x]) return true; return false; };
  const runs = (from, to, has, gap = 3) => {
    const out = []; let s = -1, empty = 0;
    for (let i = from; i <= to; i++) {
      if (has(i)) { if (s < 0) s = i; empty = 0; }
      else if (s >= 0 && ++empty >= gap) { out.push([s, i - empty]); s = -1; empty = 0; }
    }
    if (s >= 0) out.push([s, to - empty]);
    return out;
  };
  const trim = (b) => {
    let { x0, y0, x1, y1 } = b;
    while (y0 < y1 && !rowHas(y0, x0, x1)) y0++;
    while (y1 > y0 && !rowHas(y1, x0, x1)) y1--;
    while (x0 < x1 && !colHas(x0, y0, y1)) x0++;
    while (x1 > x0 && !colHas(x1, y0, y1)) x1--;
    return { x0, y0, x1, y1 };
  };
  const dims = (b) => ({ w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 });
  const cardShaped = (b) => { const { w: bw, h: bh } = dims(b); const r = bh / bw; return r >= 1.3 && r <= 1.65 && bh >= 120; };

  // Cut the picture into bands of rows, each band into columns; keep cutting
  // anything that isn't yet card- or artifact-shaped.
  const leaves = [];
  function split(b, depth) {
    b = trim(b);
    const { w: bw, h: bh } = dims(b);
    if (bw * bh < 1200) return;
    if (depth > 0 && (cardShaped(b) || depth > 4)) return leaves.push(b);
    const rws = runs(b.y0, b.y1, (y) => rowHas(y, b.x0, b.x1));
    if (rws.length > 1) return rws.forEach(([a, z]) => split({ ...b, y0: a, y1: z }, depth + 1));
    const cls = runs(b.x0, b.x1, (x) => colHas(x, b.y0, b.y1));
    if (cls.length > 1) return cls.forEach(([a, z]) => split({ ...b, x0: a, x1: z }, depth + 1));
    leaves.push(b);
  }
  split({ x0: 0, y0: 0, x1: w - 1, y1: h - 1 }, 0);

  // Borderless cards (enchantments) can come apart into a name bar and the
  // art below it: stitch stacked pieces back together if that makes a card.
  for (let again = true; again;) {
    again = false;
    leaves.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    outer: for (let i = 0; i < leaves.length; i++) for (let j = 0; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      if (i === j || b.y0 <= a.y1 || b.y0 - a.y1 > 24 || cardShaped(a) || cardShaped(b)) continue;
      const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (ov < 0.85 * Math.max(dims(a).w, dims(b).w)) continue;
      const m = { x0: Math.min(a.x0, b.x0), y0: a.y0, x1: Math.max(a.x1, b.x1), y1: b.y1 };
      if (!cardShaped(m)) continue;
      leaves.splice(Math.max(i, j), 1); leaves.splice(Math.min(i, j), 1, m); again = true; break outer;
    }
  }
  leaves.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  const pixel = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  const share = (b, test) => { let n = 0, t = 0; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { t++; if (test(pixel(x, y))) n++; } return t ? n / t : 0; };
  const out = [];
  leaves.forEach((b, i) => {
    const { w: bw, h: bh } = dims(b);
    // A group's name bar: the first piece, full width, short.
    if (i === 0 && leaves.length > 1 && bw >= 0.8 * w && bh < 90 && !cardShaped(b)) return;
    let type;
    if (cardShaped(b)) {
      // Monsters and spells have a cost box: a white line down the right
      // end of the name bar. Enchantments' name bar runs the full width.
      const white = ([r, g2, bl, a]) => a > 40 && r + g2 + bl > 600;
      const top = { y0: b.y0 + Math.round(bh * 0.02), y1: b.y0 + Math.round(bh * 0.08) };
      let costBox = false;
      for (let x = b.x0 + Math.round(bw * 0.55); x <= b.x1 - 6 && !costBox; x++) costBox = share({ x0: x, x1: x, ...top }, white) > 0.85;
      const foot = { x0: b.x0 + 4, x1: b.x0 + Math.round(bw * 0.3), y0: b.y1 - Math.round(bh * 0.14), y1: b.y1 - 3 };
      const red = share(foot, ([r, g2, bl]) => r > 150 && g2 < 90 && bl < 90);
      type = !costBox ? "Enchantment" : red > 0.01 ? "Monster" : "Spell";
    } else type = "Artifact";
    const k = document.createElement("canvas");
    const kg = () => { const x = k.getContext("2d"); x.imageSmoothingQuality = "high"; return x; };
    if (type === "Artifact") {
      const scale = Math.min(1, ARTIFACT_MAX_W / bw);
      k.width = Math.round(bw * scale); k.height = Math.round(bh * scale);
      kg().drawImage(c, b.x0, b.y0, bw, bh, 0, 0, k.width, k.height);
    } else {
      // What the editors draw is the game's frame without its 6px see-through
      // edge (164x234 of 176x246): put it back so the game's layout lines up.
      k.width = CARD_W; k.height = CARD_H;
      kg().drawImage(c, b.x0, b.y0, bw, bh, 6, 6, CARD_W - 12, CARD_H - 12);
    }
    out.push({ type, src: k.toDataURL("image/png"), from: `${bw}x${bh}@${b.x0},${b.y0}`, size: `${k.width}x${k.height}` });
  });
  return { w, h, bg: bg.join(","), parts: out };
}
