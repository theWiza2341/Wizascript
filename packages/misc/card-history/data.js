// packages/misc/card-history/data.js
//
// Card History's data is built in this repo by the "Card History data"
// GitHub Action (branch `card-history`, folder card-history/) and read from
// there on demand, one small file per card or artifact. Nothing is stored on
// the player's side: files are kept in memory for this page only.
//
//   data/cards/<id>.json        one card's versions
//   data/artifacts/<name>.json  one artifact's versions (name lower-cased, letters/digits only)
//   data/index.json             when it was built
//   rules.json                  word lists for the text formatting (edit live, no rebuild)
//   reports.json                versions players reported as wrong (written by the bot)
//   assets/sprites/<Name>.png   old card art for reworked cards

import { getJson as fetchJson } from "../../core/http.js";

export const BASE = "https://raw.githubusercontent.com/theWiza2341/Wizascript/card-history/card-history/";

const memo = new Map();

// Through core/http.js (no extra headers, so a plain fetch works too).
const getJson = (url) => fetchJson(url, { timeout: 20000 }).catch((e) => { throw new Error(e.kind === "timeout" ? "timed out" : e.message); });

function cached(path) {
  if (!memo.has(path)) {
    const p = getJson(BASE + path).catch((e) => { memo.delete(path); throw e; });
    memo.set(path, p);
  }
  return memo.get(path);
}

export const slug = (name) => String(name || "").toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "") || "unnamed";

export const getIndex = () => cached("data/index.json");
export const getCardData = (id) => cached(`data/cards/${id}.json`);
export const getArtifactData = (name) => cached(`data/artifacts/${slug(name)}.json`);
export const getRules = () => cached("rules.json").catch(() => null);
export const getReports = () => cached("reports.json");
export const spriteUrl = (file) => `${BASE}assets/sprites/${encodeURIComponent(file)}.png`;
