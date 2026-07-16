import { createLogger } from "../core/debug-logger.js";
import { registerDeckTrackerSettings } from "./settings.js";
import { getFavoritedPresetIds, getAvailablePresets, dispatchGameEvent, deleteCustomPreset, setRetainEnabledGetter, getRetainedPresetIds } from "./registry.js";
import { spawnPreset, spawnAdHocCustomTracker, closeWidget, closeAllWidgets } from "./hud.js";
import { openPresetPicker } from "./picker.js";
import { openCustomTrackerBuilder, openSaveAsPresetPrompt } from "./presets/custom.js";
import { registerBuiltInPresets } from "./presets/built-in.js";
import { registerSaveTracker, resetForMatchStart } from "./presets/save-tracker.js";
import { registerCurveTracker } from "./presets/curve-tracker.js";
import { registerCowTracker, resetCowTrackerForMatchStart } from "./presets/cow-tracker.js";
import { registerZenithMartletTracker } from "./presets/zenith-martlet-tracker.js";
import { registerGasterTracker, resetGasterTrackerForMatchStart } from "./presets/gaster-tracker.js";
import { isSpectating, getRelevantPlayerSoul } from "../core/player-context.js";

// Deck Tracker only makes sense on Game/Spectate pages - matches the
// original standalone script's @match restriction, now enforced inside
// the feature itself since the merged suite's @match is broad.
function isGamePage() {
  const path = location.pathname.toLowerCase();
  return path.includes("game") || path.includes("spectate");
}

function waitForAvatar(callback) {
  const existing = document.getElementById("yourAvatar");
  if (existing) return callback(existing);
  setTimeout(() => waitForAvatar(callback), 100);
}

export function initDeckTracker(plugin) {
  const settings = registerDeckTrackerSettings(plugin);

  if (!settings.enabled.value()) return;
  if (!isGamePage()) return;

  const logger = createLogger("DeckTracker");
  const originalWarn = logger.warn.bind(logger);
  const originalLog = logger.log.bind(logger);
  logger.log = (...args) => { if (settings.debugLogging.value()) originalLog(...args); };
  logger.warn = (...args) => { if (settings.debugLogging.value()) originalWarn(...args); };

  setRetainEnabledGetter(() => settings.retainUnclosedPresets.value());
  registerBuiltInPresets();
  registerSaveTracker();
  registerCurveTracker();
  registerCowTracker();
  registerZenithMartletTracker();
  registerGasterTracker();

  function handleAddPreset(id) {
    spawnPreset(id);
    logger.log("hud", "Spawned preset from picker:", id);
  }

  function handleCloseWidget(id) {
    closeWidget(id);
    logger.log("hud", "Closed preset from picker:", id);
  }

  function handleDeletePreset(id) {
    // Close the widget first if it's currently on screen, so we never
    // end up with a DOM widget referencing a preset the registry no
    // longer knows about.
    closeWidget(id);
    deleteCustomPreset(id);
    logger.log("hud", "Deleted custom preset:", id);
  }

  function handleCreateAdHoc() {
    openCustomTrackerBuilder({
      onCreate: ({ name, sprite }) => {
        spawnAdHocCustomTracker({
          name,
          sprite,
          onRequestSaveAsPreset: (defaultName, _spriteArg, onSaved) => {
            openSaveAsPresetPrompt(defaultName, (savedName, description) => {
              onSaved(savedName, description);
              logger.log("hud", "Saved custom tracker as preset:", savedName);
            });
          }
        });
      }
    });
  }

  function createButton(avatar) {
    const btn = document.createElement("button");
    btn.textContent = "+";
    btn.id = "dt-add-tracker-button";
    Object.assign(btn.style, {
      position: "fixed", zIndex: 8, width: "34px", height: "34px", borderRadius: "4px",
      background: "#2ecc71", color: "white", border: "none", cursor: "pointer",
      fontSize: "20px", fontWeight: "bold", lineHeight: "1", boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      opacity: "0" // hidden until we've confirmed a real position - see tryReveal() below
    });
    document.body.appendChild(btn);

    let revealed = false;

    function reposition() {
      const rect = avatar.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false; // avatar not laid out yet
      const btnRect = btn.getBoundingClientRect();
      btn.style.left = (rect.left - btnRect.width - 16) + "px";
      btn.style.top = (rect.top + (rect.height - btnRect.height) / 2) + "px";
      return true;
    }

    // FIX: the previous approach (avatar.complete check + double rAF +
    // a 500ms safety-net timeout) still produced a visible "teleport"
    // once the 500ms timeout fired and corrected a wrong initial
    // position. Guessing fixed delays either fires too early (still
    // wrong) or noticeably late (visible jump) - there's no delay that
    // reliably avoids both. Instead: keep the button fully invisible
    // and keep checking every animation frame until the avatar actually
    // has a real, laid-out rect, THEN reveal the button already
    // correctly positioned. Nothing is ever seen in the wrong spot.
    // FIX: the previous version revealed as soon as the avatar's rect
    // was merely non-zero - but that can happen a moment BEFORE the
    // avatar settles into its true final position (e.g. an intermediate
    // layout pass), so the button would appear slightly wrong, then get
    // visibly corrected once the ongoing sync caught the real position
    // ~250ms later. This waits for the rect to be genuinely STABLE
    // (identical across repeated checks for a short window), not just
    // present, before ever showing the button - with a max-wait safety
    // net in case something never fully settles.
    function tryReveal() {
      let lastRect = null;
      let lastChangeTime = performance.now();
      const startTime = performance.now();
      const STABLE_MS = 200;
      const MAX_WAIT_MS = 3000;

      function ratsMatch(a, b) {
        return a && b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
      }

      function check() {
        const rect = avatar.getBoundingClientRect();
        const now = performance.now();
        const hasSize = rect.width > 0 || rect.height > 0;

        if (hasSize) {
          if (!ratsMatch(rect, lastRect)) {
            lastRect = rect;
            lastChangeTime = now;
          }

          const stableFor = now - lastChangeTime;
          const waitedTooLong = (now - startTime) > MAX_WAIT_MS;

          if (stableFor >= STABLE_MS || waitedTooLong) {
            reposition();
            revealed = true;
            btn.style.opacity = "1";
            return;
          }
        }

        requestAnimationFrame(check);
      }

      requestAnimationFrame(check);
    }
    tryReveal();

    // Once revealed, a lightweight ongoing sync handles any later
    // shifts (window resize, other UI changing nearby) without relying
    // on guessed one-shot timeouts for that case either.
    // Detects any open Bootstrap-based modal (BootstrapDialog's own
    // convention: adds "modal-open" to <body> and a .modal-backdrop
    // element) - generic, so it should catch our own picker dialog too,
    // not just the game's native messageBoxes. Untested against
    // mulligan and card-choice modals specifically - worth confirming
    // those get caught too, since they may use a different mechanism.
    function isUnderScriptMenuOpen() {
      const menu = document.querySelector('.menu-content[role="Menu"]');
      // offsetParent is null when an element (or an ancestor) is
      // display:none - guards against the menu staying in the DOM but
      // hidden between opens, rather than being removed entirely.
      return menu !== null && menu.offsetParent !== null;
    }

    function isBlockingModalOpen() {
      return document.body.classList.contains("modal-open")
        || document.querySelector(".modal-backdrop") !== null
        || isUnderScriptMenuOpen();
    }

    let isDimmed = false;

    const syncInterval = setInterval(() => {
      if (!revealed) return;
      reposition();

      const shouldDim = isBlockingModalOpen();
      if (shouldDim !== isDimmed) {
        isDimmed = shouldDim;
        btn.style.opacity = shouldDim ? String(settings.dimOpacity.value()) : "1";
        btn.style.pointerEvents = shouldDim ? "none" : "auto";
      }
    }, 250);

    window.addEventListener("resize", reposition);
    // FIX: scroll wasn't triggering an immediate reposition at all -
    // only the 250ms interval eventually caught up, making the button
    // visibly lag during active scrolling. capture: true catches
    // scrolling on any scrollable element on the page, not just the
    // window itself, since the scroll event doesn't bubble by default.
    window.addEventListener("scroll", reposition, { passive: true, capture: true });

    // KNOWN FOLLOW-UP (not fixed here): UC's modal-dimming overlay
    // doesn't hide this button, since our z-index sits above it. Left
    // as-is until we know exactly which class/element the game uses
    // for that dimming state - flagged during live testing, not
    // forgotten.
    btn.onclick = () => openPresetPicker({ onAddPreset: handleAddPreset, onCreateAdHoc: handleCreateAdHoc, onCloseWidget: handleCloseWidget, onDeletePreset: handleDeletePreset });

    return btn;
  }

  let trackerButton = null;
  waitForAvatar(avatar => { trackerButton = createButton(avatar); });

  // Single central GameEvent subscription - fans out to active, event-
  // driven presets via registry.dispatchGameEvent. No soul-tied presets
  // exist yet (SAVE Tracker/Change of Winds/Curve Tracker are still
  // planned), so this currently has nothing to dispatch to, but the
  // wiring is ready for when they're built.
  // The button should only exist during active play - hidden once the
  // game ends, before the victory/defeat screen shows. Same three
  // GameEvent actions the Titan Eye Effect script (and, per its own
  // comment, UnderScript's own logger) treats as "the game just ended."
  plugin.events.on("GameEvent", event => {
    dispatchGameEvent(event);
    // Same three actions as before - a disconnect isn't its own
    // distinct action as far as we've seen; it resolves as a win/loss
    // for the remaining player through these same three, so this
    // should already cover it. Worth flagging if a genuine disconnect
    // is ever observed NOT firing any of these three, since that would
    // mean a fourth action name we haven't identified yet.
    if (event?.action === "getVictory" || event?.action === "getDefeat" || event?.action === "getResult") {
      trackerButton?.style && (trackerButton.style.display = "none");
      closeAllWidgets();
    }
  });

  // Auto-load at match start.
  // NOTE: 'connect' is assumed here to fire once per match with full
  // initial state, based on how UnderScript's own battle-logger module
  // uses it (see the original UnderScript source's `connect` handler
  // capturing yourSoul/enemySoul at the very start of a match). This
  // is inferred from reading that code, not something we've verified
  // empirically yet - worth confirming once real soul-tied presets
  // exist to actually test auto-load against.
  // Auto-load favorited/retained presets on GameStart, NOT 'connect'.
  // FIX: 'connect' is only re-dispatched from inside UnderScript's own
  // GameEvent handler via a plain (non-singleton) emit - if our plugin
  // registers its listener even slightly after the real connect event
  // fires (very possible, since bootstrap() polls every 250ms for
  // UnderScript to exist), we'd simply miss it forever with zero
  // console output, since our handler never runs at all. 'GameStart' is
  // fired via eventManager.singleton.emit(), which UnderScript's own
  // event emitter explicitly replays to late subscribers - confirmed
  // by reading its `on()` implementation. Neither favorited nor
  // retained spawning need any data from the event itself, so this
  // switch has no downside for them.
  // Factored out so it can run from BOTH GameStart (the reliable
  // singleton-replay case) AND connect (which - per the discovery
  // below - also fires on a mid-match page refresh, unlike GameStart's
  // replay mechanism, which only survives within the same page session
  // and is wiped out entirely by an actual reload). spawnPreset is
  // already safely idempotent (no-ops if already open), so calling
  // this from both events risks no duplicate widgets.
  function restoreFavoritedAndRetained() {
    // Off by default (matching the original design), but can now be
    // opted into via the new setting - soul-based auto-load below is
    // separate and always applies to spectating regardless.
    if (isSpectating() && !settings.allowFavoritedRetainedWhileSpectating.value()) return;

    const favoritedIds = getFavoritedPresetIds();
    const spawnedFavorites = favoritedIds.filter(id => spawnPreset(id) !== null);
    if (spawnedFavorites.length) {
      logger.log("autoload", "Spawned favorited presets.", spawnedFavorites);
    }
    if (spawnedFavorites.length < favoritedIds.length) {
      logger.warn("autoload", "Some favorited presets could not be spawned (missing definition).",
        favoritedIds.filter(id => !spawnedFavorites.includes(id)));
    }

    if (settings.retainUnclosedPresets.value()) {
      const retainedIds = getRetainedPresetIds().filter(id => !favoritedIds.includes(id));
      retainedIds.forEach(id => spawnPreset(id));
      if (retainedIds.length) {
        logger.log("autoload", "Restored retained (unclosed) presets.", retainedIds);
      }
    }
  }

  plugin.events.on("GameStart", () => {
    if (trackerButton?.style) trackerButton.style.display = "";
    restoreFavoritedAndRetained();
  });

  // NOTE: still on 'connect' specifically because it's the only place
  // we have yourSoul available - this keeps the same unverified timing
  // risk described above. Lower stakes for now since no soul-tied
  // presets exist yet to actually depend on this firing reliably.
  plugin.events.on("connect", data => {
    // Always runs, regardless of settings - this is just state
    // initialization for SAVE Tracker (and any future preset that
    // similarly needs to know "is this a fresh match or a mid-match
    // join"), not an auto-load behavior gated by a toggle.
    resetForMatchStart(data?.turn ?? 0);
    resetCowTrackerForMatchStart(data?.turn ?? 0);
    resetGasterTrackerForMatchStart(data?.turn ?? 0);

    // Discovered via live testing: a mid-match page refresh fires
    // 'connect' but NOT 'GameStart' (the match is reconnecting, not
    // starting) - meaning favorited/retained presets never got a
    // chance to restore themselves after a refresh, even though the
    // data was correctly persisted. Running the same restoration here
    // too closes that gap.
    restoreFavoritedAndRetained();

    // Soul-specific auto-load deliberately has NO spectate guard -
    // unlike favorited/retained, this should fire whether joining a
    // real match or spectating one, checking whichever player is
    // actually relevant (see getRelevantPlayerSoul).
    if (settings.autoLoadSoulPresets.value()) {
      const soul = getRelevantPlayerSoul(data);
      if (soul) {
        const favoritedIds = getFavoritedPresetIds();
        const matches = getAvailablePresets().filter(p => p.soul === soul && !favoritedIds.includes(p.id));
        matches.forEach(p => spawnPreset(p.id));
        if (matches.length) {
          logger.log("autoload", `Auto-loaded soul-specific presets for ${soul}.`, matches.map(p => p.id));
        }
      }
    }
  });
}
