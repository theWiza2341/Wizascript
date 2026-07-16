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

// Confirmed via live testing: Doom's own 12-turn cycle lines up
// differently against the shared/global numTurn depending on turn
// order each match. numTurn is shared per ROUND (both players'
// getTurnStart events report the same value), so a strict modulo
// check would double-fire; a forward-only threshold can't, since it's
// already moved past that value the instant it fires once.
//
// The actual offset depends on who goes first: if the ENEMY (Doom's
// owner) goes first, the correct warning turns are (11 + 12n); if the
// USER goes first instead, they're (12 + 12n). Determined from the
// very first getTurnStart event seen each match, since that alone
// reveals turn order for that match.
export function createDoomTurnGate() {
  let userWentFirst = null;
  let nextTriggerTurn = null;

  function reset() {
    userWentFirst = null;
    nextTriggerTurn = null;
  }

  // Call this from a getTurnStart handler. Returns true exactly once
  // per qualifying turn boundary - act on a true return value.
  function checkTurnStart(event) {
    if (event.action !== "getTurnStart") return false;

    if (userWentFirst === null) {
      const relevantId = getRelevantPlayerId();
      userWentFirst = event.idPlayer === relevantId;
      nextTriggerTurn = userWentFirst ? 12 : 11;
    }

    const numTurn = event.numTurn;
    if (typeof numTurn === "number" && nextTriggerTurn !== null && numTurn >= nextTriggerTurn) {
      nextTriggerTurn += 12;
      return true;
    }
    return false;
  }

  return { checkTurnStart, reset };
}
