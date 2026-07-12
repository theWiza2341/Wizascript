// Shared utility for "which player is me" - needed by any soul-tied
// preset that has to distinguish its own trigger from an opponent's
// (confirmed necessary by live testing: a match with both players
// running SAVE independently fired events for both playerIds).
//
// UnderScript exposes window.userId directly, and it was observed to
// correctly resolve to a single, consistent player across BOTH real
// games and spectated matches during testing - not something we've
// seen documented, just reliably observed via live GameEvent logs.

import { getPageWindow } from "./page-window.js";

export function getMyPlayerId() {
  const id = getPageWindow().userId;
  return typeof id === "number" ? id : null;
}
