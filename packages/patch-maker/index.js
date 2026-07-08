import { createLogger } from "../core/debug-logger.js";
import { buildLocalizedFormattingData } from "../core/card-data.js";
import { BASE_WORD_COLORS } from "./formatting.js";
import { registerPatchMakerSettings } from "./settings.js";
import { createPatchMakerOverlay } from "./overlay.js";

function waitForMainContent(callback) {
  const existing = document.querySelector(".mainContent");
  if (existing) return callback(existing);
  setTimeout(() => waitForMainContent(callback), 50);
}

export function initPatchMaker(plugin) {
  const settings = registerPatchMakerSettings(plugin);

  // Bail before anything is registered or waited on - the whole point
  // of the master toggle is that a disabled feature costs ~nothing.
  if (!settings.enabled.value()) return;

  const logger = createLogger("PatchMaker");
  logger.setCategory("general", true); // overridden below once the setting loads

  const originalWarn = logger.warn.bind(logger);
  const originalLog = logger.log.bind(logger);
  logger.log = (...args) => { if (settings.debugLogging.value()) originalLog(...args); };
  logger.warn = (...args) => { if (settings.debugLogging.value()) originalWarn(...args); };

  let wordColors = { ...BASE_WORD_COLORS };
  let underlineTokens = [];

  const overlay = createPatchMakerOverlay({
    logger,
    wordColors,
    underlineTokens,
    getCardHoversEnabled: () => settings.cardHovers.value(),
    languageLabel: settings.language.value()
  });

  async function refreshLocalizedData() {
    const { tokens, localizedColors } = await buildLocalizedFormattingData(
      settings.language.value(),
      BASE_WORD_COLORS
    );
    underlineTokens = tokens;
    wordColors = { ...BASE_WORD_COLORS, ...localizedColors };
  }

  refreshLocalizedData()
    .then(() => waitForMainContent(mainEl => overlay.init(mainEl)))
    .catch(e => logger.error("init", "Failed to initialize Patch Maker", e));
}
