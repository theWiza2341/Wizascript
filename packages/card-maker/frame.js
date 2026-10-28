// packages/card-maker/frame.js
//
// The only part of Wizascript that runs on another site: inside
// feildmaster's Template Editor, and only while that editor is shown in
// the Card Maker on undercards.net (opened on its own, this returns at
// once and does nothing). build.js bundles it separately and runs it
// instead of the rest of Wizascript on undercard.feildmaster.com.
//
// Why it exists: the editor's toast library (SimpleToast, his own) won't
// install itself inside a frame (`if (window !== window.top) return;` at
// the start of install()), so the editor stops at its first toast and
// stays black. feildmaster agreed to remove that line from the editor's
// copy; until he does, the Card Maker's hotfix setting has this:
//   1. load the same file again with only that line taken out, so
//      window.SimpleToast exists;
//   2. if the editor already gave up, start it again.
// Once his copy is fixed, window.SimpleToast is already there and this
// does nothing but report. Either way it tells the Card Maker whether
// the editor drew, so it can offer the hotfix (or his site) instead of
// a black screen.

import { HOTFIX_KEY } from "./storage.js";
import { FRAME_MESSAGE } from "./editors.js";

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

export function runInsideEditor() {
  if (window === window.top) return; // his site opened on its own: not ours
  // Only when the frame is the Card Maker's (undercards.net), not some
  // other site that embeds his editor.
  const from = (location.ancestorOrigins && location.ancestorOrigins[0]) || document.referrer || "";
  let parentOrigin;
  try { parentOrigin = new URL(from).origin; } catch (e) { return; }
  if (!/^https:\/\/([a-z0-9-]+\.)*undercards\.net$/.test(parentOrigin)) return;

  const report = (status, extra = {}) => window.parent.postMessage({ tag: FRAME_MESSAGE, status, ...extra }, parentOrigin);
  const hotfix = (() => { try { return GM_getValue(HOTFIX_KEY, "") === "1"; } catch (e) { return false; } })();

  (async () => {
    let hotfixed = false;
    if (hotfix && typeof page.SimpleToast !== "function") hotfixed = await installToast();
    const t0 = Date.now();
    let restarted = false;
    while (Date.now() - t0 < GIVE_UP_MS) {
      if (drawn()) return report("ok", { hotfixed });
      if (started()) {
        await sleep(1500); // give init() its moment
        if (drawn()) return report("ok", { hotfixed });
        if (hotfixed && !restarted) {
          restarted = true;
          runInPage('import("/resources/modules/UndercardEditor.js").then((m) => m.default.init());');
          await sleep(1500);
          continue;
        }
        return report("broken", { hotfixed, toast: typeof page.SimpleToast === "function" });
      }
      await sleep(250);
    }
    report("broken", { hotfixed, toast: typeof page.SimpleToast === "function" });
  })();
}
