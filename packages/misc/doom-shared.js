// Shared between doom-reminder.js (Classic) and doom-overlay.js (Evil)
// - both need the exact same "is it time yet" logic, and duplicating
// tricky threshold math in two places invites drift.

import { getRelevantPlayerId } from "../core/player-context.js";

const DOOM_ARTIFACT_NAME = "Doom";

// Deliberately only the OPPONENT's Doom - per the user's own call, this
// keeps both modes simple and avoids "what if I have Doom instead"
// as a separate case entirely. Confirmed selector directly from live
// DOM: every artifact icon carries a `name="..."` attribute matching
// its real display name.
export function findEnemyDoomElement() {
  return document.querySelector(`#enemyArtifacts img.artifact-img[name="${DOOM_ARTIFACT_NAME}"]`);
}

// Confirmed via live testing: which event to watch depends on turn
// order. If the OPPONENT (Doom's owner) goes first, we watch THEIR
// getTurnEnd - the reminder should land once their own last playable
// turn before Doom is over, not before it's even started. If the USER
// goes first instead, we watch the USER's OWN getTurnStart, since in
// that order the user's last playable turn before Doom comes at the
// START of their own turn, while the opponent is still mid-turn.
//
// Counts each side's own turn occurrences directly rather than relying
// on numTurn - numTurn is shared per ROUND (both players' getTurnStart
// events report the same value) and getTurnEnd isn't confirmed to
// carry numTurn at all, so counting turns as they actually happen for
// the relevant side avoids both problems entirely.
export function createDoomTurnGate() {
  let opponentWentFirst = null; // determined from the FIRST getTurnStart of the match
  let myTurnCount = 0;
  let opponentTurnCount = 0;
  let nextTriggerTurn = null; // set once we know who went first

  function reset() {
    opponentWentFirst = null;
    myTurnCount = 0;
    opponentTurnCount = 0;
    nextTriggerTurn = null;
  }

  // Call this from a GameEvent handler for every event. Returns true
  // exactly once per qualifying turn boundary - act on a true return
  // value.
  function checkEvent(event) {
    const relevantId = getRelevantPlayerId();
    if (relevantId === null) return false;

    if (event.action === "getTurnStart" && opponentWentFirst === null) {
      opponentWentFirst = event.idPlayer !== relevantId;
      // User goes first: watched via the user's own getTurnStart,
      // starting at 12 (12 + 12n). User goes second: watched via the
      // opponent's getTurnEnd instead, starting at 11 (11 + 12n).
      nextTriggerTurn = opponentWentFirst ? 11 : 12;
    }

    if (nextTriggerTurn === null) return false;

    if (opponentWentFirst === false && event.action === "getTurnStart" && event.idPlayer === relevantId) {
      myTurnCount++;
      if (myTurnCount >= nextTriggerTurn) {
        nextTriggerTurn += 12;
        return true;
      }
    }

    if (opponentWentFirst === true && event.action === "getTurnEnd" && event.idPlayer !== relevantId) {
      opponentTurnCount++;
      if (opponentTurnCount >= nextTriggerTurn) {
        nextTriggerTurn += 12;
        return true;
      }
    }

    return false;
  }

  return { checkEvent, reset };
}
