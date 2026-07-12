import { createLogger } from "../core/debug-logger.js";
import { registerDeckTrackerSettings } from "./settings.js";
import { getFavoritedPresetIds, getAvailablePresets, dispatchGameEvent, deleteCustomPreset, setRetainEnabledGetter, getRetainedPresetIds } from "./registry.js";
import { spawnPreset, spawnAdHocCustomTracker, closeWidget } from "./hud.js";
import { openPresetPicker } from "./picker.js";
import { openCustomTrackerBuilder, openSaveAsPresetPrompt } from "./presets/custom.js";

// Deck Tracker only makes sense on Game/Spectate pages - matches the
// original standalone script's @match restriction, now enforced inside
// the feature itself since the merged suite's @match is broad.
function isGamePage() {
  const path = location.pathname.toLowerCase();
  return path.includes("game") || path.includes("spectate");
}

function isSpectating() {
  return location.pathname.toLowerCase().includes("spectate");
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

  function handleAddPreset(id) {
    spawnPreset(id);
    logger.log("hud", "Spawned preset from picker:", id);
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
      position: "fixed", zIndex: 99999, width: "34px", height: "34px", borderRadius: "4px",
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
    function tryReveal() {
      if (reposition()) {
        revealed = true;
        btn.style.opacity = "1";
      } else {
        requestAnimationFrame(tryReveal);
      }
    }
    tryReveal();

    // Once revealed, a lightweight ongoing sync handles any later
    // shifts (window resize, other UI changing nearby) without relying
    // on guessed one-shot timeouts for that case either.
    const syncInterval = setInterval(() => { if (revealed) reposition(); }, 250);
    window.addEventListener("resize", reposition);

    // KNOWN FOLLOW-UP (not fixed here): UC's modal-dimming overlay
    // doesn't hide this button, since our z-index sits above it. Left
    // as-is until we know exactly which class/element the game uses
    // for that dimming state - flagged during live testing, not
    // forgotten.
    btn.onclick = () => openPresetPicker({ onAddPreset: handleAddPreset, onCreateAdHoc: handleCreateAdHoc, onDeletePreset: handleDeletePreset });

    return btn;
  }

  waitForAvatar(createButton);

  // Single central GameEvent subscription - fans out to active, event-
  // driven presets via registry.dispatchGameEvent. No soul-tied presets
  // exist yet (SAVE Tracker/Change of Winds/Curve Tracker are still
  // planned), so this currently has nothing to dispatch to, but the
  // wiring is ready for when they're built.
  plugin.events.on("GameEvent", event => dispatchGameEvent(event));

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
  plugin.events.on("GameStart", () => {
    const favoritedIds = getFavoritedPresetIds();
    const spawnedFavorites = favoritedIds.filter(id => spawnPreset(id) !== null);
    if (spawnedFavorites.length) {
      logger.log("autoload", "Spawned favorited presets at match start.", spawnedFavorites);
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
  });

  // NOTE: still on 'connect' specifically because it's the only place
  // we have yourSoul available - this keeps the same unverified timing
  // risk described above. Lower stakes for now since no soul-tied
  // presets exist yet to actually depend on this firing reliably.
  plugin.events.on("connect", data => {
    // ============================================================
    // TEMPORARY FOR TESTING ONLY - RESTORE BEFORE MERGING TO MAIN
    // Spectate guard disabled so soul-matched auto-load can be tested
    // without needing a fresh real match every time.
    // if (isSpectating()) return;
    // ============================================================

    if (settings.autoLoadSoulPresets.value()) {
      const soul = data?.yourSoul;
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
