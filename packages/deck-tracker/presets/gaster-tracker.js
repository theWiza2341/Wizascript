// Gaster Tracker - tracks the order ally Synergy effects have
// genuinely triggered this game, to predict what Gaster's "repeat all
// Synergy effects you triggered" would replay (max 2 times per unique
// effect).
//
// Deliberately does NOT watch getDoingEffect firing on a card as the
// trigger signal - confirmed via live testing that some Synergy cards
// also carry a separate, unconditional Magic effect, so getDoingEffect
// firing doesn't tell us whether the SYNERGY half specifically
// resolved, only that *something* on the card did. Instead, this
// reconstructs the trigger condition directly from the card's own
// rule text: "when played, if an ally monster of the same tribe has
// been played this turn" - tracked via a per-turn set of tribes seen
// so far (reset every getTurnStart), checked BEFORE registering the
// current card's own tribes (so a card never counts as an ally of
// itself, but still enables a later card this same turn even if its
// own check failed).
//
// Confirmed via live testing (G Follower 1 -> G Follower 2 same turn):
// this reconstruction correctly predicted a real trigger.
//
// Same Synergy-keyword lookup as Zenith Martlet's Dust check - same
// translation file, same lazy same-origin fetch, checking for the
// literal "{{KW:SYNERGY}}" substring.
//
// Known assumption, unconfirmed: a card listing multiple tribes is
// handled correctly (checked individually), but if an "ALL tribes"
// card represents that as a single literal string rather than
// enumerating every tribe, this wouldn't recognize it as matching -
// worth testing specifically against such a card.
//
// Accumulates PERMANENTLY across the whole match (not recomputed fresh
// like Zenith Martlet) - once triggered, a Synergy proc can't be
// un-triggered, unlike the dustpile which can change.

import { registerPresetType } from "../registry.js";
import { getRelevantPlayerId } from "../../core/player-context.js";

const PRESET_ID = "builtin:gaster-tracker";
const MAX_PER_UNIQUE_EFFECT = 2;
const TRANSLATION_URL = "https://undercards.net/translation/en.json";

let liveParts = null;
let translationsCache = null;
let translationsFetchPromise = null;

let tribesPlayedThisTurn = new Set();
let synergyProcOrder = [];       // permanent, accumulates all game - [{name}]
let synergyCounts = new Map();   // fixedId -> how many times triggered so far

function ensureTranslationsLoaded() {
  if (translationsCache) return Promise.resolve(translationsCache);
  if (translationsFetchPromise) return translationsFetchPromise;

  translationsFetchPromise = fetch(TRANSLATION_URL)
    .then(res => res.json())
    .then(json => {
      translationsCache = json;
      return json;
    })
    .catch(err => {
      console.warn("[DeckTracker/Gaster] Failed to load card text for Synergy lookup:", err);
      translationsFetchPromise = null;
      return null;
    });

  return translationsFetchPromise;
}

function hasSynergyEffect(fixedId) {
  // Conservative default: assume NOT a Synergy card if the text hasn't
  // loaded yet, same reasoning as Zenith Martlet's Dust check.
  if (!translationsCache) return false;
  const text = translationsCache[`card-${fixedId}`];
  return typeof text === "string" && text.includes("{{KW:SYNERGY}}");
}

function refreshDisplay(parts) {
  parts.setListItems(synergyProcOrder.slice());
}

function refreshLiveWidget() {
  if (liveParts) refreshDisplay(liveParts);
}

function handleGameEvent(event) {
  const relevantId = getRelevantPlayerId();
  if (relevantId === null) return;

  if (event.action === "getTurnStart" && event.idPlayer === relevantId) {
    tribesPlayedThisTurn = new Set();
    return;
  }

  if (event.action !== "getMonsterPlayed") return;
  if (event.idPlayer !== relevantId) return; // only ally plays count toward "ally monster of the same tribe"

  let card;
  try {
    card = typeof event.card === "string" ? JSON.parse(event.card) : event.card;
  } catch (e) {
    return;
  }

  // Inferred from live testing: an instance whose creatorInfo.id
  // equals its own fixedId was created by its OWN card's effect (e.g.
  // "Synergy: Summon a copy of this") rather than genuinely played by
  // the user. Without this check, a self-summoned copy's
  // getMonsterPlayed would be evaluated for its OWN synergy trigger
  // too, double-counting a single real trigger as two. It still
  // physically exists on the board though, so it should still count
  // toward enabling a LATER, different card's tribe condition - it's
  // only excluded from being checked for ITS OWN trigger.
  const isSelfSummoned = card.creatorInfo && card.creatorInfo.id === card.fixedId;

  const tribes = Array.isArray(card.tribes) ? card.tribes : [];

  // Checked BEFORE this card's own tribes are registered - must be a
  // genuinely earlier, different play this turn, never itself.
  const conditionMet = tribes.some(t => tribesPlayedThisTurn.has(t));

  if (!isSelfSummoned && conditionMet && hasSynergyEffect(card.fixedId)) {
    const count = synergyCounts.get(card.fixedId) || 0;
    if (count < MAX_PER_UNIQUE_EFFECT) {
      synergyCounts.set(card.fixedId, count + 1);
      synergyProcOrder.push({ name: card.name });
      refreshLiveWidget();
    }
  }

  // Registered AFTER the check, regardless of outcome - this card can
  // still enable a LATER card of the same tribe this same turn even
  // if its own condition wasn't met.
  tribes.forEach(t => tribesPlayedThisTurn.add(t));
}

// Defensive reset, same pattern as SAVE/CoW Trackers - module state is
// already fresh on a real page reload, this just guards against the
// (unconfirmed, low-risk) case of GameStart/connect firing again
// without one.
export function resetGasterTrackerForMatchStart(turn) {
  if (turn <= 1) {
    tribesPlayedThisTurn = new Set();
    synergyProcOrder = [];
    synergyCounts = new Map();
    refreshLiveWidget();
  }
}

export function registerGasterTracker() {
  ensureTranslationsLoaded().then(() => refreshLiveWidget());

  registerPresetType(
    {
      id: PRESET_ID,
      name: "Gaster Tracker",
      description: "Tracks the order Synergy effects have triggered this game, to predict Gaster's repeat order.",
      sprite: null,
      soul: null, // card-specific, not soul-tied
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "Gaster Order",
        listMode: true,
        firstItemLabel: "first",
        getInitialListItems: () => synergyProcOrder.slice(),
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
