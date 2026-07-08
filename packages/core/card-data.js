// Localized card-name and keyword/tribe/color-word resolution. Used by
// patch-maker (highlighting + card hover lookups) and available to any
// future feature (e.g. true-hub-bridge card search) needing the same
// localized card names. No dependency on any packages/* feature module.

import { getPageWindow } from "./page-window.js";

const KEYWORD_IDS = [
  "determination","charge","haste","armor","disarmed","candy","support",
  "transparency","invulnerable","taunt","dodge","shock","loop","bullseye",
  "wanted","darkspawn","magic","dust","turn-start","turn-end","fatigue",
  "turbo","paralyze","silence","synergy","delay","generated","need",
  "program","erase","switch","catch"
];

const TRIBE_IDS = [
  "tem","dog","amalgamate","g-follower","lost-soul","frog","mold","snail",
  "bomb","plant","royal-guard","all-monster-tribes","chaos-weapon","piece",
  "arachnid","royal-invention","plug","thrashing-part","bargain","dance",
  "giga-attack","round","pack"
];

const SOUL_IDS = ["determination","patience","bravery","integrity","perseverance","kindness","justice"];
const RARITY_IDS = ["base","common","rare","epic","legendary","token"];
const STAT_IDS = ["gold","cost","atk","hp","dmg"];

const FALLBACK_KEYWORDS = [
  "Determination","Charge","Haste","Armor","Disarmed","Candy","Support",
  "Transparency","Invulnerable","Taunt","Dodge","Shock","Loop","Bullseye",
  "Wanted","Darkspawn","Magic","Dust","Turn start","Turn end","Fatigue",
  "Turbo","Paralyze","Silence","Synergy","Delay","Generated","Need",
  "Program","Erase","Switch","Catch"
];

const FALLBACK_TRIBES = [
  "Tem","Dog","Amalgamate","G Follower","Lost Soul","Frog","Mold","Snail",
  "Bomb","Plant","Royal Guard","All monster tribes","Chaos Weapon","Piece",
  "Arachnid","Royal Invention","Plug","Thrashing Part","Bargain","Dance",
  "Giga Attack","Round","Pack",
  "Tems","Dogs","Amalgamates","G Followers","Lost Souls","Frogs","Molds",
  "Snails","Bombs","Plants","Royal Guards","Chaos Weapons","Pieces",
  "Arachnids","Royal Inventions","Plugs","Thrashing Parts","Bargains",
  "Dances","Giga Attacks","Rounds","Packs"
];

const LANGUAGE_LABEL_TO_CODE = {
  "Auto / Default": "auto", "English": "en", "French": "fr", "Spanish": "es",
  "Portuguese": "pt", "Chinese": "cn", "Italian": "it", "Polish": "pl",
  "German": "de", "Russian": "ru"
};

const loadedLanguages = new Set();

// Small local helper - deliberately not imported from patch-maker/formatting.js.
// core/* must never depend on packages/*, so a couple of duplicated
// one-liners here is the right tradeoff over an inverted dependency.
function cleanText(str) {
  return str ? str.replace(/\s+/g, " ").trim() : "";
}

function decodeHtml(input) {
  if (!input) return "";
  try {
    const e = document.createElement("div");
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.textContent.trim();
  } catch {
    return String(input).trim();
  }
}

function getI18n() {
  const pageWindow = getPageWindow();
  return pageWindow.$ && pageWindow.$.i18n ? pageWindow.$.i18n : null;
}

function getTranslateVersion() {
  const pageWindow = getPageWindow();
  return typeof pageWindow.translateVersion !== "undefined" ? pageWindow.translateVersion : "";
}

export function getResolvedLanguage(selectedLabel) {
  const mapped = LANGUAGE_LABEL_TO_CODE[selectedLabel] || "auto";
  if (mapped !== "auto") return mapped;
  try {
    const stored = localStorage.getItem("language");
    if (stored) return stored;
  } catch {}
  return "en";
}

async function ensureLanguageLoaded(lang) {
  if (!lang || lang === "en" || loadedLanguages.has(lang)) return;
  const i18n = getI18n();
  if (!i18n) return;

  const version = getTranslateVersion();
  const path = `/translation/${lang}.json${version ? "?v=" + version : ""}`;

  await new Promise((resolve, reject) => {
    const deferred = i18n().load({ [lang]: path });
    if (deferred && typeof deferred.done === "function") {
      deferred.done(resolve);
      if (typeof deferred.fail === "function") deferred.fail(reject);
    } else {
      resolve();
    }
  });
  loadedLanguages.add(lang);
}

function getLocalizedString(key, ...args) {
  const i18n = getI18n();
  if (!i18n) return "";
  try {
    const value = i18n.apply(i18n, [key, ...args]);
    return (!value || value === key) ? "" : String(value).trim();
  } catch {
    return "";
  }
}

// Builds both the underline-token list and any localized color-word
// overrides (soul/rarity/stat names in the selected language).
export async function buildLocalizedFormattingData(selectedLanguageLabel, baseWordColors) {
  const lang = getResolvedLanguage(selectedLanguageLabel);
  const i18n = getI18n();
  const tokens = FALLBACK_KEYWORDS.concat(FALLBACK_TRIBES);
  const localizedColors = {};

  if (!i18n) {
    return { tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length), localizedColors };
  }

  const originalLocale = i18n().locale;
  try {
    await ensureLanguageLoaded(lang);
    i18n().locale = lang;

    KEYWORD_IDS.forEach(id => {
      const text = getLocalizedString(`kw-${id}`);
      if (text) tokens.push(text);
    });

    TRIBE_IDS.forEach(id => {
      const singular = getLocalizedString(`tribe-${id}`, 1);
      const plural = getLocalizedString(`tribe-${id}`, 2);
      if (singular) tokens.push(singular);
      if (plural) tokens.push(plural);
    });

    const addColorEntry = (id, colorKey) => {
      const translated = getLocalizedString(colorKey === "stat" ? `stat-${id}` : `${colorKey}-${id}`, 1);
      if (!translated) return;
      const clean = cleanText(decodeHtml(translated));
      const color = baseWordColors[id.toUpperCase()] || (id === "gold" ? baseWordColors.G : undefined);
      if (clean && color) {
        localizedColors[clean] = color;
        localizedColors[clean.toUpperCase()] = color;
      }
    };

    SOUL_IDS.forEach(id => addColorEntry(id, "soul"));
    RARITY_IDS.forEach(id => addColorEntry(id, "rarity"));
    STAT_IDS.forEach(id => addColorEntry(id, "stat"));

    const krText = getLocalizedString("status-kr");
    if (krText) {
      const clean = cleanText(decodeHtml(krText));
      if (clean) {
        localizedColors[clean] = baseWordColors.KR;
        localizedColors[clean.toUpperCase()] = baseWordColors.KR;
      }
    }
  } finally {
    try { i18n().locale = originalLocale; } catch {}
  }

  return {
    tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length),
    localizedColors
  };
}

// ---- card name resolution ----

function getAllCards() {
  const pageWindow = getPageWindow();
  const candidates = [pageWindow.allCards, pageWindow.cards, pageWindow.cardList, pageWindow.ucCards];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  return [];
}

function addNameMapping(map, name, id) {
  const clean = cleanText(decodeHtml(name));
  if (clean && id) map.set(clean.toLowerCase(), id);
}

// Retries briefly since allCards may not be populated yet when called
// early in page load.
export async function buildLocalizedCardNameMap(selectedLanguageLabel, attempt = 0) {
  const lang = getResolvedLanguage(selectedLanguageLabel);
  const i18n = getI18n();
  const cards = getAllCards();

  if (!cards.length && attempt < 40) {
    await new Promise(r => setTimeout(r, 250));
    return buildLocalizedCardNameMap(selectedLanguageLabel, attempt + 1);
  }

  const map = new Map();
  if (!cards.length) return map;

  const originalLocale = i18n ? i18n().locale : null;
  try {
    if (i18n) {
      await ensureLanguageLoaded(lang);
      i18n().locale = lang;
    }
    cards.forEach(card => {
      if (!card || !card.id) return;
      if (card.name) {
        addNameMapping(map, card.name, card.id);
        const englishPlural = getLocalizedString(`card-name-${card.id}`, 2);
        if (englishPlural) addNameMapping(map, englishPlural, card.id);
      }
      if (i18n) {
        const singular = getLocalizedString(`card-name-${card.id}`, 1);
        const plural = getLocalizedString(`card-name-${card.id}`, 2);
        if (singular) addNameMapping(map, singular, card.id);
        if (plural) addNameMapping(map, plural, card.id);
      }
    });
  } finally {
    if (i18n && originalLocale) {
      try { i18n().locale = originalLocale; } catch {}
    }
  }

  return map;
}

// ---- card hover binding ----
// Low-level page-global access, so this lives in core rather than
// overlay.js. Two resolution paths: the game's own getCardWithName()
// first (authoritative, current locale), falling back to the localized
// name map for cases it misses.

export function getCardIdByExactGameLookup(name) {
  const pageWindow = getPageWindow();
  const getCardWithName = pageWindow.getCardWithName;
  if (typeof getCardWithName !== "function") return null;
  try {
    const card = getCardWithName(name);
    return card && card.id ? card.id : null;
  } catch {
    return null;
  }
}

export function resolveCardId(name, cardNameMap) {
  if (!cardNameMap) return null;
  return cardNameMap.get(String(name).toLowerCase()) || null;
}

export function attachCardHover(el, cardId) {
  const pageWindow = getPageWindow();
  const displayCardHelp = pageWindow.displayCardHelp;
  const removeCardHover = pageWindow.removeCardHover;
  if (typeof displayCardHelp !== "function" || typeof removeCardHover !== "function") {
    return false;
  }

  el.dataset.ucHoverBound = "true";
  el.style.cursor = "pointer";
  el.addEventListener("mouseover", function () { displayCardHelp(this, cardId); });
  el.addEventListener("mouseleave", function () { removeCardHover(); });
  return true;
}
