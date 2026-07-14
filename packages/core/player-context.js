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

export function isSpectating() {
  return location.pathname.toLowerCase().includes("spectate");
}

// Spectate URLs carry the spectated player's id directly, e.g.
// /Spectate?gameId=2377&playerId=595419 - confirmed via live testing.
// More reliable than trusting window.userId to auto-resolve correctly
// in spectate mode, since that's only an inference from consistent
// GameEvent behavior, not a documented guarantee.
export function getSpectatedPlayerIdFromUrl() {
  const match = location.search.match(/[?&]playerId=(\d+)/i);
  return match ? Number(match[1]) : null;
}

// Whichever player id should be treated as "the relevant one" for
// soul-specific tracking - our own id in a real match, or the
// specifically spectated player's id when spectating.
export function getRelevantPlayerId() {
  return isSpectating() ? getSpectatedPlayerIdFromUrl() : getMyPlayerId();
}

// Parses the connect event's `you`/`enemy` fields (each a JSON-
// stringified player object) and returns whichever one's id matches
// getRelevantPlayerId() - works uniformly for a real match or a
// spectated one.
//
// FIX: the field actually used here matters - `yourSoul`/`enemySoul`
// on the connect payload are THEMSELVES JSON-stringified sub-objects
// (e.g. '{"id":6,"name":"PATIENCE"}'), not bare soul-name strings.
// Comparing a preset's `.soul` field directly against that raw string
// could never match - going through `you`/`enemy` and reading
// `.soul.name` after parsing avoids that mistake entirely.
export function getRelevantPlayerSoul(connectData) {
  const relevantId = getRelevantPlayerId();
  if (relevantId === null) return null;

  try {
    const you = typeof connectData.you === "string" ? JSON.parse(connectData.you) : connectData.you;
    const enemy = typeof connectData.enemy === "string" ? JSON.parse(connectData.enemy) : connectData.enemy;
    if (you?.id === relevantId) return you.soul?.name ?? null;
    if (enemy?.id === relevantId) return enemy.soul?.name ?? null;
  } catch (e) {
    // malformed payload - treat as unknown rather than guessing
  }
  return null;
}
