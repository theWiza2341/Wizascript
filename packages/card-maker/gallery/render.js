// packages/card-maker/gallery/render.js
//
// Draws a gallery part the same way whichever editor it came from, in the
// game's own card layout (both editors copy it: card 176x246; name 8,8;
// cost 128,8; art 8,36 160x90; text 8,128 160x80; ATK / rarity / HP at
// 8 / 76 / 128, 212). Enchantments: no stats, art 8,54 160x183 under the
// text. Artifacts: a 176-wide panel with the 64x64 icon shown at 32x32.
// Frames, rarity icons and the DTM-Mono font are the game's own: taken from
// undercards.net when the page has them there, otherwise from UC Editor's
// copies of the same files (sernon158.github.io/uc-editor/images/...);
// without either, frames are drawn with CSS lines.
//
// Text uses the union of both editors' markup: _x_ underline, {x}
// highlight, {colour;text}, [[x]], {{stats:a|b|c}}; keywords underlined,
// cost/ATK/HP/DMG/KR/G, souls, rarities and TOKEN coloured.

import { h, esc } from "./dom.js";

export const CARD_W = 176;
export const CARD_H = 246;
const UCE = "https://sernon158.github.io/uc-editor/";
// Where the game's card images are, in order of preference.
const ASSET_BASES = ["/images/", `${UCE}images/`];
let assetBase = null; // set by checkFrameImages()
export const FRAME = (kind) => `${assetBase || ASSET_BASES[0]}frameSkins/Undertale/frame_${kind}.png`;

const KEYWORDS = ["Flowery Power", "Turn start", "Turn end", "Magic", "Dust", "Charge", "Haste", "Armor", "Disarmed", "Candy", "Fatigue", "Turbo", "Support", "Paralyze", "Silence", "Transparency", "Invulnerable", "Taunt", "Dodge", "Burn", "Synergy", "Shock", "Delay", "Generated", "Need", "Loop", "Program", "Switch", "Catch", "Bullseye", "Wanted", "Erase", "Darkspawn", "Goal", "Reward", "Quest"];
export const SPECIAL = { cost: "#00d0ff", ATK: "#f0003c", HP: "#0dd000", DMG: "gold", G: "gold", KR: "#d535d9", KINDNESS: "#00c000", DETERMINATION: "red", DT: "red", PATIENCE: "#41fcff", BRAVERY: "#fca500", INTEGRITY: "#0064ff", PERSEVERANCE: "#d535d9", JUSTICE: "#ffff00", TOKEN: "#00c800", BASE: "gray", COMMON: "#fff", RARE: "#00b8ff", EPIC: "#d535d9", LEGENDARY: "gold" };

const kwRe = new RegExp(`(^|[^\\w])(${KEYWORDS.map((k) => k.replace(/ /g, "\\s")).join("|")})(?=[^\\w]|$)`, "g");
const spRe = new RegExp(`(^|[^\\w{"#])(${Object.keys(SPECIAL).join("|")})(?![\\w}])`, "g");

export function formatText(desc) {
  const t = esc(desc)
    .replace(/\{\{stats:([^}]*)\}\}/gi, (_, a) => a.split("|").join("/"))
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/(?<!\\)_([^_]+)_/g, "<u>$1</u>")
    .replace(/\{(#?[\w]+)[;|]([^}]*)\}/g, '<span style="color:$1">$2</span>')
    .replace(/\{([^{}]+)\}/g, '<span style="color:#41fcff">$1</span>')
    .replace(/\\/g, "")
    .replace(/\n/g, "<br>");
  return t.split(/(<[^>]+>)/).map((seg, i) => (i % 2 ? seg
    : seg.replace(kwRe, "$1<u>$2</u>").replace(spRe, (_, pre, k) => `${pre}<span style="color:${SPECIAL[k]}">${k}</span>`))).join("");
}

export const rarityColor = (r) => SPECIAL[(r || "").split("_").pop()] || "#fff";
const soulColor = (s) => SPECIAL[s] || (/^#[0-9a-f]{3,8}$/i.test(s || "") ? s : "");

let frameImages = null; // null = not checked yet; true/false after
let checking = null;
export function checkFrameImages() {
  if (frameImages !== null) return Promise.resolve(frameImages);
  if (checking) return checking;
  const tryBase = (i) => new Promise((ok) => {
    if (i >= ASSET_BASES.length) return ok(false);
    const img = new Image();
    img.onload = () => { assetBase = ASSET_BASES[i]; ok(true); };
    img.onerror = () => tryBase(i + 1).then(ok);
    img.src = `${ASSET_BASES[i]}frameSkins/Undertale/frame_monster.png`;
  });
  checking = tryBase(0).then((found) => (frameImages = found));
  return checking;
}

// A rarity icon: the game's, then UC Editor's copy, then nothing (no broken image).
function rarityImage(name) {
  const tries = [assetBase, ...ASSET_BASES.filter((b) => b !== assetBase)].filter(Boolean).map((b) => `${b}rarity/${name}.png`);
  const img = h("img", { class: "wz-gl-rar", alt: "" });
  let n = 0;
  img.addEventListener("error", () => { if (++n < tries.length) img.src = tries[n]; else img.remove(); });
  img.src = tries[0];
  return img;
}

export function tile(p) {
  if (p.picture && p.type === "Artifact") return h("img", { class: "wz-gl-artpic", src: p.picture, alt: "" });
  if (p.picture) return h("div", { class: "wz-gl-card wz-gl-pic" }, h("img", { src: p.picture, alt: "" }));
  if (p.type === "Artifact") {
    const colour = rarityColor(p.rarity);
    // A card's space (176 x 246); fitCard() makes it two spaces wide when
    // its text won't fit one at a readable size.
    const icon = h("img", { class: "wz-gl-icon", src: p.art || "", alt: "" });
    icon.addEventListener("error", () => { icon.style.visibility = "hidden"; }, { once: true });
    return h("div", { class: "wz-gl-artifact", style: { borderColor: colour } },
      h("div", { class: "wz-gl-arthead" },
        icon,
        h("div", { class: "wz-gl-artname", style: { color: colour } }, h("span", { text: p.name || "(no name)" }))),
      h("div", { class: "wz-gl-rarity", text: (p.rarity || "").split("_").pop(), style: { color: colour } }),
      h("div", { class: "wz-gl-arttext" }, h("div", { html: formatText(p.desc) })));
  }
  const kind = p.type === "Enchantment" ? "enchant" : p.type.toLowerCase();
  const name = h("div", { class: "wz-gl-name" }, h("span", { text: p.name || "(no name)", style: { color: p.type === "Spell" ? soulColor(p.soul) : "" } }));
  const tribes = h("div", { class: "wz-gl-tribes" }, (p.tribes || []).map((t, i) => h("img", { src: t.icon, title: t.name || "", alt: "", style: { right: i * 17 + "px" } })));
  let rarity = null;
  if (p.type !== "Enchantment") {
    if (p.rarityIcon) {
      rarity = h("img", { class: "wz-gl-rar", src: p.rarityIcon, alt: "" });
      rarity.addEventListener("error", () => rarity.remove(), { once: true });
    } else if (p.rarity) rarity = rarityImage(p.rarity);
  }
  // Enchantments: the game has no enchantment frame to load, so they get a
  // drawn outer frame only.
  const framed = frameImages && kind !== "enchant";
  return h("div", { class: `wz-gl-card t-${kind}${framed ? " framed" : ""}` },
    h("div", { class: "wz-gl-bg" }),
    p.art ? h("img", { class: "wz-gl-art", src: p.art, alt: "" }) : null,
    h("div", { class: "wz-gl-shade" }),
    h("div", { class: "wz-gl-frame", style: framed ? { backgroundImage: `url(${FRAME(kind)})` } : {} }),
    ["l1", "l2", "l3", "v1", "v2", "v3"].map((c) => h("i", { class: c })),
    name,
    h("div", { class: "wz-gl-cost", text: p.type === "Enchantment" ? "" : String(p.cost ?? "") }),
    tribes,
    h("div", { class: "wz-gl-text" }, h("div", { html: formatText(p.desc) })),
    p.type === "Monster" ? h("div", { class: "wz-gl-atk", text: String(p.atk ?? "") }) : null,
    rarity,
    p.type === "Monster" ? h("div", { class: "wz-gl-hp", text: String(p.hp ?? "") }) : null);
}

// Fit names and text the way UC Editor does (sernon158's getResizedFontSize,
// used with his permission): measure a copy of the card at 100%, and while
// the text is as tall as its box or taller, take 0.5px off the font size,
// at most 12 times. Text starts at 12px (box 81px, enchantments 184px);
// names start at 14px and must stay on one line (box 25px). Results are
// cached by card, so a page of cards is measured once.
const FIT_STEPS = 12;
const fitCache = new Map();
let measureHost = null;
function host() {
  if (!measureHost || !measureHost.isConnected) {
    measureHost = h("div", { "aria-hidden": "true", style: { position: "fixed", left: "-10000px", top: "0", visibility: "hidden", pointerEvents: "none", zoom: "1" } });
    (document.body || document.documentElement).appendChild(measureHost);
  }
  return measureHost;
}
function shrink(sizeEl, measureEl, start, max, wide) {
  let size = start, i = 0;
  sizeEl.style.fontSize = size + "px";
  const over = () => measureEl.offsetHeight >= max || (wide && measureEl.scrollWidth > measureEl.clientWidth + 1);
  while (i < FIT_STEPS && over()) { size -= 0.5; sizeEl.style.fontSize = size + "px"; i++; }
  return size;
}
// Sizes measured before the card font has loaded are wrong, so they aren't
// kept, and everything is measured again whenever a font finishes loading.
let fontsReady = false;
const fontListeners = [];
export function onFontsChange(f) { fontListeners.push(f); }
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener("loadingdone", () => { fitCache.clear(); fontListeners.forEach((f) => f()); });
}
export function whenFontsReady() {
  if (fontsReady || !document.fonts) return Promise.resolve();
  return Promise.all([document.fonts.load('12px "DTM-Mono"'), document.fonts.load('12px "WZ DTM Mono"')].map((p) => p.catch(() => null)))
    .then(() => document.fonts.ready)
    .then(() => { fontsReady = true; fitCache.clear(); });
}
export function fitCard(card) {
  const name = card.querySelector(".wz-gl-name"), text = card.querySelector(".wz-gl-text > div"), art = card.querySelector(".wz-gl-arttext");
  const isArt = card.classList.contains("wz-gl-artifact");
  const key = card.className.replace(" wz-gl-wide", "") + "\u0001" + (name ? name.innerHTML : "") + "\u0001" + (text ? text.innerHTML : "") + "\u0001" + (art ? art.innerHTML : "");
  let r = fitCache.get(key);
  if (!r) {
    const c = card.cloneNode(true);
    c.style.zoom = "1";
    c.classList.remove("wz-gl-wide");
    host().appendChild(c);
    r = {};
    const n = c.querySelector(".wz-gl-name");
    if (n) r.name = shrink(n, n.firstElementChild || n, 14, 25, n);
    const t = c.querySelector(".wz-gl-text > div");
    if (t) r.text = shrink(t, t, 12, card.classList.contains("t-enchant") ? 184 : 81);
    if (isArt) {
      // Name: up to two lines. Text: down to 9px in one space; if it still
      // doesn't fit, two spaces wide, down to 7px.
      const an = c.querySelector(".wz-gl-artname");
      r.artName = shrinkBox(an, 14, 8);
      const a = c.querySelector(".wz-gl-arttext");
      r.art = shrinkBox(a, 12, 9);
      if (a.scrollHeight > a.clientHeight + 1) {
        c.classList.add("wz-gl-wide");
        r.wide = true;
        r.artName = shrinkBox(an, 14, 8);
        r.art = shrinkBox(a, 12, 7);
      }
    }
    c.remove();
    if (fontsReady) { if (fitCache.size > 2000) fitCache.clear(); fitCache.set(key, r); }
  }
  if (name && r.name) name.style.fontSize = r.name + "px";
  if (text && r.text) text.style.fontSize = r.text + "px";
  if (isArt) {
    card.classList.toggle("wz-gl-wide", !!r.wide);
    const an = card.querySelector(".wz-gl-artname");
    if (an && r.artName) an.style.fontSize = r.artName + "px";
    if (art && r.art) art.style.fontSize = r.art + "px";
  }
}
// Shrink until the box's content fits inside it, down to min px.
function shrinkBox(el, start, min) {
  let size = start;
  el.style.fontSize = size + "px";
  while (size > min && el.scrollHeight > el.clientHeight + 1) { size -= 0.5; el.style.fontSize = size + "px"; }
  return size;
}
export function fitText(root) {
  root.querySelectorAll(".wz-gl-card:not(.wz-gl-pic), .wz-gl-artifact").forEach(fitCard);
}

// The game's card font. "DTM-Mono" if undercards.net already provides it;
// otherwise this loads UC Editor's copy of the same font file.
export const CARD_FONT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;
export const TILE_CSS = `
@font-face { font-family: "WZ DTM Mono"; src: url("/fonts/DTM-Mono.otf") format("opentype"), url("${UCE}images/fonts/DTM-Mono.otf") format("opentype"); font-display: swap; }
.wz-gl-card, .wz-gl-artifact { font-family: ${CARD_FONT}; }
/* Like the game (Bootstrap): sizes include padding and borders, inside or outside the window. */
.wz-gl-card, .wz-gl-card *, .wz-gl-artifact, .wz-gl-artifact * { box-sizing: border-box; }
.wz-gl-card { position: relative; width: ${CARD_W}px; height: ${CARD_H}px; color: #fff; font-size: 12px; line-height: 1.42857; text-align: center; overflow: hidden; flex: none; }
.wz-gl-card > * { position: absolute; }
.wz-gl-bg { left: 8px; top: 8px; width: 160px; height: 230px; background: #000; }
.wz-gl-art { left: 8px; top: 36px; width: 160px; height: 90px; image-rendering: pixelated; }
.t-enchant .wz-gl-art { top: 54px; height: 183px; }
.wz-gl-shade { left: 8px; top: 54px; width: 160px; height: 183px; background: rgba(0,0,0,.6); display: none; }
.t-enchant .wz-gl-shade { display: block; }
.wz-gl-frame { left: 0; top: 0; width: 176px; height: 246px; background-repeat: no-repeat; z-index: 3; }
.wz-gl-card:not(.framed) .wz-gl-frame { left: 6px; top: 6px; width: 164px; height: 234px; border: 2px solid #fff; }
.wz-gl-card i { background: #fff; z-index: 3; display: none; }
.wz-gl-card:not(.framed) i { display: block; }
.wz-gl-card .l1 { left: 6px; top: 34px; width: 164px; height: 2px; }
.t-monster .l2, .t-spell .l2 { left: 6px; top: 126px; width: 164px; height: 2px; }
.t-monster .l3, .t-spell .l3 { left: 6px; top: 210px; width: 164px; height: 2px; }
.t-monster .v1, .t-spell .v1 { left: 125px; top: 6px; width: 2px; height: 30px; }
.t-monster .v2 { left: 49px; top: 210px; width: 2px; height: 30px; }
.t-monster .v3 { left: 125px; top: 210px; width: 2px; height: 30px; }
.t-enchant .l2 { left: 6px; top: 52px; width: 164px; height: 2px; }
.wz-gl-name { left: 8px; top: 9px; width: 116px; height: 24px; line-height: 24px; font-size: 14px; padding: 0 5px; overflow: hidden; text-align: left; z-index: 5; }
.wz-gl-name > span { display: block; min-height: 100%; overflow-wrap: normal; }
.t-enchant .wz-gl-name { width: 160px; }
.wz-gl-cost { left: 128px; top: 9px; width: 40px; height: 24px; line-height: 24px; font-size: 20px; color: #00d0ff; z-index: 5; }
.wz-gl-tribes { right: 12px; top: 106px; height: 16px; width: 80px; z-index: 6; }
.wz-gl-tribes img { position: absolute; top: 0; max-width: 16px; max-height: 16px; }
.wz-gl-text { left: 8px; top: 129px; width: 160px; height: 80px; display: table; z-index: 5; font-size: 12px; }
.t-enchant .wz-gl-text { top: 54px; height: 183px; }
.wz-gl-text > div { display: table-cell; vertical-align: middle; }
.wz-gl-atk, .wz-gl-hp { top: 213px; width: 40px; height: 24px; line-height: 24px; font-size: 20px; z-index: 5; }
.wz-gl-atk { left: 8px; color: #f0003c; } .wz-gl-hp { left: 128px; color: #0dd000; }
.wz-gl-rar { left: 76px; top: 213px; width: 24px; height: 24px; z-index: 5; image-rendering: pixelated; }
.wz-gl-pic img { left: 0; top: 0; width: 176px; height: 246px; }
.wz-gl-artpic { display: block; width: 176px; height: auto; }
.wz-gl-artifact { width: ${CARD_W}px; height: ${CARD_H}px; border: 2px solid #fff; background: #000; padding: 8px; color: #fff; font-size: 12px; line-height: 1.42857; text-align: left; flex: none; display: flex; flex-direction: column; overflow: hidden; }
.wz-gl-artifact.wz-gl-wide { width: ${CARD_W * 2 + 3}px; }
.t-enchant i { display: none !important; }
.wz-gl-arthead { display: flex; align-items: center; gap: 8px; flex: none; }
.wz-gl-icon { width: 32px; height: 32px; image-rendering: pixelated; border: 1px solid #fff; flex: none; }
.wz-gl-artname { flex: 1 1 auto; min-width: 0; height: 40px; font-size: 14px; line-height: 1.25; overflow: hidden; display: flex; align-items: center; overflow-wrap: anywhere; }
.wz-gl-artname > span { max-height: 100%; }
.wz-gl-rarity { font-size: 10px; margin: 3px 0; }
.wz-gl-rarity { flex: none; padding-bottom: 4px; margin-bottom: 5px; border-bottom: 2px solid currentColor; }
.wz-gl-arttext { flex: 1 1 auto; min-height: 0; overflow: hidden; }
`;
