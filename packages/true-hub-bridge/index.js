import { createLogger } from "../core/debug-logger.js";
import { registerTrueHubBridgeSettings } from "./settings.js";
import { createTrueHubOverlay } from "./overlay.js";
import { loadDecks } from "./decks-api.js";

// True Hub Bridge only makes sense on the Hub page - matches the
// original standalone script's @match restriction, now enforced inside
// the feature itself since the merged suite's @match is broad.
function isHubPage() {
  return location.pathname.toLowerCase().includes("hub");
}

export function initTrueHubBridge(plugin) {
  const settings = registerTrueHubBridgeSettings(plugin);

  // Bail before anything is registered or fetched - same master-toggle
  // rule as patch-maker: a disabled feature costs ~nothing.
  if (!settings.enabled.value()) return;
  if (!isHubPage()) return;

  const logger = createLogger("TrueHubBridge");

  const originalWarn = logger.warn.bind(logger);
  const originalLog = logger.log.bind(logger);
  logger.log = (...args) => { if (settings.debugLogging.value()) originalLog(...args); };
  logger.warn = (...args) => { if (settings.debugLogging.value()) originalWarn(...args); };

  const overlay = createTrueHubOverlay({
    logger,
    getAutoOpen: () => settings.autoOpen.value(),
    getScrollPaging: () => settings.scrollPaging.value()
  });

  loadDecks()
    .then(decks => {
      overlay.setDecks(decks);
      overlay.init();
    })
    .catch(e => logger.error("data", "Failed to load decks.json", e));
}
