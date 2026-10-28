// packages/card-maker/frame.js
//
// The only part of Wizascript that runs on other sites: inside the two
// card editors, and only while one is shown in the Card Maker on
// undercards.net (opened on its own, or embedded by any other site, this
// returns at once and does nothing). build.js bundles it separately and
// runs it instead of the rest of Wizascript on the editors' sites.
//
// Two jobs:
//  1. Card Gallery (both editors): answers "Read from this editor" with
//     the cards the player has made (gallery/reader.js). Read-only.
//  2. feildmaster's editor only: its toast library (SimpleToast, his own)
//     won't install itself inside a frame (`if (window !== window.top)
//     return;` at the start of install()), so the editor stops at its
//     first toast and stays black. feildmaster agreed to remove that line
//     from the editor's copy; until he does, the Card Maker's hotfix
//     setting has this load the same file without that one line and, if
//     the editor already gave up, start it again. Either way it tells the
//     Card Maker whether the editor drew, so it can offer the hotfix (or
//     his site) instead of a black screen.

import { HOTFIX_KEY } from "./storage.js";
import { FRAME_MESSAGE } from "./editors.js";
import { readEditorCards } from "./gallery/reader.js";

const TOAST_FILE = "/resources/vendor/simpletoast.core.js";
const FRAME_CHECK = "if (window !== window.top) return;";
const GIVE_UP_MS = 15000;

const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const drawn = () => !!document.querySelector(".element");
// ready() removes #loading first, so: gone + nothing drawn = it stopped.
const started = () => !document.getElementById("loading");

// Inline scripts run in the page itself (his site has no CSP).
function runInPage(code) {
  const s = document.createElement("script");
  s.textContent = code;
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}

async function installToast() {
  try {
    const src = await (await fetch(location.origin + TOAST_FILE, { cache: "no-store" })).text();
    if (!src.includes(FRAME_CHECK)) return false;
    runInPage(src.replace(FRAME_CHECK, ""));
    return typeof page.SimpleToast === "function";
  } catch (e) {
    console.warn("[Wizascript Card Maker] hotfix couldn't load SimpleToast", e);
    return false;
  }
}

function watchFeildmaster(report) {
  const hotfix = (() => { try { return GM_getValue(HOTFIX_KEY, "") === "1"; } catch (e) { return false; } })();
  (async () => {
    let hotfixed = false;
    if (hotfix && typeof page.SimpleToast !== "function") hotfixed = await installToast();
    const t0 = Date.now();
    let restarted = false;
    while (Date.now() - t0 < GIVE_UP_MS) {
      if (drawn()) return report({ status: "ok", hotfixed });
      if (started()) {
        await sleep(1500); // give init() its moment
        if (drawn()) return report({ status: "ok", hotfixed });
        if (hotfixed && !restarted) {
          restarted = true;
          runInPage('import("/resources/modules/UndercardEditor.js").then((m) => m.default.init());');
          await sleep(1500);
          continue;
        }
        return report({ status: "broken", hotfixed, toast: typeof page.SimpleToast === "function" });
      }
      await sleep(250);
    }
    report({ status: "broken", hotfixed, toast: typeof page.SimpleToast === "function" });
  })();
}

export function runInsideEditor() {
  if (window === window.top) return; // the editor opened on its own: not ours
  const source = location.hostname === "undercard.feildmaster.com" ? "feildmaster"
    : location.hostname === "sernon158.github.io" && location.pathname.startsWith("/uc-editor") ? "sernon" : null;
  if (!source) return;
  // Only when the frame is the Card Maker's (undercards.net), not some
  // other site that embeds the editor.
  const from = (location.ancestorOrigins && location.ancestorOrigins[0]) || document.referrer || "";
  let parentOrigin;
  try { parentOrigin = new URL(from).origin; } catch (e) { return; }
  if (!/^https:\/\/([a-z0-9-]+\.)*undercards\.net$/.test(parentOrigin)) return;

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
