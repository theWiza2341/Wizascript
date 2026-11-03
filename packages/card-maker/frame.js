// packages/card-maker/frame.js
//
// The only part of Wizascript that runs on other sites: inside the two
// card editors, and only while one is shown in the Card Maker on
// undercards.net or on the Card Gallery website (opened on its own, or
// embedded by any other site, this returns at once and does nothing).
// build.js bundles it separately and runs it instead of the rest of
// Wizascript on the editors' sites.
//
// Two jobs:
//  1. Card Gallery (both editors): answers "Read from this editor" with
//     the cards the player has made (gallery/reader.js). Read-only.
//  2. feildmaster's editor only: tells the Card Maker whether the editor
//     drew, so a note can offer his site instead of a black screen if it
//     ever doesn't. (1.7.0-1.7.1 also had a hotfix here for his toast
//     library not starting inside frames; his editor fixed that itself on
//     2026-11-02, so 1.7.2 removed it.)

import { FRAME_MESSAGE } from "./editors.js";
import { readEditorCards } from "./gallery/reader.js";

const GIVE_UP_MS = 15000;
// The Card Gallery website's origin (GitHub Pages). An origin can't name a
// path, and every page under it is the maintainer's own.
const GALLERY_SITE = "https://thewiza2341.github.io";

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const drawn = () => !!document.querySelector(".element");
// ready() removes #loading first, so: gone + nothing drawn = it stopped.
const started = () => !document.getElementById("loading");

function watchFeildmaster(report) {
  (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < GIVE_UP_MS) {
      if (drawn()) return report({ status: "ok" });
      if (started()) {
        await sleep(1500); // give init() its moment
        return report({ status: drawn() ? "ok" : "broken" });
      }
      await sleep(250);
    }
    report({ status: "broken" });
  })();
}

export function runInsideEditor() {
  if (window === window.top) return; // the editor opened on its own: not ours
  const source = location.hostname === "undercard.feildmaster.com" ? "feildmaster"
    : location.hostname === "sernon158.github.io" && location.pathname.startsWith("/uc-editor") ? "sernon" : null;
  if (!source) return;
  // Only when the frame is the Card Maker's (undercards.net) or the Card
  // Gallery website's (thewiza2341.github.io/wizascript-gallery, the same
  // gallery for players without Wizascript), not some other site that
  // embeds the editor.
  const from = (location.ancestorOrigins && location.ancestorOrigins[0]) || document.referrer || "";
  let parentOrigin;
  try { parentOrigin = new URL(from).origin; } catch (e) { return; }
  if (!/^https:\/\/([a-z0-9-]+\.)*undercards\.net$/.test(parentOrigin) && parentOrigin !== GALLERY_SITE) return;

  const report = (data) => window.parent.postMessage({ tag: FRAME_MESSAGE, ...data }, parentOrigin);

  window.addEventListener("message", async (e) => {
    if (e.source !== window.parent || e.origin !== parentOrigin) return;
    if (!e.data || e.data.tag !== FRAME_MESSAGE || e.data.type !== "read") return;
    let groups = [];
    try { groups = await readEditorCards(source); } catch (err) { console.warn("[Wizascript Card Gallery] couldn't read the editor", err); }
    report({ type: "cards", source, groups });
  });

  if (source === "feildmaster") watchFeildmaster(report);
  else report({ status: "ok" });
}
