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

import { feildGroups, tribePath } from "./feild.js";

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

function idbImage(factory, id) {
  return new Promise((ok) => {
    let req;
    try { req = factory.open("undercards", 1); } catch (e) { return ok(null); }
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
  const image = async (id) => {
    if (!id) return null;
    if (/^https?:/.test(id)) return toDataUrl(id);
    if (avatars[id]) return toDataUrl(`/resources/images/avatars/${avatars[id]}.png`);
    const rec = await idbImage(indexedDB, id);
    return rec ? toDataUrl(rec.file || rec.src) : null;
  };
  const ls = localStorage;
  const el = (id) => { try { return JSON.parse(ls.getItem("data:el:" + id)); } catch (e) { return null; } };
  let groupIds = [];
  try { groupIds = JSON.parse(ls.getItem("app:groups") || "[]"); } catch (e) { groupIds = []; }
  const allIds = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith("data:el:")) allIds.push(k.slice(8));
  }
  return feildGroups({ el, groupIds, allIds }, { image, tribeIcon: (t) => toDataUrl(tribePath(t)) });
}

export function readEditorCards(source) {
  return source === "feildmaster" ? readFeildmaster() : readUcEditor();
}
