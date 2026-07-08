import { createLogger } from "../core/debug-logger.js";
import { buildLocalizedFormattingData, buildLocalizedCardNameMap } from "../core/card-data.js";
import { BASE_WORD_COLORS } from "./formatting.js";
import { registerPatchMakerSettings } from "./settings.js";
import { createPatchMakerOverlay } from "./overlay.js";

function waitForMainContent(callback) {
  const existing = document.querySelector(".mainContent");
  if (existing) return callback(existing);
  setTimeout(() => waitForMainContent(callback), 50);
}

// Patch Maker only makes sense on the Patch Notes page - matches the
// original standalone script's @match restriction, now enforced inside
// the feature itself since the merged suite's @match is broad.
function isPatchNotesPage() {
  return location.pathname.toLowerCase().includes("gameupdates");
}

export function initPatchMaker(plugin) {
  const settings = registerPatchMakerSettings(plugin);

  // Bail before anything is registered or waited on - the whole point
  // of the master toggle is that a disabled feature costs ~nothing.
  if (!settings.enabled.value()) return;
  if (!isPatchNotesPage()) return;

  const logger = createLogger("PatchMaker");

  const originalWarn = logger.warn.bind(logger);
  const originalLog = logger.log.bind(logger);
  logger.log = (...args) => { if (settings.debugLogging.value()) originalLog(...args); };
  logger.warn = (...args) => { if (settings.debugLogging.value()) originalWarn(...args); };

  let wordColors = { ...BASE_WORD_COLORS };
  let underlineTokens = [];
  let cardNameMap = new Map();

  const overlay = createPatchMakerOverlay({
    logger,
    getWordColors: () => wordColors,
    getUnderlineTokens: () => underlineTokens,
    getCardHoversEnabled: () => settings.cardHovers.value(),
    getCardNameMap: () => cardNameMap
  });

  async function refreshLocalizedData() {
    const languageLabel = settings.language.value();
    const { tokens, localizedColors } = await buildLocalizedFormattingData(languageLabel, BASE_WORD_COLORS);
    underlineTokens = tokens;
    wordColors = { ...BASE_WORD_COLORS, ...localizedColors };

    cardNameMap = await buildLocalizedCardNameMap(languageLabel);
  }

  refreshLocalizedData()
    .then(() => waitForMainContent(mainEl => overlay.init(mainEl)))
    .catch(e => logger.error("init", "Failed to initialize Patch Maker", e));
}
