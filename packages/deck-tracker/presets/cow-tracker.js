// Change of Winds Tracker (Patience) - tracks the known order of the
// bottom of your deck as Change of Winds pushes rejected cards down.
// Each new reject is the closest-to-bottom (next thing a bottom-draw
// effect would hit), displacing older known rejects further up the
// list - confirmed against the user's own worked example.
//
// getDoingEffect's battleLog only ever exposes the CHOSEN card, never
// the rejected one - confirmed both from SAVE Tracker's earlier
// findings and directly for CoW here. The rejected card can only be
// learned by reading the choice modal's own DOM at the moment it
// appears (ported directly from an earlier, now-superseded version of
// this exact tracker, which had already solved this problem) - there
// is no event-only way to learn it.
//
// Known accepted variance (per the user): a "shuffle into deck" effect
// could insert a card between two known CoW rejects without us ever
// knowing - this list is "best known ordering," not a guarantee.

import { registerPresetType } from "../registry.js";
import { getRelevantPlayerId } from "../../core/player-context.js";

const PRESET_ID = "builtin:cow-tracker";
const COW_FIXED_ID = 552;

let bottomCards = [];       // index 0 = next card a bottom-draw effect would hit
let lastModalOptions = null;
let liveParts = null;
const seenModals = new WeakSet();
let modalObserverStarted = false;

function refreshLiveWidget() {
  if (liveParts) liveParts.setListItems(bottomCards.slice());
}

// ---- modal scraping (the piece GameEvents alone can't provide) ----

function looksLikeCoW(modal) {
  return modal.innerText?.includes("Change of Winds") || modal.querySelector("#select-cards");
}

function extractOptions(modal) {
  return [...modal.querySelectorAll(".card")]
    .map(card => ({ name: card.querySelector(".cardName")?.innerText?.trim() || card.innerText?.trim() }))
    .filter(c => c.name);
}

function startModalWatch() {
  if (modalObserverStarted) return;
  modalObserverStarted = true;

  const observer = new MutationObserver(() => {
    document.querySelectorAll(".modal, .bootstrap-dialog").forEach(modal => {
      if (seenModals.has(modal)) return;
      if (!looksLikeCoW(modal)) return;
      const options = extractOptions(modal);
      if (options.length < 2) return;
      seenModals.add(modal);
      lastModalOptions = options;
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---- game event: which card was CHOSEN, so we can infer the reject ----

function handleGameEvent(event) {
  if (event.action !== "getDoingEffect") return;

  let card, battleLog;
  try {
    card = typeof event.card === "string" ? JSON.parse(event.card) : event.card;
    battleLog = typeof event.battleLog === "string" ? JSON.parse(event.battleLog) : event.battleLog;
  } catch (e) {
    return;
  }

  if (card?.fixedId !== COW_FIXED_ID) return;

  const relevantId = getRelevantPlayerId();
  if (relevantId === null || battleLog?.playerId !== relevantId) return;

  const chosen = battleLog?.targetCards?.[0];
  if (!chosen?.name) return;

  if (!lastModalOptions || lastModalOptions.length < 2) {
    console.warn("[DeckTracker/CoW] Change of Winds resolved but no modal options were captured - can't determine the rejected card this time.");
    return;
  }

  const rejected = lastModalOptions.find(opt => opt.name !== chosen.name);
  if (!rejected) return;

  bottomCards.unshift({ name: rejected.name });
  refreshLiveWidget();
}

// Called from index.js's connect handler, same defensive reset SAVE
// Tracker does - a genuinely fresh match has zero known bottom cards.
export function resetCowTrackerForMatchStart(turn) {
  if (turn <= 1) {
    bottomCards = [];
    refreshLiveWidget();
  }
}

export function registerCowTracker() {
  startModalWatch();

  registerPresetType(
    {
      id: PRESET_ID,
      name: "Change of Winds Tracker",
      description: "Tracks the known bottom of your deck as Change of Winds pushes cards down.",
      sprite: null,
      soul: "PATIENCE",
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "CoW Tracker",
        listMode: true,
        getInitialListItems: () => bottomCards.slice(),
        // Right-click a specific row removes just that card - lets the
        // user self-correct if they suspect a shuffle effect disturbed
        // that particular known position.
        onRemoveListItem: (_id, item) => {
          const idx = bottomCards.findIndex(c => c.name === item.name);
          if (idx !== -1) bottomCards.splice(idx, 1);
          refreshLiveWidget();
        },
        // Middle-click clears the whole list, matching the "middle-
        // click resets" convention used elsewhere in Deck Tracker.
        onMiddleClick: () => {
          bottomCards = [];
          refreshLiveWidget();
        },
        onMount: (id, parts) => {
          liveParts = parts;
        },
        onUnmount: () => {
          liveParts = null;
        }
      }
    }
  );
}
