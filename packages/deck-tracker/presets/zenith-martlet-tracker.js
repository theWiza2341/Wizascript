// Zenith Martlet Tracker - a live PREDICTION of what order Zenith
// Martlet's dust-effect trigger would fire in, computed continuously
// from the current dustpile state - NOT a reaction to the card
// actually being played. The whole point is to know the order before
// committing to the play, so getDoingEffect is deliberately unused
// here.
//
// Confirmed via live testing: window.dustpile is a real, live-updating
// global containing BOTH players' dead cards combined, each with an
// ownerId field - filtering by the relevant player isolates "my"
// dustpile, and index 0 is confirmed to be the oldest card (first
// added), matching the "oldest in dustpile procs first" rule directly
// with no reordering needed.
//
// Card text: "Trigger the DUST effects of all non-TOKEN monsters
// costing 9 or less in your dustpile (max. 3 per unique effect)."
// "Unique effect" is interpreted here as "same card" (matched by
// fixedId) - not confirmed against real gameplay, worth validating.

import { registerPresetType } from "../registry.js";
import { getRelevantPlayerId } from "../../core/player-context.js";
import { getPageWindow } from "../../core/page-window.js";

const PRESET_ID = "builtin:zenith-martlet-tracker";
const MAX_PER_UNIQUE_EFFECT = 3;
const MAX_COST = 9;

let liveParts = null;

function computePredictedOrder() {
  const relevantId = getRelevantPlayerId();
  if (relevantId === null) return [];

  const dustpile = getPageWindow().dustpile;
  if (!Array.isArray(dustpile)) return [];

  const mine = dustpile.filter(c => c.ownerId === relevantId);

  const seenCounts = new Map(); // fixedId -> how many have already qualified
  const predicted = [];

  for (const card of mine) {
    if (card.rarity === "TOKEN") continue;
    if (typeof card.cost !== "number" || card.cost > MAX_COST) continue;

    const count = seenCounts.get(card.fixedId) || 0;
    if (count >= MAX_PER_UNIQUE_EFFECT) continue; // cap reached - doesn't proc, excluded entirely

    seenCounts.set(card.fixedId, count + 1);
    predicted.push({ name: card.name });
  }

  return predicted;
}

function refreshDisplay(parts) {
  parts.setListItems(computePredictedOrder());
}

function refreshLiveWidget() {
  if (liveParts) refreshDisplay(liveParts);
}

function handleGameEvent(event) {
  // Recompute on ANY dustpile update - reading the live global fresh
  // each time is cheap, and we don't need to know WHOSE dustpile
  // changed since we filter to the relevant player from the full
  // array regardless.
  if (event.action !== "getUpdateDustpile") return;
  refreshLiveWidget();
}

export function registerZenithMartletTracker() {
  registerPresetType(
    {
      id: PRESET_ID,
      name: "Zenith Martlet Tracker",
      description: "Predicts the proc order of Zenith Martlet's dust effect, before you even play it.",
      sprite: null,
      soul: null, // not yet confirmed - won't participate in soul-based auto-load until set
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "Proc Order",
        listMode: true,
        getInitialListItems: () => computePredictedOrder(),
        onMount: (id, parts) => {
          liveParts = parts;
          // Catch up immediately in case the dustpile already has
          // qualifying cards when this widget mounts mid-match.
          refreshDisplay(parts);
        },
        onUnmount: () => {
          liveParts = null;
        }
      }
    }
  );
}
