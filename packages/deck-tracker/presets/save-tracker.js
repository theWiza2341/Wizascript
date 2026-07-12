// SAVE Tracker - shows which Lost Soul is up next from the SAVE
// artifact's summon cycle. Confirmed via live testing (see design
// discussion): the artifact's own "custom" field is only a 0-20
// progress counter, useless for identifying WHICH Lost Soul is next.
// The reliable signal is the artifact's OWN getArtifactDoingEffect
// firing with a non-empty `affecteds` - this happens identically for
// a real summon AND a board-full dust-trigger, and in both cases
// battleLog.targetCards[0].name tells us exactly which Lost Soul the
// cycle just landed on.
//
// Known gap (accepted, not solved): a mid-match join can't see a
// dust-trigger that happened before connecting, since nothing remains
// on the board or in the dustpile for a card that was created and
// immediately dusted without ever being placed. In that case we show
// "?" (unconfirmed) until the next real proc, rather than guess wrong.

import { registerPresetType } from "../registry.js";
import { getMyPlayerId } from "../../core/player-context.js";

const SAVE_ARTIFACT_ID = 33;
const PRESET_ID = "builtin:save-tracker";

const LOST_SOUL_ORDER = ["Lost Alphys", "Lost Papyrus", "Lost Undyne", "Lost Toriel", "Lost Asgore", "Lost Sans"];

function spriteFor(name) {
  return name.replace(/ /g, "_");
}

// Index into LOST_SOUL_ORDER of whichever Lost Soul is up next, or
// null if unconfirmed.
let upNextIndex = null;
let liveParts = null;

function getUpNextName() {
  return upNextIndex === null ? null : LOST_SOUL_ORDER[upNextIndex];
}

function refreshDisplay(parts) {
  const name = getUpNextName();
  parts.setSprite(name ? spriteFor(name) : null);
  parts.setLabel(name || "?");
}

function refreshLiveWidget() {
  if (liveParts) refreshDisplay(liveParts);
}

// Called from index.js's connect handler. A very early turn means the
// cycle hasn't advanced yet - safe to assume Lost Alphys, the first
// one, is up next. A later turn means this is a mid-match join or
// reload - genuinely unknown until the next real proc is observed.
export function resetForMatchStart(turn) {
  upNextIndex = turn <= 1 ? 0 : null;
  refreshLiveWidget();
}

function handleGameEvent(event) {
  if (event.action !== "getArtifactDoingEffect") return;
  if (event.artifactId !== SAVE_ARTIFACT_ID) return;
  if (event.playerId !== getMyPlayerId()) return;
  if (event.affecteds === "[]") return; // just a counter-gain tick, not a proc

  try {
    const battleLog = typeof event.battleLog === "string" ? JSON.parse(event.battleLog) : event.battleLog;
    const targetName = battleLog?.targetCards?.[0]?.name;
    if (!targetName) return;

    const procIndex = LOST_SOUL_ORDER.indexOf(targetName);
    if (procIndex === -1) return; // unrecognized name - defensive, shouldn't normally happen

    upNextIndex = (procIndex + 1) % LOST_SOUL_ORDER.length;
    refreshLiveWidget();
  } catch (e) {
    // malformed battleLog - ignore silently, the next proc will self-correct
  }
}

export function registerSaveTracker() {
  registerPresetType(
    {
      id: PRESET_ID,
      name: "SAVE Tracker",
      description: "Shows which Lost Soul is up next from the SAVE artifact's summon cycle.",
      sprite: null,
      soul: "DETERMINATION",
      custom: false,
      kind: "event"
    },
    {
      onGameEvent: handleGameEvent,
      hudBehavior: {
        widgetTitle: "Up Next",
        getInitialSprite: () => {
          const name = getUpNextName();
          return name ? spriteFor(name) : null;
        },
        getInitialLabel: () => getUpNextName() || "?",
        // Manual cycle - lets the user self-correct if they know
        // better than our current guess, or resolve "?" by hand.
        onLeftClick: (id, parts) => {
          upNextIndex = upNextIndex === null ? 0 : (upNextIndex + 1) % LOST_SOUL_ORDER.length;
          refreshDisplay(parts);
        },
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
