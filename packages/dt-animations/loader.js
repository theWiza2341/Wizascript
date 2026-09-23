// packages/dt-animations/loader.js
//
// Owns the single GameEvent subscription for all DT animations and
// arbitrates between them. Each module's detector decides WHEN its DT
// starts/ends/reacts; the loader decides WHETHER that's allowed:
//
//   - ownership: by default only the relevant player's own DTs count
//     (you in a real match, the spectated player when spectating). The
//     experimental "opponent" setting lifts that.
//   - overlap: only one animation is on screen at a time. A second DT
//     either replaces the current one (forceStop + play) or is ignored,
//     per the overlap setting. An animation that's already fading out
//     is always replaced - it's leaving anyway.
//   - one-shots: a module with `kind: "oneShot"` (e.g. The Barrier - a
//     ~3s flash on play) that "replaces" a PERSISTENT animation (e.g.
//     Titan, which lasts as long as its artifact) only suspends it: the
//     persistent one is cut, the one-shot plays, and when it finishes the
//     persistent one resumes (unless its detector ended it meanwhile).
//   - game end: getVictory/getDefeat/getResult hard-stop everything
//     (the result screen visibly breaks overlay layouts).
//
// Compliance scope (see manifest.js / README): detectors must only react
// to public, on-board state - cards/artifacts both players can see. Never
// hand, deck, or anything hidden.

import { getRelevantPlayerId } from "../core/player-context.js";
import { getPageWindow } from "../core/page-window.js";

const GAME_END_ACTIONS = new Set(["getVictory", "getDefeat", "getResult"]);

export function createLoader({ animations, settings, logger }) {
  const effects = new Map();   // id -> effect (created lazily on first play)
  const detectors = new Map(); // id -> detector
  let current = null;          // { id, ownerId, ending }
  let suspended = null;        // { id, ownerId } - persistent animation paused by a one-shot
  const byId = new Map(animations.map((a) => [a.id, a]));
  const isOneShot = (anim) => anim && anim.kind === "oneShot";

  function getEffect(anim) {
    if (!effects.has(anim.id)) {
      effects.set(anim.id, anim.createEffect({
        setting: (key) => settings.animationValue(anim.id, key),
        log: (...args) => logger.log(anim.id, ...args),
        warn: (...args) => logger.warn(anim.id, ...args),
        pageWindow: getPageWindow(),
        // Effects that end on their own (one-shots) call this when fully
        // done, so the host can clear `current` and resume anything a
        // one-shot suspended.
        finished: () => onEffectFinished(anim)
      }));
    }
    return effects.get(anim.id);
  }

  function isRelevantPlayer(playerId) {
    if (playerId === null || playerId === undefined) return false;
    const me = getRelevantPlayerId();
    if (me !== null && Number(playerId) === me) return true;
    return settings.allowOpponent();
  }

  function isMine(playerId) {
    const me = getRelevantPlayerId();
    return me !== null && Number(playerId) === me;
  }

  function start(anim, ownerId, { force = false, resumed = false } = {}) {
    if (!force && !settings.isAnimationEnabled(anim.id)) return false;

    if (current) {
      const curEffect = effects.get(current.id);
      if (curEffect && curEffect.isActive()) {
        if (current.id === anim.id && !current.ending) {
          logger.log(anim.id, "start ignored - already playing.");
          return false;
        }
        if (!current.ending && !force && settings.overlapPolicy() === "ignore") {
          logger.log(anim.id, `start ignored - "${current.id}" is playing (overlap policy: ignore).`);
          return false;
        }
        if (isOneShot(anim) && !isOneShot(byId.get(current.id)) && !current.ending) {
          // Park the persistent animation; onEffectFinished resumes it.
          suspended = { id: current.id, ownerId: current.ownerId };
          logger.log(anim.id, `suspending "${current.id}" until this finishes.`);
        } else {
          logger.log(anim.id, `replacing "${current.id}".`);
        }
        curEffect.forceStop();
      }
      current = null;
    }
    if (!isOneShot(anim)) {
      // A persistent DT is taking the screen (possibly the parked one
      // itself) - nothing left to resume later.
      suspended = null;
    }

    const effect = getEffect(anim);
    const ok = effect.play({ resumed }) !== false;
    if (ok) {
      current = { id: anim.id, ownerId, ending: false };
      logger.log(anim.id, resumed ? "resumed." : "playing.", { ownerId });
    } else {
      logger.warn(anim.id, "effect.play() declined to start (board not found?).");
    }
    return ok;
  }

  function onEffectFinished(anim) {
    if (!current || current.id !== anim.id) return;
    current = null;
    logger.log(anim.id, "finished.");
    if (suspended) {
      const { id, ownerId } = suspended;
      suspended = null;
      const persistent = byId.get(id);
      if (persistent && settings.isAnimationEnabled(id)) start(persistent, ownerId, { resumed: true });
    }
  }

  function end(anim, { force = false } = {}) {
    if (suspended && suspended.id === anim.id) {
      // Its DT ended while a one-shot had it parked - just don't resume.
      suspended = null;
      logger.log(anim.id, "ended while suspended - won't resume.");
      return;
    }
    if (!current || current.id !== anim.id || current.ending) return;
    current.ending = true;
    logger.log(anim.id, "ending.");
    const effect = effects.get(anim.id);
    if (!effect) return;
    if (force) {
      effect.forceStop();
      current = null;
    } else {
      effect.reset();
    }
  }

  function react(anim, kind) {
    if (!current || current.id !== anim.id || current.ending) return;
    const effect = effects.get(anim.id);
    if (effect && typeof effect.react === "function") {
      logger.log(anim.id, `react: ${kind}`);
      effect.react(kind);
    }
  }

  function resetDetectors() {
    detectors.forEach((d) => d.reset && d.reset());
  }

  // Match start / reconnect: clear detector state and let effects that
  // fetch assets (e.g. a GIF) warm their cache before they're needed.
  function onMatchStart() {
    resetDetectors();
    animations.forEach((anim) => {
      if (!settings.isAnimationEnabled(anim.id)) return;
      const effect = getEffect(anim);
      if (typeof effect.preload === "function") {
        try { effect.preload(); } catch (err) { logger.warn(anim.id, "preload failed:", err); }
      }
    });
  }

  function stopAll() {
    suspended = null;
    effects.forEach((e) => e.forceStop());
    current = null;
    resetDetectors();
  }

  animations.forEach((anim) => {
    detectors.set(anim.id, anim.createDetector({
      isRelevantPlayer,
      isMine,
      start: (ownerId) => start(anim, ownerId),
      end: () => end(anim),
      react: (kind) => react(anim, kind),
      isPlaying: () => !!current && current.id === anim.id && !current.ending &&
        !!effects.get(anim.id) && effects.get(anim.id).isActive(),
      setting: (key) => settings.animationValue(anim.id, key),
      log: (...args) => logger.log(anim.id, ...args),
      warn: (...args) => logger.warn(anim.id, ...args)
    }));
  });

  function onGameEvent(event) {
    if (!event || !settings.isMasterEnabled()) return;
    if (GAME_END_ACTIONS.has(event.action)) {
      logger.log(null, `game end (${event.action}) - stopping all.`);
      stopAll();
      return;
    }
    animations.forEach((anim) => {
      if (!settings.isAnimationEnabled(anim.id)) return;
      try {
        detectors.get(anim.id).onGameEvent(event);
      } catch (err) {
        logger.error(anim.id, "detector threw:", err);
      }
    });
  }

  // Manual controls for the debug panel/console - bypass ownership
  // and the per-animation toggle, but still go through arbitration.
  const debugApi = {
    play(id) {
      const anim = animations.find((a) => a.id === id);
      return anim ? start(anim, "debug", { force: true }) : false;
    },
    react(id, kind = "hurt") {
      const anim = animations.find((a) => a.id === id);
      if (anim) react(anim, kind);
    },
    reset(id) {
      const anim = animations.find((a) => a.id === id);
      if (anim) end(anim);
    },
    forceStop: stopAll,
    current: () => (current ? { ...current, suspended: suspended && suspended.id } : null),
    list: () => animations.map((a) => a.id)
  };

  return { onGameEvent, onMatchStart, stopAll, debugApi };
}
