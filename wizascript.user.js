// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      0.1.0
// @description  All-in-one UnderScript plugin suite for Undercards.
// @author       TheWiza2341
// @match        https://undercards.net/*
// @match        https://*.undercards.net/*
// @icon         https://i.imgur.com/qKHDfnB.png
// @updateURL    https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @downloadURL  https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(() => {
  // packages/core/page-window.js
  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  }

  // packages/core/bootstrap.js
  var SUITE_NAME = "Wizascript";
  var SUITE_VERSION = "0.1.0";
  var DOWNLOAD_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js";
  var RETRY_MS = 250;
  var WARN_AFTER_ATTEMPTS = 40;
  var suitePlugin = null;
  var attempts = 0;
  var readyCallbacks = [];
  function tryBootstrap() {
    if (suitePlugin) return;
    attempts++;
    const pageWindow = getPageWindow();
    if (typeof pageWindow.underscript === "undefined" || typeof pageWindow.underscript.plugin !== "function") {
      if (attempts === WARN_AFTER_ATTEMPTS) {
        console.warn(
          "[Wizascript] Still waiting for UnderScript after ~10s. Is UnderScript installed and enabled for this page?"
        );
      }
      setTimeout(tryBootstrap, RETRY_MS);
      return;
    }
    suitePlugin = pageWindow.underscript.plugin(SUITE_NAME, SUITE_VERSION);
    suitePlugin.updater(DOWNLOAD_URL);
    console.log(`[Wizascript] Registered with UnderScript (v${SUITE_VERSION}).`);
    readyCallbacks.forEach((cb) => cb(suitePlugin));
    readyCallbacks.length = 0;
  }
  function bootstrap(onReady) {
    if (suitePlugin) {
      onReady(suitePlugin);
      return;
    }
    readyCallbacks.push(onReady);
    tryBootstrap();
  }

  // packages/core/debug-logger.js
  function createLogger(featureName, initialCategories = {}) {
    const enabled = { ...initialCategories };
    function tag(category) {
      return category ? `[${featureName}:${category}]` : `[${featureName}]`;
    }
    function isEnabled(category) {
      return !category || enabled[category] !== false;
    }
    return {
      setCategory(category, isEnabled2) {
        enabled[category] = isEnabled2;
      },
      log(category, ...args) {
        if (!isEnabled(category)) return;
        console.log(tag(category), ...args);
      },
      warn(category, ...args) {
        if (!isEnabled(category)) return;
        console.warn(tag(category), ...args);
      },
      error(category, ...args) {
        console.error(tag(category), ...args);
      }
    };
  }

  // packages/core/card-data.js
  var KEYWORD_IDS = [
    "determination",
    "charge",
    "haste",
    "armor",
    "disarmed",
    "candy",
    "support",
    "transparency",
    "invulnerable",
    "taunt",
    "dodge",
    "shock",
    "loop",
    "bullseye",
    "wanted",
    "darkspawn",
    "magic",
    "dust",
    "turn-start",
    "turn-end",
    "fatigue",
    "turbo",
    "paralyze",
    "silence",
    "synergy",
    "delay",
    "generated",
    "need",
    "program",
    "erase",
    "switch",
    "catch"
  ];
  var TRIBE_IDS = [
    "tem",
    "dog",
    "amalgamate",
    "g-follower",
    "lost-soul",
    "frog",
    "mold",
    "snail",
    "bomb",
    "plant",
    "royal-guard",
    "all-monster-tribes",
    "chaos-weapon",
    "piece",
    "arachnid",
    "royal-invention",
    "plug",
    "thrashing-part",
    "bargain",
    "dance",
    "giga-attack",
    "round",
    "pack"
  ];
  var SOUL_IDS = ["determination", "patience", "bravery", "integrity", "perseverance", "kindness", "justice"];
  var RARITY_IDS = ["base", "common", "rare", "epic", "legendary", "token"];
  var STAT_IDS = ["gold", "cost", "atk", "hp", "dmg"];
  var FALLBACK_KEYWORDS = [
    "Determination",
    "Charge",
    "Haste",
    "Armor",
    "Disarmed",
    "Candy",
    "Support",
    "Transparency",
    "Invulnerable",
    "Taunt",
    "Dodge",
    "Shock",
    "Loop",
    "Bullseye",
    "Wanted",
    "Darkspawn",
    "Magic",
    "Dust",
    "Turn start",
    "Turn end",
    "Fatigue",
    "Turbo",
    "Paralyze",
    "Silence",
    "Synergy",
    "Delay",
    "Generated",
    "Need",
    "Program",
    "Erase",
    "Switch",
    "Catch"
  ];
  var FALLBACK_TRIBES = [
    "Tem",
    "Dog",
    "Amalgamate",
    "G Follower",
    "Lost Soul",
    "Frog",
    "Mold",
    "Snail",
    "Bomb",
    "Plant",
    "Royal Guard",
    "All monster tribes",
    "Chaos Weapon",
    "Piece",
    "Arachnid",
    "Royal Invention",
    "Plug",
    "Thrashing Part",
    "Bargain",
    "Dance",
    "Giga Attack",
    "Round",
    "Pack",
    "Tems",
    "Dogs",
    "Amalgamates",
    "G Followers",
    "Lost Souls",
    "Frogs",
    "Molds",
    "Snails",
    "Bombs",
    "Plants",
    "Royal Guards",
    "Chaos Weapons",
    "Pieces",
    "Arachnids",
    "Royal Inventions",
    "Plugs",
    "Thrashing Parts",
    "Bargains",
    "Dances",
    "Giga Attacks",
    "Rounds",
    "Packs"
  ];
  var LANGUAGE_LABEL_TO_CODE = {
    "Auto / Default": "auto",
    "English": "en",
    "French": "fr",
    "Spanish": "es",
    "Portuguese": "pt",
    "Chinese": "cn",
    "Italian": "it",
    "Polish": "pl",
    "German": "de",
    "Russian": "ru"
  };
  var loadedLanguages = /* @__PURE__ */ new Set();
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
  function getResolvedLanguage(selectedLabel) {
    const mapped = LANGUAGE_LABEL_TO_CODE[selectedLabel] || "auto";
    if (mapped !== "auto") return mapped;
    try {
      const stored = localStorage.getItem("language");
      if (stored) return stored;
    } catch {
    }
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
      return !value || value === key ? "" : String(value).trim();
    } catch {
      return "";
    }
  }
  async function buildLocalizedFormattingData(selectedLanguageLabel, baseWordColors) {
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
      KEYWORD_IDS.forEach((id) => {
        const text = getLocalizedString(`kw-${id}`);
        if (text) tokens.push(text);
      });
      TRIBE_IDS.forEach((id) => {
        const singular = getLocalizedString(`tribe-${id}`, 1);
        const plural = getLocalizedString(`tribe-${id}`, 2);
        if (singular) tokens.push(singular);
        if (plural) tokens.push(plural);
      });
      const addColorEntry = (id, colorKey) => {
        const translated = getLocalizedString(colorKey === "stat" ? `stat-${id}` : `${colorKey}-${id}`, 1);
        if (!translated) return;
        const clean = cleanText(decodeHtml(translated));
        const color = baseWordColors[id.toUpperCase()] || (id === "gold" ? baseWordColors.G : void 0);
        if (clean && color) {
          localizedColors[clean] = color;
          localizedColors[clean.toUpperCase()] = color;
        }
      };
      SOUL_IDS.forEach((id) => addColorEntry(id, "soul"));
      RARITY_IDS.forEach((id) => addColorEntry(id, "rarity"));
      STAT_IDS.forEach((id) => addColorEntry(id, "stat"));
      const krText = getLocalizedString("status-kr");
      if (krText) {
        const clean = cleanText(decodeHtml(krText));
        if (clean) {
          localizedColors[clean] = baseWordColors.KR;
          localizedColors[clean.toUpperCase()] = baseWordColors.KR;
        }
      }
    } finally {
      try {
        i18n().locale = originalLocale;
      } catch {
      }
    }
    return {
      tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length),
      localizedColors
    };
  }
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
  async function buildLocalizedCardNameMap(selectedLanguageLabel, attempt = 0) {
    const lang = getResolvedLanguage(selectedLanguageLabel);
    const i18n = getI18n();
    const cards = getAllCards();
    if (!cards.length && attempt < 40) {
      await new Promise((r) => setTimeout(r, 250));
      return buildLocalizedCardNameMap(selectedLanguageLabel, attempt + 1);
    }
    const map = /* @__PURE__ */ new Map();
    if (!cards.length) return map;
    const originalLocale = i18n ? i18n().locale : null;
    try {
      if (i18n) {
        await ensureLanguageLoaded(lang);
        i18n().locale = lang;
      }
      cards.forEach((card) => {
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
        try {
          i18n().locale = originalLocale;
        } catch {
        }
      }
    }
    return map;
  }
  function getCardIdByExactGameLookup(name) {
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
  function resolveCardId(name, cardNameMap) {
    if (!cardNameMap) return null;
    return cardNameMap.get(String(name).toLowerCase()) || null;
  }
  function attachCardHover(el, cardId) {
    const pageWindow = getPageWindow();
    const displayCardHelp = pageWindow.displayCardHelp;
    const removeCardHover = pageWindow.removeCardHover;
    if (typeof displayCardHelp !== "function" || typeof removeCardHover !== "function") {
      return false;
    }
    el.dataset.ucHoverBound = "true";
    el.style.cursor = "pointer";
    el.addEventListener("mouseover", function() {
      displayCardHelp(this, cardId);
    });
    el.addEventListener("mouseleave", function() {
      removeCardHover();
    });
    return true;
  }

  // packages/patch-maker/formatting.js
  var BASE_WORD_COLORS = {
    ATK: "#f0003c",
    HP: "#0dd000",
    cost: "#00d0ff",
    DMG: "#ffcc00",
    DETERMINATION: "red",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00",
    MONSTER: "#ffffff",
    TOKEN: "#00c800",
    BASE: "gray",
    COMMON: "#fff",
    RARE: "#00b8ff",
    EPIC: "#d535d9",
    LEGENDARY: "gold",
    DT: "red",
    COST: "#00d0ff",
    G: "gold",
    KR: "#d535d9"
  };
  var CARD_REF_REGEX = /\{([^{}]+?)\}/g;
  var UL_OPEN = "__UC_UL_OPEN__";
  var UL_CLOSE = "__UC_UL_CLOSE__";
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function sanitizeText(str) {
    return str ? str.replace(/\s+/g, " ").trim() : "";
  }
  function insertUnderlineMarkers(text, underlineTokens) {
    let result = text;
    underlineTokens.forEach((token) => {
      const re = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(token)})(?=([^A-Za-z0-9]|$))`, "g");
      result = result.replace(re, (m, pre, word) => pre + UL_OPEN + word + UL_CLOSE);
    });
    return result;
  }
  var CASE_SENSITIVE_COLOR_WORDS = /* @__PURE__ */ new Set(["BASE", "COMMON", "RARE", "EPIC", "LEGENDARY", "TOKEN"]);
  function applyColorWords(seg, wordColors) {
    const allKeys = Object.keys(wordColors).filter(Boolean);
    const caseSensitiveKeys = allKeys.filter((k) => CASE_SENSITIVE_COLOR_WORDS.has(k));
    const caseInsensitiveKeys = allKeys.filter((k) => !CASE_SENSITIVE_COLOR_WORDS.has(k));
    if (caseSensitiveKeys.length) {
      const pattern = caseSensitiveKeys.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=([^\\p{L}\\p{N}_]|$))`, "gu");
      seg = seg.replace(regex, (match, pre, word) => {
        const c = wordColors[word];
        return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
      });
    }
    if (caseInsensitiveKeys.length) {
      const pattern = caseInsensitiveKeys.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=([^\\p{L}\\p{N}_]|$))`, "giu");
      seg = seg.replace(regex, (match, pre, word) => {
        const c = wordColors[word] || wordColors[word.toUpperCase()] || wordColors[word.toLowerCase()];
        return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
      });
    }
    return seg;
  }
  function applyCardFormatting(seg, wordColors) {
    const cardColor = wordColors.PATIENCE || "#41fcff";
    return seg.replace(CARD_REF_REGEX, (match, inner) => {
      const cleaned = inner.replace(new RegExp(UL_OPEN, "g"), "").replace(new RegExp(UL_CLOSE, "g"), "").replace(/<[^>]*>/g, "").trim();
      return `<span class="uc-card-ref" style="color:${cardColor};">${escapeHtml(cleaned)}</span>`;
    });
  }
  function applyStatFormatting(seg, wordColors) {
    const statPattern = /(?<!\d)([+-]?)(\d+)\/([+-]?)(\d+)(?:\/([+-]?)(\d+))?(?=[^\d/]|$)/g;
    return seg.replace(statPattern, (match, s1, a, s2, b, s3, c) => {
      if (c !== void 0) {
        return `${s1}<span style="color:${wordColors.cost}">${a}</span>/${s2}<span style="color:${wordColors.ATK}">${b}</span>/${s3}<span style="color:${wordColors.HP}">${c}</span>`;
      }
      return `${s1}<span style="color:${wordColors.ATK}">${a}</span>/${s2}<span style="color:${wordColors.HP}">${b}</span>`;
    });
  }
  function formatSegments(work, wordColors, underlineTokens) {
    const parts = [];
    const re = /_(.+?)_/g;
    let last = 0, m;
    while ((m = re.exec(work)) !== null) {
      if (m.index > last) parts.push({ text: work.slice(last, m.index), manual: false });
      parts.push({ text: m[1], manual: true });
      last = m.index + m[0].length;
    }
    if (last < work.length) parts.push({ text: work.slice(last), manual: false });
    return parts.map((part) => {
      let seg = part.text;
      if (part.manual) {
        return `<span style="text-decoration:underline;">${escapeHtml(seg.trim())}</span>`;
      }
      seg = insertUnderlineMarkers(seg, underlineTokens);
      seg = escapeHtml(seg);
      seg = applyColorWords(seg, wordColors);
      seg = applyCardFormatting(seg, wordColors);
      seg = applyStatFormatting(seg, wordColors);
      return seg.replace(new RegExp(UL_OPEN, "g"), `<span style="text-decoration:underline;">`).replace(new RegExp(UL_CLOSE, "g"), `</span>`);
    }).join("");
  }
  function extractSkipTokens(text) {
    const skipped = [];
    const work = text.replace(/\\([A-Za-z0-9\-]+)/g, (m, word) => {
      const idx = skipped.length;
      skipped.push(word);
      return `UCSK${idx}Z`;
    });
    return { work, skipped };
  }
  function formatSwitchInner(rawText, wordColors, underlineTokens) {
    if (!rawText) return "";
    return formatSegments(rawText, wordColors, underlineTokens);
  }
  function formatLine(rawText, wordColors, underlineTokens) {
    if (!rawText) return "";
    const skipData = extractSkipTokens(rawText);
    let work = skipData.work;
    const switchBlocks = [];
    work = work.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
      const idx = switchBlocks.length;
      switchBlocks.push(inner);
      return `UCXSW${idx}Y`;
    });
    let formatted = formatSegments(work, wordColors, underlineTokens);
    let switchIndex = 0;
    formatted = formatted.replace(/UCXSW(\d+)Y/g, (match, idxStr) => {
      const innerHtml = formatSwitchInner(switchBlocks[Number(idxStr)] || "", wordColors, underlineTokens);
      const bgColor = switchIndex % 2 === 0 ? "rgba(0, 255, 255, 0.4)" : "rgba(255, 0, 0, 0.4)";
      switchIndex++;
      return `<span style="background-color:${bgColor};">${innerHtml}</span>`;
    });
    formatted = formatted.replace(/UCSK(\d+)Z/g, (m, idx) => escapeHtml(skipData.skipped[Number(idx)] || ""));
    return formatted;
  }

  // packages/core/settings.js
  function createFeatureSettings(plugin, featureName, categoryLabel) {
    const settingsApi = plugin.settings();
    const registered = {};
    function add(key, config) {
      const setting = settingsApi.add({
        ...config,
        key: `${featureName}.${key}`,
        category: config.category || categoryLabel
      });
      registered[key] = setting;
      return setting;
    }
    function value(key) {
      return registered[key].value();
    }
    return { add, value };
  }

  // packages/patch-maker/settings.js
  function registerPatchMakerSettings(plugin) {
    const settings = createFeatureSettings(plugin, "patchmaker", "Patch Maker");
    return {
      settings,
      enabled: settings.add("enabled", { name: "Enable Patch Maker", type: "boolean", default: true }),
      debugLogging: settings.add("debugLogging", { name: "Enable debug logging", type: "boolean", default: false }),
      hideControls: settings.add("hideControls", { name: "Hide Patch Maker controls", type: "boolean", default: false }),
      cardHovers: settings.add("enableCardHovers", { name: "Enable card hovers", type: "boolean", default: true }),
      language: settings.add("patchLanguage", {
        name: "Select Language",
        type: "select",
        options: ["Auto / Default", "English", "French", "Spanish", "Portuguese", "Chinese", "Italian", "Polish", "German", "Russian"],
        default: "Auto / Default",
        onChange: () => location.reload()
      }),
      openOnLoad: settings.add("openPatchNotesOnPageLoad", { name: "Auto-Load Patch Maker", type: "boolean", default: false })
    };
  }

  // packages/patch-maker/styles.js
  var PATCH_MAKER_CSS = `
html, body { overflow-x: hidden !important; }

#uc-patch-overlay {
  min-height: 100vh;
  max-width: 100vw;
  overflow-y: visible !important;
  overflow-x: visible !important;
}
#uc-patch-overlay > div { overflow-x: visible !important; }

#uc-patch-overlay li.buff   { border-left: 3px solid #00c800; }
#uc-patch-overlay li.rework { border-left: 3px solid gold; }
#uc-patch-overlay li.nerf   { border-left: 3px solid red; }
#uc-patch-overlay li.other  { border-left: 3px solid gray; }
#uc-patch-overlay li.none   { border-left: none !important; }

#uc-patch-overlay.editor-mode p  { background-color: rgba(255, 255, 0, 0.10); }
#uc-patch-overlay.editor-mode li { background-color: rgba(173,216,230,0.12); }

#uc-patch-overlay li {
  padding-left: 5px;
  border-radius: 3px;
  position: relative;
  margin: 10px 0;
  list-style-type: disc;
  font-size: 14px;
}

#uc-patch-overlay ul {
  margin-top: 0;
  margin-bottom: 10px;
  padding-left: 40px;
  list-style-position: outside;
}

#uc-patch-overlay p { position: relative; font-size: 14px; }

#uc-patch-overlay .uc-li-text:focus { outline: none; }
#uc-patch-overlay li:focus-within {
  outline: 2px solid white;
  outline-offset: 3px;
  border-radius: 4px;
}

#uc-patch-overlay .uc-collapse-btn {
  position: absolute;
  right: -38px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  background-color: #0099cc;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.9;
}

#uc-patch-overlay .uc-section-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  opacity: 0.9;
  right: -64px;
  background-color: #e74c3c;
}

#uc-patch-overlay .uc-section-label:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}

#uc-patch-overlay .uc-add-section-row {
  margin: 0 0 10px 0;
  background-color: rgba(255, 255, 0, 0.10);
  padding: 0 6px;
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
}

#uc-patch-overlay .uc-add-section-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-section {
  margin: 8px 0 28px 0;
}

#uc-patch-overlay .uc-card-toolbar {
  display: none;
}

#uc-patch-overlay .uc-card-add-tile {
  width: 176px;
  height: 246px;
  background-color: rgba(255, 255, 0, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  flex: 0 0 auto;
}

#uc-patch-overlay .uc-card-add-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  min-height: 246px;
}

#uc-patch-overlay .uc-card-item {
  position: relative;
  display: inline-block;
  outline: none;
}

#uc-patch-overlay .uc-card-item:focus {
  outline: 2px solid white;
  outline-offset: 3px;
}

#uc-patch-overlay .uc-card-frame {
  width: 176px;
  height: 246px;
  overflow: hidden;
  background: #000;
}

#uc-patch-overlay .uc-card-frame img {
  width: 176px;
  height: 246px;
  display: block;
  image-rendering: auto;
}

#uc-patch-overlay .uc-card-del {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background-color: #e74c3c;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.95;
}

#uc-patch-overlay .uc-li-add,
#uc-patch-overlay .uc-li-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.9;
}

#uc-patch-overlay .uc-li-add { right: -38px; background-color: #2ecc71; }
#uc-patch-overlay .uc-li-del { right: -64px; background-color: #e74c3c; }
#uc-patch-overlay .uc-li-del:disabled {
  background-color: #777;
  opacity: 0.4;
  cursor: not-allowed;
}

#uc-patch-overlay.viewer-mode .uc-li-add,
#uc-patch-overlay.viewer-mode .uc-li-del,
#uc-patch-overlay.viewer-mode .uc-collapse-btn,
#uc-patch-overlay.viewer-mode .uc-section-del,
#uc-patch-overlay.viewer-mode .uc-add-section-row,
#uc-patch-overlay.viewer-mode .uc-card-toolbar,
#uc-patch-overlay.viewer-mode .uc-card-del,
#uc-patch-overlay.viewer-mode .uc-card-add-tile,
#uc-patch-overlay.viewer-mode .uc-card-add-btn {
  display: none !important;
}
#uc-patch-overlay.viewer-mode p,
#uc-patch-overlay.viewer-mode li {
  background-color: transparent !important;
}

.uc-skip { all: unset; }
`;
  function injectPatchMakerStyle() {
    if (document.getElementById("uc-patch-maker-style")) return;
    const style = document.createElement("style");
    style.id = "uc-patch-maker-style";
    style.textContent = PATCH_MAKER_CSS;
    document.head.appendChild(style);
  }

  // packages/patch-maker/input-blocker.js
  function isEditingOverlayField() {
    const ae = document.activeElement;
    return !!(ae && (ae.classList.contains("uc-li-text") || ae.classList.contains("uc-section-label") || ae.tagName === "H2" && ae.getAttribute("contenteditable") === "true"));
  }
  function isViewerMode() {
    const overlay = document.getElementById("uc-patch-overlay");
    return !!(overlay && overlay.classList.contains("viewer-mode"));
  }
  function inputBlocker(e) {
    if (!isEditingOverlayField() || isViewerMode()) return;
    const isOwnShortcut = !e.altKey && !e.metaKey && (e.ctrlKey || e.shiftKey) && (e.key === "ArrowUp" || e.key === "ArrowDown");
    if (isOwnShortcut) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      if (e.key === "Enter") document.activeElement.blur();
    }
  }
  function enableInputBlocker() {
    window.addEventListener("keydown", inputBlocker, true);
    window.addEventListener("keyup", inputBlocker, true);
    document.addEventListener("keydown", inputBlocker, true);
    document.addEventListener("keyup", inputBlocker, true);
  }
  function disableInputBlocker() {
    window.removeEventListener("keydown", inputBlocker, true);
    window.removeEventListener("keyup", inputBlocker, true);
    document.removeEventListener("keydown", inputBlocker, true);
    document.removeEventListener("keyup", inputBlocker, true);
  }

  // packages/patch-maker/new-cards.js
  var TARGET_W = 176;
  var TARGET_H = 246;
  var FIELDMARKER_WATERMARK_CROP_PX = 14;
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  async function normalizeCardImage(dataUrl) {
    const img = await loadImageFromDataURL(dataUrl);
    if (img.naturalWidth === TARGET_W && img.naturalHeight === TARGET_H) {
      return dataUrl;
    }
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (img.naturalWidth === 163 && img.naturalHeight >= 250) {
      sh = Math.max(1, img.naturalHeight - FIELDMARKER_WATERMARK_CROP_PX);
    }
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
    return canvas.toDataURL("image/png");
  }
  function createNewCardsFeature({ isViewerMode: isViewerMode2, saveState }) {
    function ensureCardAddTile(section) {
      const gallery = section.querySelector(".uc-card-gallery");
      if (!gallery) return null;
      let addTile = gallery.querySelector(":scope > .uc-card-add-tile");
      if (addTile) {
        gallery.appendChild(addTile);
        return addTile;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;
      fileInput.style.display = "none";
      addTile = document.createElement("div");
      addTile.className = "uc-card-add-tile";
      const addBtn = document.createElement("button");
      addBtn.className = "uc-card-add-btn";
      addBtn.textContent = "+";
      addBtn.title = "Add card image";
      addBtn.onclick = () => {
        if (isViewerMode2()) return;
        fileInput.click();
      };
      fileInput.addEventListener("change", async (e) => {
        const files = [...e.target.files || []];
        if (!files.length) return;
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          const dataUrl = await readFileAsDataURL(file);
          const normalized = await normalizeCardImage(dataUrl);
          addCardImage(section, normalized, file.name || "Card image");
        }
        fileInput.value = "";
        ensureCardAddTile(section);
        saveState();
      });
      addTile.appendChild(addBtn);
      addTile.appendChild(fileInput);
      gallery.appendChild(addTile);
      return addTile;
    }
    function addCardImage(section, src, name = "Card image") {
      const gallery = section.querySelector(".uc-card-gallery");
      if (!gallery) return null;
      ensureCardAddTile(section);
      const item = document.createElement("div");
      item.className = "uc-card-item";
      item.tabIndex = 0;
      item.dataset.src = src;
      item.dataset.name = name;
      const frame = document.createElement("div");
      frame.className = "uc-card-frame";
      const img = document.createElement("img");
      img.src = src;
      img.alt = name;
      frame.appendChild(img);
      item.appendChild(frame);
      const delBtn = document.createElement("button");
      delBtn.className = "uc-card-del";
      delBtn.textContent = "\u2212";
      delBtn.title = "Remove card image";
      delBtn.onclick = (e) => {
        if (isViewerMode2()) return;
        e.stopPropagation();
        item.remove();
        ensureCardAddTile(section);
        saveState();
      };
      item.appendChild(delBtn);
      item.addEventListener("keydown", (e) => {
        if (isViewerMode2()) return;
        const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        const isMove = e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && dir;
        if (!isMove) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moveCardItem(item, dir);
      }, true);
      const addTile = gallery.querySelector(":scope > .uc-card-add-tile");
      if (addTile) gallery.insertBefore(item, addTile);
      else gallery.appendChild(item);
      ensureCardAddTile(section);
      return item;
    }
    function moveCardItem(item, dir) {
      const gallery = item.parentElement;
      if (!gallery) return;
      const items = [...gallery.querySelectorAll(":scope > .uc-card-item")];
      const idx = items.indexOf(item);
      if (idx < 0 || items.length <= 1) return;
      const newIdx = (idx + dir + items.length) % items.length;
      const target = items[newIdx];
      if (dir < 0) {
        if (idx === 0) gallery.appendChild(item);
        else gallery.insertBefore(item, target);
      } else {
        if (idx === items.length - 1) gallery.insertBefore(item, items[0]);
        else gallery.insertBefore(item, target.nextElementSibling);
      }
      ensureCardAddTile(gallery.parentElement);
      saveState();
      setTimeout(() => item.focus(), 0);
    }
    function createSection(container) {
      const p = document.createElement("p");
      p.className = "uc-new-cards-header";
      const label = document.createElement("span");
      label.textContent = "New cards";
      p.appendChild(label);
      const section = document.createElement("div");
      section.className = "uc-card-section";
      const gallery = document.createElement("div");
      gallery.className = "uc-card-gallery";
      section.appendChild(gallery);
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "uc-collapse-btn";
      collapseBtn.textContent = "\u2212";
      collapseBtn.onclick = () => {
        if (isViewerMode2()) return;
        const collapsed = section.style.display === "none";
        section.style.display = collapsed ? "" : "none";
        collapseBtn.textContent = collapsed ? "\u2212" : "+";
        saveState();
      };
      p.appendChild(collapseBtn);
      container.appendChild(p);
      container.appendChild(section);
      ensureCardAddTile(section);
      return { p, section, gallery };
    }
    function collectState(container) {
      const header = container.querySelector("p.uc-new-cards-header");
      const section = header ? header.nextElementSibling : null;
      if (!header || !section) return { collapsed: false, cards: [] };
      return {
        collapsed: section.style.display === "none",
        cards: [...section.querySelectorAll(".uc-card-item")].map((item) => ({
          src: item.dataset.src || "",
          name: item.dataset.name || "Card image"
        })).filter((card) => card.src)
      };
    }
    function restoreState(container, newCards) {
      const header = container.querySelector("p.uc-new-cards-header");
      const section = header ? header.nextElementSibling : null;
      if (!header || !section) return;
      const btn = header.querySelector(".uc-collapse-btn");
      section.style.display = newCards && newCards.collapsed ? "none" : "";
      if (btn) btn.textContent = newCards && newCards.collapsed ? "+" : "\u2212";
      const gallery = section.querySelector(".uc-card-gallery");
      if (gallery) gallery.innerHTML = "";
      ensureCardAddTile(section);
      (newCards && newCards.cards || []).forEach((card) => {
        if (card && card.src) addCardImage(section, card.src, card.name || "Card image");
      });
      ensureCardAddTile(section);
    }
    return { createSection, collectState, restoreState };
  }

  // packages/patch-maker/overlay.js
  var STATE_KEY = "wizascript.patchmaker.state.v1";
  var cycleOrder = ["none", "other", "buff", "rework", "nerf"];
  var DEFAULT_SECTIONS = [
    "Balancing (Monsters)",
    "Balancing (Spells)",
    "Balancing (Artifacts)",
    "Balancing (Board Slots)",
    "Balancing (Souls)",
    "Balancing (Other)"
  ];
  var DEFAULT_OPEN_SECTIONS = /* @__PURE__ */ new Set([
    "Balancing (Monsters)",
    "Balancing (Spells)",
    "Balancing (Artifacts)"
  ]);
  function buildHelpMessage(version) {
    return `<u><b>Basic Editing</b></u>
Click any balance change to begin editing
\u2022 Enter  = Confirm change


<u><b>Adding & Removing Entries</b></u>
\u2022 Green/Red +/- Button \u2013 Add a new entry / Remove entry


<u><b>Toggle Balance Sections</b></u>
\u2022 Blue +/- Button \u2013 Toggle visibility of a balance section
<span style="color:#ff5555;">NOTE:</span> Hidden sections will not appear in Viewer Mode


<u><b>Entry Class Type</b></u>
Each entry needs a category:
\u2022 Other (GRAY)
\u2022 Buff (GREEN)
\u2022 Rework (GOLD)
\u2022 Nerf (RED)
\u2022 None (EMPTY)


<u><b>Category Shortcuts</b></u>
\u2022 Ctrl  + Up / Down   \u2192 Change class type
\u2022 Shift + Up / Down   \u2192 Move entry up/down in section


<u><b>Custom Balance Sections</b></u>
\u2022 Green + Button \u2013 Add a new custom balance section
\u2022 Red - Button - Remove custom balance section (Double Click Required)
\u2022 Click a section name to select it
\u2022 Shift + Up / Down \u2013 Move selected section up/down


<u><b>Automatic Highlighting</b></u>
The following are highlighted automatically:
\u2022 Stats: ATK, HP, COST, DMG
\u2022 Numeric stats: 3/2, +1/+1, 1/1/1
\u2022 Rarities, resources, keywords, and tribes


<u><b>Manually Ignore Formatting</b></u>
Use backwards slash to skip automatic formatting for words:
Red \\Snail -- \\ATK 2 > 1.


<u><b>Manual Underlining</b></u>
Use underscores to force underline:
Magic: Equip _Example_.


<u><b>Manual Switch Highlighting</b></u>
Use double brackets for switch effects:
Switch: [[Example 1]] or [[Example 2]]


<u><b>Manual Card References</b></u>
Use curly braces to reference cards:
Magic: Cast {Example}.


<u><b>Viewer Mode vs Editor Mode</b></u>
Editor Mode:
\u2022 Editable, no formatting

Viewer Mode:
\u2022 Read-only
\u2022 Formatting applied
\u2022 Clean display


<u><b>Saving & Reset</b></u>
\u2022 Changes save automatically
\u2022 Double-click Reset Data to clear everything

Version: v${version}`;
  }
  function createPatchMakerOverlay({
    logger,
    getWordColors,
    getUnderlineTokens,
    getCardHoversEnabled,
    getCardNameMap,
    getHideControlsEnabled,
    getOpenOnLoad,
    version
  }) {
    let overlay, container, toggle, modeToggle, resetBtn, helpBtn;
    let custom = false;
    let isViewerMode2 = false;
    let originalPatchNotesNodes = [];
    let controlButtons = [];
    const newCards = createNewCardsFeature({
      isViewerMode: () => overlay.classList.contains("viewer-mode"),
      saveState: () => saveState()
    });
    function saveState() {
      try {
        const state = collectState();
        if (state) {
          GM_setValue(STATE_KEY, JSON.stringify(state));
          logger.log("save", "State saved.", { sections: state.sections.length });
        }
      } catch (e) {
        logger.error("save", "Failed to save state", e);
      }
    }
    function loadState() {
      const text = GM_getValue(STATE_KEY, "");
      if (!text) {
        logger.log("load", "No saved state found.");
        return;
      }
      try {
        const saved = JSON.parse(text);
        if (saved && saved.sections) {
          restoreState(saved);
          logger.log("load", "State restored.", { sections: saved.sections.length });
        }
      } catch (e) {
        logger.error("load", "Failed to parse saved state", e);
      }
    }
    function resetState() {
      GM_deleteValue(STATE_KEY);
    }
    function makeEditable(el, placeholder) {
      el.setAttribute("contenteditable", "true");
      el.spellcheck = false;
      el.addEventListener("focus", () => {
        el.dataset.prevText = el.textContent.trim();
        enableInputBlocker();
      });
      el.addEventListener("blur", () => {
        let t = sanitizeText(el.textContent);
        if (!t) t = placeholder;
        el.textContent = t;
        saveState();
        disableInputBlocker();
      });
      el.addEventListener("keydown", (e) => {
        if (overlay.classList.contains("viewer-mode")) return;
        if (e.key === "Enter") {
          e.preventDefault();
          el.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          el.textContent = el.dataset.prevText;
          el.blur();
        }
      });
      el.addEventListener("paste", (e) => {
        if (overlay.classList.contains("viewer-mode")) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
        document.execCommand("insertText", false, sanitizeText(txt));
      });
    }
    function createNewLI() {
      const li = document.createElement("li");
      li.classList.add("other");
      li.dataset.raw = "[New entry]";
      const span = document.createElement("span");
      span.className = "uc-li-text";
      span.textContent = li.dataset.raw;
      li.appendChild(span);
      const addBtn = document.createElement("button");
      addBtn.className = "uc-li-add";
      addBtn.textContent = "+";
      const delBtn = document.createElement("button");
      delBtn.className = "uc-li-del";
      delBtn.textContent = "\u2212";
      li.appendChild(addBtn);
      li.appendChild(delBtn);
      setupLiTextEditing(li);
      addBtn.onclick = (e) => {
        if (overlay.classList.contains("viewer-mode")) return;
        e.stopPropagation();
        const ul = li.parentElement;
        const newLi = createNewLI();
        ul.insertBefore(newLi, li.nextSibling);
        updateDeleteState(ul);
        saveState();
      };
      delBtn.onclick = (e) => {
        if (overlay.classList.contains("viewer-mode")) return;
        e.stopPropagation();
        const ul = li.parentElement;
        if (ul.children.length <= 1) return;
        li.remove();
        updateDeleteState(ul);
        saveState();
      };
      return li;
    }
    function updateDeleteState(ul) {
      const lis = ul.querySelectorAll(":scope > li");
      const disable = lis.length <= 1;
      lis.forEach((li) => {
        const btn = li.querySelector(".uc-li-del");
        if (btn) btn.disabled = disable;
      });
    }
    function setupLiTextEditing(li) {
      const span = li.querySelector(".uc-li-text");
      span.setAttribute("contenteditable", "true");
      span.spellcheck = false;
      span.addEventListener("focus", () => {
        span.dataset.prevText = span.textContent.trim();
        enableInputBlocker();
      });
      span.addEventListener("blur", () => {
        let t = sanitizeText(span.textContent);
        if (!t) t = "[New entry]";
        span.textContent = t;
        li.dataset.raw = t;
        saveState();
        disableInputBlocker();
      });
      span.addEventListener("keydown", (e) => {
        if (handleShortcut(e)) return;
        if (overlay.classList.contains("viewer-mode")) return;
        if (e.key === "Enter") {
          e.preventDefault();
          span.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          span.textContent = span.dataset.prevText;
          li.dataset.raw = span.dataset.prevText;
          span.blur();
        }
      }, true);
      span.addEventListener("paste", (e) => {
        if (overlay.classList.contains("viewer-mode")) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
        document.execCommand("insertText", false, sanitizeText(txt));
      });
    }
    function appendSection(label, isCustom, focusName, beforeNode, startCollapsed = false) {
      const p = document.createElement("p");
      p.className = "uc-section-header";
      p.dataset.custom = isCustom ? "true" : "false";
      const labelEl = document.createElement("span");
      labelEl.className = "uc-section-label";
      labelEl.textContent = label || "[New Balance Section]";
      labelEl.setAttribute("contenteditable", isCustom ? "true" : "false");
      labelEl.setAttribute("tabindex", "0");
      labelEl.spellcheck = false;
      labelEl.addEventListener("focus", () => {
        labelEl.dataset.prevText = labelEl.textContent.trim();
        enableInputBlocker();
      });
      labelEl.addEventListener("blur", () => {
        if (isCustom) {
          let t = sanitizeText(labelEl.textContent);
          if (!t) t = "[New Balance Section]";
          labelEl.textContent = t;
          saveState();
        }
        disableInputBlocker();
      });
      labelEl.addEventListener("keydown", (e) => {
        if (handleShortcut(e)) return;
        if (!isCustom) return;
        if (e.key === "Enter") {
          e.preventDefault();
          labelEl.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          labelEl.textContent = labelEl.dataset.prevText || "[New Balance Section]";
          labelEl.blur();
        }
      }, true);
      p.appendChild(labelEl);
      const ul = document.createElement("ul");
      ul.appendChild(createNewLI());
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "uc-collapse-btn";
      collapseBtn.onclick = () => {
        if (overlay.classList.contains("viewer-mode")) return;
        const collapsed = ul.style.display === "none";
        ul.style.display = collapsed ? "" : "none";
        collapseBtn.textContent = collapsed ? "\u2212" : "+";
        saveState();
      };
      p.appendChild(collapseBtn);
      if (isCustom) {
        const delBtn = document.createElement("button");
        delBtn.className = "uc-section-del";
        delBtn.title = "Double-click to delete custom section";
        delBtn.textContent = "\u2212";
        delBtn.onclick = (e) => {
          if (overlay.classList.contains("viewer-mode") || e.detail !== 2) return;
          ul.remove();
          p.remove();
          saveState();
        };
        p.appendChild(delBtn);
      }
      if (beforeNode) {
        container.insertBefore(p, beforeNode);
        container.insertBefore(ul, beforeNode);
      } else {
        container.appendChild(p);
        container.appendChild(ul);
      }
      updateDeleteState(ul);
      ul.style.display = startCollapsed ? "none" : "";
      collapseBtn.textContent = startCollapsed ? "+" : "\u2212";
      if (focusName) setTimeout(() => labelEl.focus(), 0);
      return { p, ul };
    }
    function getSectionPairs() {
      const pairs = [];
      container.querySelectorAll("p.uc-section-header").forEach((p) => {
        const ul = p.nextElementSibling;
        if (ul && ul.tagName === "UL") pairs.push({ p, ul });
      });
      return pairs;
    }
    function moveSection(p, dir) {
      const ul = p.nextElementSibling;
      if (!ul || ul.tagName !== "UL") return;
      const pairs = getSectionPairs();
      const idx = pairs.findIndex((pair) => pair.p === p);
      if (idx < 0 || pairs.length <= 1) return;
      const newIdx = (idx + dir + pairs.length) % pairs.length;
      const target = pairs[newIdx];
      const addSectionRow = container.querySelector(".uc-add-section-row");
      if (dir < 0) {
        if (idx === 0) {
          container.insertBefore(p, addSectionRow || null);
          container.insertBefore(ul, addSectionRow || null);
        } else {
          container.insertBefore(p, target.p);
          container.insertBefore(ul, target.p);
        }
      } else {
        if (idx === pairs.length - 1) {
          container.insertBefore(ul, pairs[0].p);
          container.insertBefore(p, ul);
        } else {
          const after = target.ul.nextElementSibling;
          container.insertBefore(p, after);
          container.insertBefore(ul, after);
        }
      }
      saveState();
    }
    function moveLi(li, dir) {
      const ul = li.parentElement;
      const items = [...ul.children];
      const idx = items.indexOf(li);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= items.length) {
        if (items.length <= 1) return;
        if (dir < 0) ul.appendChild(li);
        else ul.insertBefore(li, items[0]);
      } else if (dir < 0) {
        ul.insertBefore(li, items[newIdx]);
      } else {
        ul.insertBefore(li, items[newIdx].nextSibling);
      }
      saveState();
      const span = li.querySelector(".uc-li-text");
      if (span) setTimeout(() => span.focus(), 0);
    }
    function cycleCategory(li, dir) {
      const idx = cycleOrder.findIndex((c) => li.classList.contains(c));
      const newIdx = ((idx === -1 ? 0 : idx) + dir + cycleOrder.length) % cycleOrder.length;
      li.classList.remove(...cycleOrder);
      li.classList.add(cycleOrder[newIdx]);
      saveState();
    }
    function handleShortcut(e) {
      if (overlay.classList.contains("viewer-mode")) return false;
      if (e.altKey || e.metaKey) return false;
      const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (!dir || !e.ctrlKey && !e.shiftKey) return false;
      const active = document.activeElement;
      if (!active) return false;
      if (active.classList.contains("uc-li-text")) {
        const li = active.closest("li");
        if (!li) return false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.ctrlKey && !e.shiftKey) cycleCategory(li, dir);
        if (e.shiftKey && !e.ctrlKey) moveLi(li, dir);
        return true;
      }
      if (active.classList.contains("uc-section-label") && e.shiftKey && !e.ctrlKey) {
        const p = active.closest("p.uc-section-header");
        if (!p) return false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moveSection(p, dir);
        const label = p.querySelector(".uc-section-label");
        if (label) setTimeout(() => label.focus(), 0);
        return true;
      }
      return false;
    }
    function bindCardHovers() {
      if (!getCardHoversEnabled()) return;
      const cardNameMap = getCardNameMap();
      container.querySelectorAll(".uc-card-ref").forEach((el) => {
        if (el.dataset.ucHoverBound === "true") return;
        const name = el.textContent.trim();
        const cardId = getCardIdByExactGameLookup(name) || resolveCardId(name, cardNameMap);
        if (!cardId) {
          logger.warn("hover", "Card not found for hover", name);
          return;
        }
        attachCardHover(el, cardId);
      });
    }
    function applyFormattingOverlay() {
      container.querySelectorAll("li").forEach((li) => {
        const span = li.querySelector(".uc-li-text");
        if (span) span.innerHTML = formatLine(li.dataset.raw, getWordColors(), getUnderlineTokens());
      });
      bindCardHovers();
    }
    function clearFormattingOverlay() {
      container.querySelectorAll("li").forEach((li) => {
        const span = li.querySelector(".uc-li-text");
        if (span) span.textContent = li.dataset.raw;
      });
    }
    function setEditingEnabled(enabled) {
      const h2 = container.querySelector("h2");
      if (h2) h2.setAttribute("contenteditable", enabled ? "true" : "false");
      container.querySelectorAll(".uc-li-text").forEach((s) => s.setAttribute("contenteditable", enabled ? "true" : "false"));
      container.querySelectorAll('p.uc-section-header[data-custom="true"] .uc-section-label').forEach((l) => l.setAttribute("contenteditable", enabled ? "true" : "false"));
    }
    function collectState() {
      if (!container) return null;
      const state = { title: "", sections: [], newCards: newCards.collectState(container) };
      const h2 = container.querySelector("h2");
      if (h2) state.title = h2.textContent.trim();
      container.querySelectorAll("p.uc-section-header").forEach((p) => {
        const labelEl = p.querySelector(".uc-section-label");
        const ul = p.nextElementSibling;
        if (!ul) return;
        state.sections.push({
          label: labelEl ? labelEl.textContent.trim() : "",
          custom: p.dataset.custom === "true",
          collapsed: ul.style.display === "none",
          items: [...ul.querySelectorAll(":scope > li")].map((li) => ({
            raw: li.dataset.raw || "",
            category: cycleOrder.find((c) => li.classList.contains(c)) || "other"
          }))
        });
      });
      return state;
    }
    function restoreState(saved) {
      const h2 = container.querySelector("h2");
      if (h2 && saved.title) h2.textContent = saved.title;
      newCards.restoreState(container, saved.newCards);
      getSectionPairs().forEach((pair) => {
        pair.ul.remove();
        pair.p.remove();
      });
      const addSectionRow = container.querySelector(".uc-add-section-row");
      saved.sections.forEach((sec) => {
        const { p, ul } = appendSection(sec.label, !!sec.custom, false, addSectionRow);
        const btn = p.querySelector(".uc-collapse-btn");
        ul.style.display = sec.collapsed ? "none" : "";
        if (btn) btn.textContent = sec.collapsed ? "+" : "\u2212";
        ul.innerHTML = "";
        (sec.items || [{ raw: "[New entry]", category: "other" }]).forEach((item) => {
          const li = createNewLI();
          li.dataset.raw = item.raw;
          li.classList.remove(...cycleOrder);
          li.classList.add(item.category || "other");
          li.querySelector(".uc-li-text").textContent = item.raw;
          ul.appendChild(li);
        });
        updateDeleteState(ul);
      });
    }
    function setControlsHidden(hidden) {
      controlButtons.forEach((btn) => {
        if (!btn) return;
        btn.style.visibility = hidden ? "hidden" : "visible";
        btn.style.pointerEvents = hidden ? "none" : "auto";
      });
    }
    function init(mainEl) {
      if (document.getElementById("uc-patch-overlay")) {
        logger.warn("init", "Overlay already exists; aborting duplicate init.");
        return;
      }
      injectPatchMakerStyle();
      const navbars = mainEl.querySelectorAll(".navbar.navbar-default");
      const headerNav = navbars[0];
      if (!headerNav) {
        logger.error("init", "Could not find header navbar.");
        return;
      }
      const footer = mainEl.querySelector("footer");
      originalPatchNotesNodes = [];
      let ptr = headerNav.nextElementSibling;
      while (ptr && ptr !== footer) {
        originalPatchNotesNodes.push(ptr);
        ptr = ptr.nextElementSibling;
      }
      let h3 = null, hr1 = null, h2 = null, hr2 = null;
      for (const el of originalPatchNotesNodes) {
        if (!h3 && el.tagName === "H3") {
          h3 = el.cloneNode(true);
          continue;
        }
        if (!hr1 && el.tagName === "HR") {
          hr1 = el.cloneNode(true);
          continue;
        }
        if (!h2 && el.tagName === "H2") {
          h2 = el.cloneNode(true);
          continue;
        }
        if (!hr2 && el.tagName === "HR") {
          hr2 = el.cloneNode(true);
          continue;
        }
      }
      const endBRs = [];
      for (let i = originalPatchNotesNodes.length - 1; i >= 0; i--) {
        if (originalPatchNotesNodes[i].tagName === "BR") endBRs.push(originalPatchNotesNodes[i].cloneNode(true));
        else break;
      }
      endBRs.reverse();
      overlay = document.createElement("div");
      overlay.id = "uc-patch-overlay";
      overlay.style.display = "none";
      overlay.classList.add("editor-mode");
      container = document.createElement("div");
      if (h3) container.appendChild(h3);
      if (hr1) container.appendChild(hr1);
      const titleEl = h2 || document.createElement("h2");
      if (!h2) titleEl.textContent = "[Untitled Patch]";
      makeEditable(titleEl, "[Untitled Patch]");
      container.appendChild(titleEl);
      if (hr2) container.appendChild(hr2);
      const newCardsSec = newCards.createSection(container);
      newCardsSec.section.style.display = "none";
      const newCardsBtn = newCardsSec.p.querySelector(".uc-collapse-btn");
      if (newCardsBtn) newCardsBtn.textContent = "+";
      DEFAULT_SECTIONS.forEach((label) => {
        appendSection(label, false, false, null, !DEFAULT_OPEN_SECTIONS.has(label));
      });
      const addSectionRow = document.createElement("div");
      addSectionRow.className = "uc-add-section-row";
      const addSectionBtn = document.createElement("button");
      addSectionBtn.className = "uc-add-section-btn";
      addSectionBtn.textContent = "+";
      addSectionBtn.onclick = () => {
        if (overlay.classList.contains("viewer-mode")) return;
        appendSection("[New Balance Section]", true, true, addSectionRow);
        saveState();
      };
      addSectionRow.appendChild(addSectionBtn);
      container.appendChild(addSectionRow);
      endBRs.forEach((br) => container.appendChild(br));
      overlay.appendChild(container);
      headerNav.insertAdjacentElement("afterend", overlay);
      buildControlButtons();
      loadState();
      logger.log("init", "Overlay initialized.");
      if (getOpenOnLoad()) {
        setTimeout(() => {
          if (!custom) toggle.click();
        }, 0);
      }
    }
    function buildControlButtons() {
      toggle = document.createElement("button");
      toggle.textContent = "Show Custom Patch Notes";
      modeToggle = document.createElement("button");
      modeToggle.textContent = "Switch to Viewer Mode";
      resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset Data";
      helpBtn = document.createElement("button");
      helpBtn.textContent = "Help";
      Object.assign(toggle.style, {
        position: "fixed",
        left: "10px",
        bottom: "10px",
        padding: "8px 12px",
        background: "#333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999"
      });
      Object.assign(modeToggle.style, {
        position: "fixed",
        left: "10px",
        bottom: "50px",
        padding: "8px 12px",
        background: "#333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
      });
      Object.assign(resetBtn.style, {
        position: "fixed",
        left: "10px",
        bottom: "90px",
        padding: "8px 12px",
        background: "#aa3333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
      });
      Object.assign(helpBtn.style, {
        position: "fixed",
        left: "130px",
        bottom: "90px",
        padding: "8px 12px",
        background: "#3366cc",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
      });
      [toggle, modeToggle, resetBtn, helpBtn].forEach((b) => document.body.appendChild(b));
      controlButtons = [toggle, modeToggle, resetBtn, helpBtn];
      setControlsHidden(getHideControlsEnabled());
      toggle.onclick = () => {
        custom = !custom;
        overlay.style.display = custom ? "" : "none";
        originalPatchNotesNodes.forEach((n) => n.style.display = custom ? "none" : "");
        toggle.textContent = custom ? "Show Original Patch Notes" : "Show Custom Patch Notes";
        [modeToggle, resetBtn, helpBtn].forEach((b) => b.style.display = custom ? "inline-block" : "none");
        if (!custom && isViewerMode2) {
          isViewerMode2 = false;
          overlay.classList.remove("viewer-mode");
          overlay.classList.add("editor-mode");
          modeToggle.textContent = "Switch to Viewer Mode";
          clearFormattingOverlay();
          setEditingEnabled(true);
        }
      };
      modeToggle.onclick = () => {
        if (!custom) return;
        isViewerMode2 = !isViewerMode2;
        overlay.classList.toggle("viewer-mode", isViewerMode2);
        overlay.classList.toggle("editor-mode", !isViewerMode2);
        modeToggle.textContent = isViewerMode2 ? "Switch to Editor Mode" : "Switch to Viewer Mode";
        if (isViewerMode2) {
          container.querySelectorAll("p").forEach((p) => {
            const sibling = p.nextElementSibling;
            if (sibling && sibling.style.display === "none") p.style.display = "none";
          });
          applyFormattingOverlay();
          setEditingEnabled(false);
          logger.log("mode", "Switched to viewer mode.");
        } else {
          container.querySelectorAll("p").forEach((p) => {
            p.style.display = "";
          });
          clearFormattingOverlay();
          setEditingEnabled(true);
          logger.log("mode", "Switched to editor mode.");
        }
      };
      resetBtn.onclick = (e) => {
        if (custom && e.detail === 2) {
          resetState();
          location.reload();
        }
      };
      helpBtn.onclick = () => {
        const message = buildHelpMessage(version);
        const pageWindow = getPageWindow();
        const BootstrapDialogRef = pageWindow.BootstrapDialog;
        if (BootstrapDialogRef && typeof BootstrapDialogRef.alert === "function") {
          BootstrapDialogRef.alert({ title: "Custom Patch Maker \u2013 Help", message, closable: true });
        } else {
          alert(message.replace(/<[^>]+>/g, ""));
        }
      };
    }
    return { init, setControlsHidden };
  }

  // packages/patch-maker/index.js
  var FEATURE_VERSION = "0.1.0";
  function waitForMainContent(callback) {
    const existing = document.querySelector(".mainContent");
    if (existing) return callback(existing);
    setTimeout(() => waitForMainContent(callback), 50);
  }
  function isPatchNotesPage() {
    return location.pathname.toLowerCase().includes("gameupdates");
  }
  function initPatchMaker(plugin) {
    const settings = registerPatchMakerSettings(plugin);
    if (!settings.enabled.value()) return;
    if (!isPatchNotesPage()) return;
    const logger = createLogger("PatchMaker");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings.debugLogging.value()) originalWarn(...args);
    };
    let wordColors = { ...BASE_WORD_COLORS };
    let underlineTokens = [];
    let cardNameMap = /* @__PURE__ */ new Map();
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
    settings.hideControls.on((value) => overlay.setControlsHidden(value));
    async function refreshLocalizedData() {
      const languageLabel = settings.language.value();
      const { tokens, localizedColors } = await buildLocalizedFormattingData(languageLabel, BASE_WORD_COLORS);
      underlineTokens = tokens;
      wordColors = { ...BASE_WORD_COLORS, ...localizedColors };
      cardNameMap = await buildLocalizedCardNameMap(languageLabel);
    }
    waitForMainContent((mainEl) => {
      overlay.init(mainEl);
      refreshLocalizedData().catch((e) => logger.error("init", "Failed to load localized data", e));
    });
  }

  // manifest.js
  bootstrap((plugin) => {
    initPatchMaker(plugin);
  });
})();
