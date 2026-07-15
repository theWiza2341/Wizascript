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
//
// There's no ability-text field anywhere on card objects (confirmed by
// live testing - allCards is purely mechanical: cost, rarity, stats,
// no description field at all). The actual card text lives in the
// game's own translation file, same-origin, so a plain fetch() works
// with no GM_xmlhttpRequest/@connect grant needed. Looked up by
// fixedId (the card TYPE's stable id, not the per-copy instance id),
// checking for the literal substring "{{KW:DUST}}:" - the raw
// keyword-placeholder token, not the rendered English word "Dust".
// Checked LAST, after cost/rarity, since it's the only one requiring
// network data.

import { registerPresetType } from "../registry.js";
import { getRelevantPlayerId } from "../../core/player-context.js";
import { getPageWindow } from "../../core/page-window.js";

const PRESET_ID = "builtin:zenith-martlet-tracker";
const MAX_PER_UNIQUE_EFFECT = 3;
const MAX_COST = 9;
const TRANSLATION_URL = "https://undercards.net/translation/en.json";

let liveParts = null;
let translationsCache = null;
let translationsFetchPromise = null;

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
      console.warn("[DeckTracker/ZenithMartlet] Failed to load card text for Dust-effect lookup:", err);
      translationsFetchPromise = null; // allow a retry on next call
      return null;
    });

  return translationsFetchPromise;
}

function hasDustEffect(fixedId) {
  // Conservative default: if we haven't loaded the text yet, assume NO
  // Dust effect rather than risk a false inclusion in the prediction.
  if (!translationsCache) return false;
  const text = translationsCache[`card-${fixedId}`];
  return typeof text === "string" && text.includes("{{KW:DUST}}:");
}

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
    if (!hasDustEffect(card.fixedId)) continue; // checked last, per the user's request

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
  // Kicks off immediately, regardless of whether the widget is ever
  // spawned - by the time the user actually adds it, the text is
  // likely already cached. Refreshes any currently-live widget once it
  // resolves, since the very first prediction may have been computed
  // conservatively (assuming no Dust effect) before this landed.
  ensureTranslationsLoaded().then(() => refreshLiveWidget());

  registerPresetType(
    {
      id: PRESET_ID,
      name: "Zenith Martlet Tracker",
      description: "Predicts the proc order of Zenith Martlet's dust effect, before you even play it.",
      sprite: null,
      soul: null, // not soul-tied - this is a card-specific tracker, not a whole-Soul strategy one
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "Zmart Procs",
        listMode: true,
        firstItemLabel: "first",
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
