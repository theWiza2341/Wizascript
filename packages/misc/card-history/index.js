// packages/misc/card-history/index.js
//
// Card History: middle-click a card on Crafting or Decks (or an artifact on
// the Artifacts page) to see its earlier versions.
//
//   data.js            reads the prebuilt history files from this repo
//   game.js            page globals (cards, artifacts, translations, appendCard)
//   format.js          wiki text -> the game's own card-text codes
//   cards-view.js      one card per version, drawn with appendCard
//   artifacts-view.js  one row per version
//   shell.js           the window ("Loading..." first, then the history)
//   reports.js         right-click a version -> report it; My Reports -> chat-sized codes
//   report-codes.js    the code format (#WZ1 CH ..., one chat message each)
//   chat-codes.js      codes in chat shown as one short line
//
// The histories are built from the wikis, the official patch notes and
// feildmaster's Card-Tracker by a GitHub Action (card-history/ on the
// `card-history` branch). Fixing how they're read is a change there; players
// see it on their next middle-click, with no Wizascript update.
//
// Read-only and purely informational: nothing here touches a match.
// Listed under Miscellaneous, no tab of its own.

import { isPluginEnabled } from "../../core/plugins.js";
import { matchesPage } from "../../core/page-match.js";
import { debugLoggingSetting } from "../../core/debug.js";
import { getArtifactData, getCardData, getIndex } from "./data.js";
import { artifacts, findCard } from "./game.js";
import { formatter } from "./format.js";
import { cardHistoryView } from "./cards-view.js";
import { artifactHistoryView, findArtifact } from "./artifacts-view.js";
import { openShell } from "./shell.js";
import { injectCardHistoryStyle } from "./styles.js";
import { remoteReports, wireReportMenu } from "./reports.js";
import { initChatCodes } from "./chat-codes.js";

const CARD_PAGES = ["/Crafting", "/Decks"];
const ARTIFACT_PAGES = ["/Artifacts"];

const warn = (...a) => { if (debugLoggingSetting.value()) console.warn("[Wizascript Card History]", ...a); };
let busy = false;

async function openCard(id) {
  const base = findCard(id);
  if (!base) return;
  const shell = openShell(`Previous Versions - ${base.name}`, `https://undercards.fandom.com/wiki/${base.name.replace(/ /g, "_")}/Previous_Versions`);
  try {
    shell.step("Reading the card's history...");
    const [data, index, f] = await Promise.all([getCardData(base.id), getIndex().catch(() => null), formatter(), remoteReports()]);
    const view = cardHistoryView(base, data, f, index);
    shell.fill(view.node, view.fit, view.wikiUrl);
  } catch (e) {
    warn(e);
    shell.fail(e);
  }
}

async function openArtifact(image) {
  const list = await artifacts();
  const a = findArtifact(list, image);
  if (!a) return;
  const shell = openShell(`Artifact History - ${a.name}`, `https://undercards.fandom.com/wiki/${a.name.replace(/ /g, "_")}`);
  try {
    shell.step("Reading the artifact's history...");
    const [data, index, f] = await Promise.all([getArtifactData(a.name), getIndex().catch(() => null), formatter(), remoteReports()]);
    const view = artifactHistoryView(a, data, f, index);
    shell.fill(view.node, null, view.wikiUrl);
  } catch (e) {
    warn(e);
    shell.fail(e);
  }
}

// A card on the page under the pointer (never one inside a dialog, like our own window).
function cardUnder(e) {
  if (e.button !== 1 || !matchesPage(CARD_PAGES) || !e.target.closest) return null;
  const el = e.target.closest(".card");
  if (!el || !el.id || el.closest(".modal")) return null;
  return findCard(el.id) ? el.id : null;
}

// An artifact picture under the pointer (or in the small box around it).
function artifactUnder(e) {
  if (e.button !== 1 || !matchesPage(ARTIFACT_PAGES) || !e.target.closest || e.target.closest(".modal")) return null;
  let el = e.target;
  for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
    const img = el.matches && el.matches('img[src*="artifacts/"]') ? el : el.querySelector && el.querySelector('img[src*="artifacts/"]');
    if (img) {
      const m = img.getAttribute("src").match(/artifacts\/([^/?#]+)\.png/i);
      if (m) return decodeURIComponent(m[1]);
    }
  }
  return null;
}

export function initCardHistory(plugin) {
  if (!isPluginEnabled("cardHistory")) return;
  // Chat is on every page: report codes in it are shown short.
  injectCardHistoryStyle();
  initChatCodes();
  if (!matchesPage([...CARD_PAGES, ...ARTIFACT_PAGES])) return;
  wireReportMenu();
  // No browser auto-scroll on a middle-click over a card or artifact.
  document.addEventListener("mousedown", (e) => { if (cardUnder(e) || artifactUnder(e)) e.preventDefault(); }, true);
  document.addEventListener("auxclick", async (e) => {
    const id = cardUnder(e);
    const image = id ? null : artifactUnder(e);
    if (!id && !image) return;
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      if (id) await openCard(id);
      else await openArtifact(image);
    } finally {
      busy = false;
    }
  }, true);
}
