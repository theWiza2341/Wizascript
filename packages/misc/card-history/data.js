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

export const BASE = "https://raw.githubusercontent.com/theWiza2341/Wizascript/card-history/card-history/";

const memo = new Map();

function getJson(url) {
  return new Promise((resolve, reject) => {
    const fail = (msg) => reject(new Error(msg));
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { "Cache-Control": "no-cache" },
        onload(res) {
          if (res.status === 404) return resolve(null);
          if (res.status !== 200) return fail(`HTTP ${res.status}`);
          try { resolve(JSON.parse(res.responseText)); } catch (e) { fail("bad JSON"); }
        },
        onerror: () => fail("network error"),
        ontimeout: () => fail("timed out"),
        timeout: 20000
      });
      return;
    }
    fetch(url).then((r) => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(resolve, reject);
  });
}

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
