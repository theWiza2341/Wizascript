import { createLogger } from "../core/debug-logger.js";
import { buildLocalizedFormattingData, buildLocalizedCardNameMap } from "../core/card-data.js";
import { BASE_WORD_COLORS } from "./formatting.js";
import { registerPatchMakerSettings } from "./settings.js";
import { createPatchMakerOverlay } from "./overlay.js";

const FEATURE_VERSION = "0.1.0";

import { matchesPage } from "../core/page-match.js";

function waitForMainContent(callback) {
  const existing = document.querySelector(".mainContent");
  if (existing) return callback(existing);
  setTimeout(() => waitForMainContent(callback), 50);
}

function isPatchNotesPage() {
  return matchesPage("/gameUpdates.jsp");
}

export function initPatchMaker(plugin) {
  const settings = registerPatchMakerSettings(plugin);

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
    version: FEATURE_VERSION,
    getWordColors: () => wordColors,
    getUnderlineTokens: () => underlineTokens,
    getCardHoversEnabled: () => settings.cardHovers.value(),
    getCardNameMap: () => cardNameMap,
    getHideControlsEnabled: () => settings.hideControls.value(),
    getOpenOnLoad: () => settings.openOnLoad.value()
  });

  settings.hideControls.on(value => overlay.setControlsHidden(value));

  async function refreshLocalizedData() {
    const languageLabel = settings.language.value();
    const { tokens, localizedColors } = await buildLocalizedFormattingData(languageLabel, BASE_WORD_COLORS);
    underlineTokens = tokens;
    wordColors = { ...BASE_WORD_COLORS, ...localizedColors };
    cardNameMap = await buildLocalizedCardNameMap(languageLabel);
  }

  waitForMainContent(mainEl => {
    overlay.init(mainEl);
    refreshLocalizedData().catch(e => logger.error("init", "Failed to load localized data", e));
  });
}
