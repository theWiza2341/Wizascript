// Curve Tracker (Integrity) - shows "Last Turn: X G", the amount of
// gold actually spent last turn, to help play around Integrity's
// passive.
//
// Confirmed via live testing: summing every DECREASE between
// consecutive getPlayersStats gold snapshots across a turn correctly
// captures card costs, "spend all your G, gain stats" abilities, AND
// Program(X) costs - all three were confirmed to resolve as
// independently observable snapshot transitions (a visible drop, then
// separately any reward), never collapsed into one atomic net change
// that would hide the true cost. This means no special-casing is
// needed per spend mechanism - one mechanism covers everything
// observed so far.
//
// Known accepted gap: an opponent-forced gold loss (if such an effect
// exists) would also show as a "drop" and get counted here, even
// though it isn't really "spending" in the curve-optimization sense
// Integrity's passive cares about. Not something we've observed yet -
// worth revisiting if it turns out to matter in practice.

import { registerPresetType } from "../registry.js";
import { getRelevantPlayerId } from "../../core/player-context.js";

const PRESET_ID = "builtin:curve-tracker";

let lastKnownGold = null;  // most recent snapshot's gold value for the relevant player
let turnSpend = 0;         // running total of drops observed THIS turn
let lastTurnSpend = null;  // frozen total from the turn that just ended - what's displayed
let liveParts = null;

function getDisplayLabel() {
  return lastTurnSpend === null ? "Last Turn: ? G" : `Last Turn: ${lastTurnSpend} G`;
}

function refreshDisplay(parts) {
  parts.setLabel(getDisplayLabel());
}

function refreshLiveWidget() {
  if (liveParts) refreshDisplay(liveParts);
}

function handleGameEvent(event) {
  const relevantId = getRelevantPlayerId();
  if (relevantId === null) return;

  // FIX: freezing on MY OWN next getTurnStart meant waiting through the
  // opponent's entire turn before the display updated. Freezing on
  // getTurnEnd instead seemed like the obvious fix, but live testing
  // showed "Turn end: spend your G" triggers actually resolve AFTER
  // getTurnEnd fires, not before - freezing right at getTurnEnd would
  // miss that spend entirely. The opponent's getTurnStart is the right
  // moment: by definition everything triggered by my turn ending has
  // already resolved by then, and it updates far sooner than waiting
  // for my own next turn.
  if (event.action === "getTurnStart" && event.idPlayer !== relevantId) {
    lastTurnSpend = turnSpend;
    turnSpend = 0;
    refreshLiveWidget();
    return;
  }

  if (event.action === "getPlayersStats" && event.golds) {
    try {
      const byPlayer = JSON.parse(event.golds);
      const current = byPlayer[relevantId];
      if (typeof current !== "number") return;

      if (lastKnownGold !== null && current < lastKnownGold) {
        turnSpend += (lastKnownGold - current);
      }
      lastKnownGold = current;
    } catch (e) {
      // malformed payload - ignore, the next snapshot self-corrects
    }
  }
}

export function registerCurveTracker() {
  registerPresetType(
    {
      id: PRESET_ID,
      name: "Curve Tracker",
      description: "Shows how much G you spent last turn, to help play around Integrity's passive.",
      sprite: null,
      soul: "INTEGRITY",
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "Curve Tracker",
        compact: true,
        getInitialLabel: () => getDisplayLabel(),
        onMount: (id, parts) => {
          liveParts = parts;
          refreshDisplay(parts);
        },
        onUnmount: () => {
          liveParts = null;
        }
      }
    }
  );
}
