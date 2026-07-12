import { createLogger } from "../core/debug-logger.js";
import { registerDeckTrackerSettings } from "./settings.js";
import { getFavoritedPresetIds, getAvailablePresets, dispatchGameEvent } from "./registry.js";
import { spawnPreset, spawnAdHocCustomTracker } from "./hud.js";
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

  function handleAddPreset(id) {
    spawnPreset(id);
    logger.log("hud", "Spawned preset from picker:", id);
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
      fontSize: "20px", fontWeight: "bold", lineHeight: "1", boxShadow: "0 1px 4px rgba(0,0,0,0.5)"
    });
    document.body.appendChild(btn);

    function reposition() {
      const rect = avatar.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      btn.style.left = (rect.left - btnRect.width - 16) + "px";
      btn.style.top = (rect.top + (rect.height - btnRect.height) / 2) + "px";
    }
    reposition();
    window.addEventListener("resize", reposition);

    // KNOWN FOLLOW-UP (not fixed here): UC's modal-dimming overlay
    // doesn't hide this button, since our z-index sits above it. Left
    // as-is until we know exactly which class/element the game uses
    // for that dimming state - flagged during live testing, not
    // forgotten.
    btn.onclick = () => openPresetPicker({ onAddPreset: handleAddPreset, onCreateAdHoc: handleCreateAdHoc });

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
  plugin.events.on("connect", data => {
    if (isSpectating()) return;

    const favoritedIds = getFavoritedPresetIds();
    favoritedIds.forEach(id => spawnPreset(id));
    if (favoritedIds.length) {
      logger.log("autoload", "Spawned favorited presets at match start.", favoritedIds);
    }

    if (settings.autoLoadSoulPresets.value()) {
      const soul = data?.yourSoul;
      if (soul) {
        const matches = getAvailablePresets().filter(p => p.soul === soul && !favoritedIds.includes(p.id));
        matches.forEach(p => spawnPreset(p.id));
        if (matches.length) {
          logger.log("autoload", `Auto-loaded soul-specific presets for ${soul}.`, matches.map(p => p.id));
        }
      }
    }
  });
}
