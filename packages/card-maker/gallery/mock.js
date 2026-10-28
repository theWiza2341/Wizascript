// packages/card-maker/gallery/mock.js
//
// TEMPORARY, for trying Browse layouts before the gallery is live: sample
// entries made from real Undercards cards (the game's own card list, the
// same one Tier List Maker and Card History read) and artifacts (the
// Decks page's /DecksConfig, as Card History reads them; their text comes
// from the game's translations), plus a few invented enchantments with no
// art (the game only loads enchantment art in a match), with made-up authors,
// dates and scores. Nothing here is sent anywhere, and the sample votes are
// only kept until the page is refreshed.

import { getPageWindow } from "../../core/page-window.js";

const AUTHORS = ["SampleMaker", "PixelSmith", "TestPlayer", "CardFan", "MockAuthor", "DraftWizard", "ExampleUser", "Placeholder"];
const SET_NAMES = ["Hotland Heat", "Snowdin Patrol", "Core Meltdown", "Ruins Revival", "Dark World Deals", "Waterfall Echoes", "Royal Lab"];

let cardFile = null; // the game's card file, when this page has no card list
function gameCards() {
  const w = getPageWindow();
  if (Array.isArray(w.allCards) && w.allCards.length) return w.allCards;
  if (cardFile && cardFile.length) return cardFile;
  try {
    const ls = JSON.parse(w.localStorage.getItem("allCards") || "[]");
    if (Array.isArray(ls)) return ls;
  } catch (e) { /* no cached list */ }
  return [];
}

function tr(key) {
  try {
    const $ = getPageWindow().$;
    const v = $ && $.i18n ? $.i18n(key) : "";
    if (!v || v === key) return "";
    const d = document.createElement("div");
    d.innerHTML = String(v).replace(/<br\s*\/?>/gi, "\n");
    return d.textContent;
  } catch (e) {
    return "";
  }
}

function toPart(c, i) {
  const ext = c.extension === "DELTARUNE" ? "DELTARUNE" : c.extension === "UTY" ? "UTY" : "BASE";
  const monster = c.typeCard === 0;
  return {
    id: `mock${i}`,
    source: "sample",
    type: monster ? "Monster" : "Spell",
    name: tr(`card-name-${c.fixedId || c.id}`) || c.name || "",
    cost: c.cost,
    atk: monster ? c.attack : undefined,
    hp: monster ? c.hp : undefined,
    desc: tr(`card-${c.fixedId || c.id}`) || (c.description ? String(c.description).replace(/<[^>]+>/g, "") : ""),
    art: c.image ? `/images/cards/${c.image}.png` : "",
    rarity: c.rarity ? `${ext}_${c.rarity}` : "",
    tribes: []
  };
}

// Artifacts: { id, name, image, legendary, unavailable, custom, disabled }
// (no text: that's the "artifact-<id>" translation).
let artifacts = null;
let extras = null;
export function loadSampleExtras() {
  if (extras) return extras;
  const cards = gameCards().length ? Promise.resolve(false) : (() => {
    const cfg = getPageWindow().cardsClientConfig;
    if (!cfg || !cfg.url) return Promise.resolve(false);
    return fetch(cfg.url, { credentials: "same-origin" }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : (d && (d.cards || d.allCards)) || [];
      cardFile = typeof list === "string" ? JSON.parse(list) : list;
      return cardFile.length > 0;
    }).catch(() => false);
  })();
  const arts = fetch("/DecksConfig", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((d) => {
      const raw = d && d.allArtifacts;
      artifacts = ((typeof raw === "string" ? JSON.parse(raw) : raw) || []).filter((a) => a && a.image && !a.disabled && !a.custom);
      return artifacts.length > 0;
    })
    .catch(() => false);
  extras = Promise.all([cards, arts]).then(([a, b]) => { cache = null; return a || b; });
  return extras;
}

// Invented enchantments (placeholder names; no art).
const ENCHANTS = [
  ["Sample Bonfire", "After a monster is played here, deal 2 DMG to it."],
  ["Sample Snowfall", "Monsters here have -1 ATK."],
  ["Sample Spotlight", "At the end of your turn, give the monster here +1/+1."],
  ["Sample Echo Flowers", "When a monster here dies, draw 1 card."],
  ["Sample Conveyor", "At the start of your turn, the monster here gets Haste."],
  ["Sample Puzzle Floor", "Spells that target a monster here cost 1 more."]
];

function artifactPart(a, i) {
  const rarity = a.unavailable === true ? "TOKEN" : a.legendary === true ? "LEGENDARY" : a.legendary === false ? "COMMON" : String(a.rarity || "COMMON").toUpperCase();
  return {
    id: `mocka${i}`,
    source: "sample",
    type: "Artifact",
    name: tr(`artifact-name-${a.id}`) || a.name || "",
    desc: tr(`artifact-${a.id}`) || (a.description ? String(a.description).replace(/<[^>]+>/g, "") : ""),
    art: `/images/artifacts/${a.image}.png`,
    rarity
  };
}

let cache = null;
// About 36 entries: mostly single cards, with a few sets of 2-4.
export function sampleEntries() {
  if (cache) return cache;
  const cards = gameCards().filter((c) => c && c.name && c.image && (c.typeCard === 0 || c.typeCard === 1) && c.rarity !== "TOKEN");
  if (!cards.length && !(artifacts && artifacts.length)) return [];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const pool = cards.slice().sort(() => rnd() - 0.5);
  const out = [];
  let n = 0;
  for (let e = 0; e < 36 && n < pool.length; e++) {
    const isSet = e % 6 === 2;
    const size = isSet ? 2 + Math.floor(rnd() * 3) : 1;
    const parts = pool.slice(n, n + size).map((c, k) => toPart(c, n + k));
    n += size;
    out.push({
      key: `sample${e}`,
      kind: isSet && parts.length > 1 ? "set" : "single",
      title: isSet ? SET_NAMES[(e / 6 | 0) % SET_NAMES.length] : parts[0].name,
      parts,
      author: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
      days: Math.floor(rnd() * rnd() * 120),
      base: Math.floor(rnd() * rnd() * 140) - 8,
      sample: true
    });
  }
  // Artifacts: every fifth entry or so, never in a set.
  (artifacts || []).slice().sort(() => rnd() - 0.5).slice(0, 8).forEach((a, k) => {
    const part = artifactPart(a, k);
    out.splice(Math.min(out.length, 3 + k * 5), 0, {
      key: `samplea${k}`, kind: "single", title: part.name, parts: [part],
      author: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
      days: Math.floor(rnd() * rnd() * 120), base: Math.floor(rnd() * rnd() * 140) - 8, sample: true
    });
  });
  // Enchantments: a few, one as part of a set.
  ENCHANTS.forEach(([name, desc], k) => {
    const part = { id: `mocke${k}`, source: "sample", type: "Enchantment", name, desc, art: "" };
    const setAt = out.findIndex((e) => e.kind === "set" && !e.parts.some((p) => p.type === "Enchantment"));
    if (k === 0 && setAt >= 0) { out[setAt].parts.push(part); return; }
    out.splice(Math.min(out.length, 5 + k * 6), 0, {
      key: `samplee${k}`, kind: "single", title: name, parts: [part],
      author: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
      days: Math.floor(rnd() * rnd() * 120), base: Math.floor(rnd() * rnd() * 140) - 8, sample: true
    });
  });
  return (cache = out);
}
