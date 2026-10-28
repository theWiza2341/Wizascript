// packages/card-maker/gallery/reader.js
//
// Runs INSIDE the card editors (part of the frame bundle, see frame.js),
// only while one is shown in the Card Maker. When the Card Gallery asks
// ("Read from this editor"), it reads the cards the player has made from
// the editor's own saved data and sends them back to the Card Maker:
//   { tag, type: "cards", source, groups: [{ name, parts: [raw part] }] }
// A raw part is { type, name, desc, cost, atk, hp, soul, rarity,
// rarityIcon, tribes: [{ name, icon }], imageType, image }, every image as
// a data: URL. Nothing is changed in the editor.
//
// Where each editor keeps its work (read from their source, 2026-10):
//  - UC Editor: localStorage "autosave" = [{ name, artifacts, cards }],
//    rewritten from the page every second (updateAutosave()).
//  - feildmaster's: localStorage "data:el:<id>" per element and
//    "app:groups" (the shown groups); uploaded images in IndexedDB
//    "undercards" / "images"; built-in card art is an avatar name
//    (/resources/data/avatars.json -> /resources/images/avatars/<file>.png).

const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

function blobToDataUrl(blob) {
  return new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => ok(null);
    r.readAsDataURL(blob);
  });
}

async function toDataUrl(src) {
  if (!src) return null;
  if (typeof src !== "string") return blobToDataUrl(src);
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(new URL(src, location.href));
    return res.ok ? blobToDataUrl(await res.blob()) : null;
  } catch (e) {
    return null;
  }
}

const cssUrl = (v) => (/url\(["']?([^"')]+)["']?\)/.exec(v || "") || [])[1] || (v && v !== "none" ? v : null);
const rarityName = (u) => (/([A-Z]+_[A-Z]+)\.png/i.exec(u || "") || [])[1] || null;

async function readUcEditor() {
  try { if (typeof page.updateAutosave === "function") page.updateAutosave(); } catch (e) { /* use what's saved */ }
  let save = [];
  try { save = JSON.parse(localStorage.getItem("autosave") || "[]"); } catch (e) { save = []; }
  if (!Array.isArray(save)) save = [save];
  const groups = [];
  for (const g of save) {
    if (!g) continue;
    const parts = [];
    for (const a of g.artifacts || []) {
      parts.push({ type: "Artifact", name: a.name || "", desc: a.desc || "", rarity: a.rarity || null, image: await toDataUrl(a.image) });
    }
    for (const c of g.cards || []) {
      const type = { 0: "Monster", 1: "Spell", 99: "Enchantment" }[c.cardType];
      if (!type) continue;
      const r = cssUrl(c.rarity);
      parts.push({
        type,
        name: c.name || "",
        desc: c.desc || "",
        cost: type === "Monster" ? (c.stats || [])[0] : type === "Spell" ? c.stats : null,
        atk: type === "Monster" ? (c.stats || [])[1] : null,
        hp: type === "Monster" ? (c.stats || [])[2] : null,
        soul: c.spellSoul || null,
        rarity: c.isRarityCustom ? null : rarityName(r),
        rarityIcon: c.isRarityCustom ? await toDataUrl(r) : null,
        tribes: await Promise.all((c.tribes || []).map(async (t) => ({ name: t.name || null, icon: await toDataUrl(t.src) }))),
        imageType: c.imageType || "standard",
        image: await toDataUrl(cssUrl(c.image))
      });
    }
    groups.push({ name: g.name || "Group", parts });
  }
  return groups;
}

function idbImage(id) {
  return new Promise((ok) => {
    let req;
    try { req = indexedDB.open("undercards", 1); } catch (e) { return ok(null); }
    req.onupgradeneeded = (e) => e.target.result.createObjectStore("images", { keyPath: "id" });
    req.onerror = () => ok(null);
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const get = db.transaction("images").objectStore("images").get(id);
        get.onsuccess = () => { ok(get.result || null); db.close(); };
        get.onerror = () => { ok(null); db.close(); };
      } catch (err) {
        ok(null);
      }
    };
  });
}

async function readFeildmaster() {
  let avatars = {};
  try { avatars = await (await fetch("/resources/data/avatars.json")).json(); } catch (e) { avatars = {}; }
  const isId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || "");
  const image = async (id) => {
    if (!id) return null;
    if (/^https?:/.test(id)) return toDataUrl(id);
    if (avatars[id]) return toDataUrl(`/resources/images/avatars/${avatars[id]}.png`);
    const rec = await idbImage(id);
    return rec ? toDataUrl(rec.file || rec.src) : null;
  };
  const el = (id) => { try { return JSON.parse(localStorage.getItem("data:el:" + id)); } catch (e) { return null; } };
  const toPart = async (e) => {
    if (!e) return null;
    const base = { name: e.name || "", desc: e.description || "", image: await image(e.image) };
    if (e.type === "text") return { type: "Artifact", ...base, rarity: e.rarity || "COMMON" };
    if (e.type !== "card") return null;
    const spell = e.health === undefined || e.health === null;
    return {
      type: spell ? "Spell" : "Monster",
      ...base,
      cost: e.cost ?? 0,
      atk: spell ? null : e.attack ?? 0,
      hp: spell ? null : e.health ?? 0,
      soul: e.soul || null,
      rarity: isId(e.rarity) ? null : e.rarity || "COMMON",
      rarityIcon: isId(e.rarity) ? await image(e.rarity) : null,
      tribes: await Promise.all((e.tribes || []).filter((t) => t && t !== "none").map(async (t) => ({
        name: isId(t) ? null : t,
        icon: isId(t) ? await image(t) : await toDataUrl(`/resources/tribes/${String(t).toUpperCase().replace(/ /g, "_")}.png`)
      }))),
      imageType: "standard"
    };
  };
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem("app:groups") || "[]"); } catch (e) { ids = []; }
  const groups = [];
  const seen = new Set();
  for (const gid of ids) {
    const g = el(gid);
    if (!g) continue;
    const parts = [];
    for (const cid of g.content || []) {
      seen.add(cid);
      const p = await toPart(el(cid));
      if (p) parts.push(p);
    }
    groups.push({ name: g.name || "Group", parts });
  }
  const loose = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("data:el:")) continue;
    const id = k.slice(8);
    const e = el(id);
    if (!seen.has(id) && e && e.type !== "group") {
      const p = await toPart(e);
      if (p) loose.push(p);
    }
  }
  if (loose.length) groups.push({ name: "Not in a group", parts: loose });
  return groups;
}

export function readEditorCards(source) {
  return source === "feildmaster" ? readFeildmaster() : readUcEditor();
}
