// packages/card-maker/gallery/mock.js
//
// TEMPORARY, for trying Browse layouts before the gallery is live: sample
// entries made from real Undercards cards (the game's own card list, the
// same one Tier List Maker and Card History read), with made-up authors,
// dates and scores. Nothing here is sent anywhere, and the sample votes are
// only kept until the page is refreshed.

import { getPageWindow } from "../../core/page-window.js";

const AUTHORS = ["SampleMaker", "PixelSmith", "TestPlayer", "CardFan", "MockAuthor", "DraftWizard", "ExampleUser", "Placeholder"];
const SET_NAMES = ["Hotland Heat", "Snowdin Patrol", "Core Meltdown", "Ruins Revival", "Dark World Deals", "Waterfall Echoes", "Royal Lab"];

function gameCards() {
  const w = getPageWindow();
  if (Array.isArray(w.allCards) && w.allCards.length) return w.allCards;
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

let cache = null;
// About 36 entries: mostly single cards, with a few sets of 2-4.
export function sampleEntries() {
  if (cache) return cache;
  const cards = gameCards().filter((c) => c && c.name && c.image && (c.typeCard === 0 || c.typeCard === 1) && c.rarity !== "TOKEN");
  if (!cards.length) return (cache = []);
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
  return (cache = out);
}
