// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      1.1.04
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
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(() => {
  // packages/core/page-window.js
  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  }

  // packages/core/bootstrap.js
  var SUITE_NAME = "Wizascript";
  var SUITE_VERSION = "1.1.04";
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

  // packages/true-hub-bridge/settings.js
  function registerTrueHubBridgeSettings(plugin) {
    const settings = createFeatureSettings(plugin, "truehubbridge", "True Hub Bridge");
    return {
      settings,
      // Master toggle - lets the whole feature be turned off from within
      // Wizascript's settings, per the "one plugin, categories as boxes"
      // model the rest of the suite follows.
      enabled: settings.add("enabled", {
        name: "Enable True Hub Bridge",
        type: "boolean",
        default: true
      }),
      // The original script had no debug-logging toggle at all (just
      // always-on console.log calls) - added here for consistency with
      // patch-maker, using the same working per-feature debug logger.
      debugLogging: settings.add("debugLogging", {
        name: "Enable debug logging",
        type: "boolean",
        default: false
      }),
      autoOpen: settings.add("autoOpenTrueHub", {
        name: "Auto Open True Hub",
        type: "boolean",
        default: true
      }),
      scrollPaging: settings.add("enableScrollPaging", {
        name: "Enable Scroll Paging",
        type: "boolean",
        default: true
      })
    };
  }

  // packages/true-hub-bridge/channel-overrides.js
  var CHANNEL_OVERRIDES = {
    // Totem
    "Totem": "Totem",
    // Powerhouse
    "phouse": "Powerhouse",
    "powerhouse": "Powerhouse",
    "ph": "Powerhouse",
    // Soulless Kris
    "skris": "Soulless_Kris",
    // Overgrowth
    "og": "Overgrowth",
    "overgrowth": "Overgrowth",
    // Traffic Lights
    "light": "Traffic_Light",
    "lights": "Traffic_Light",
    // Ball Dancer
    "balldancer": "Ball_Dancer",
    // Royal Papyrus
    "rpaps": "Royal_Papyrus",
    "royal-paps": "Royal_Papyrus",
    "royal-p": "Royal_Papyrus",
    // Tsunderplane
    "plane": "Tsunderplane",
    "tsunder": "Tsunderplane",
    // Lab Sign
    "lab-sign": "Lab_Sign",
    // Great Door
    "door": "Great_Door",
    // Librarian
    "librarian": "Librarian",
    "lib": "Librarian",
    // Mad Dragon
    "obama": "Mad_Dragon",
    // Ponman Statue
    "pieces": "Ponman_Statue",
    // Mercenary Hire
    "merc-hire": "Mercenary_Hire",
    "merchire": "Mercenary_Hire",
    // Kris
    "kris": "Kris",
    // Caged Jester
    "cjester": "Caged_Jester",
    "cj": "Caged_Jester",
    "caged-jester": "Caged_Jester",
    "jester": "Caged_Jester",
    "jailed-clown": "Caged_Jester",
    // Maus Cage
    "mauscage": "Maus_Cage",
    "maus-cage": "Maus_Cage",
    "cage": "Maus_Cage",
    // Maus
    "maus": "Maus",
    "rat": "Maus",
    "maice": "Maus",
    // Politician Bear
    "pol-bear": "Politician_Bear",
    "politician-bear": "Politician_Bear",
    // Teacher Alphys
    "talph": "Teacher_Alphys",
    "talphys": "Teacher_Alphys",
    "talphy": "Teacher_Alphys",
    // Giga Queen
    "gq": "GIGA_Queen",
    "giga-queen": "GIGA_Queen",
    "giga": "GIGA_Queen",
    // Forest Worm
    "forest-worm": "Forest_Worm",
    "fworm": "Forest_Worm",
    // Large Chest
    "large-chest": "Large_Chest",
    // Big Bomb
    "big-bomb": "Big_Bomb",
    // Instant Noodles
    "instant-noodles": "Instant_Noodles",
    "noodle": "Instant_Noodles",
    "noodles": "Instant_Noodles",
    // Green Flower
    "green-flower": "Green_Flower",
    "g-flower": "Green_Flower",
    // So Sorry
    "so-sorry": "So_Sorry",
    "sorry": "So_Sorry",
    // Ultimathrash
    "ultimathrash": "Ultimathrash",
    "ultima-thrash": "Ultimathrash",
    "ultima": "Ultimathrash",
    // Thrashing Machine
    "collection": "Thrashing_M",
    "t-machine": "Thrashing_M",
    "thrashing": "Thrashing_M",
    // Clover
    "clover": "Clover",
    // Ball Person
    "ball": "Ball_Person",
    // Ambyu-Lance
    "maso": "Ambyu-Lance",
    // Gemstone
    "gems": "Gemstone",
    "gem": "Gemstone",
    // Fortune Teller
    "fortune-teller": "Fortune_Teller",
    "fteller": "Fortune_Teller",
    "f-teller": "Fortune_Teller",
    // Pile of Dust
    "pile-of-dust": "Pile_of_Dust",
    "pod": "Pile_of_Dust",
    // Migospel
    "migospel": "Migospel",
    // Nice Cream Guy
    "nice-cream-guy": "Nice_Cream_Guy",
    "ncg": "Nice_Cream_Guy",
    // Omega Flowey
    "omega-flowey": "Omega_Flowey",
    "of": "Omega_Flowey",
    // Cyberdly
    "cyberdly": "Cyberdly",
    // Berdly Statue
    "berdly-statue": "Berdly_Statue",
    "statue": "Berdly_Statue",
    // Zenith Martlet
    "zenith-martlet": "Zenith_Martlet",
    "zenith": "Zenith_Martlet",
    "zmart": "Zenith_Martlet",
    "zartlet": "Zenith_Martlet",
    // Chujin Tombstone
    "chujin-tombstone": "Chujin_Tombstone",
    "chutomb": "Chujin_Tombstone",
    "chtomb": "Chujin_Tombstone",
    // Top Chef
    "top-chef": "Top_Chef",
    // Clam Girl
    "clam-girl": "Clam_Girl",
    "clamgirl": "Clam_Girl",
    // C-Round
    "c-round": "C-Round",
    // Bookshelf
    "bookshelf": "Bookshelf",
    "shelf": "Bookshelf",
    // Giga Froggit
    "giga-froggit": "Giga_Froggit",
    // Snoring Monsters
    "snoring-monster": "Snoring_Monsters",
    "snoring": "Snoring_Monsters",
    // The Original
    "first-starwalker": "The_Original",
    "f-walker": "The_Original",
    "fwalker": "The_Original",
    "fwakler": "The_Original",
    // Knight's Shield
    "knight's-shield": "Knights_Shield",
    "knights-shield": "Knights_Shield",
    // Bounty
    "bounty": "Bounty",
    // Temmie Egg
    "temmie-egg": "Temmie_Egg",
    "egg": "Temmie_Egg",
    // Sandstorm
    "sandstorm": "Sandstorm",
    // Oasis
    "oasis": "Oasis",
    // Feast
    "feast": "Feast",
    // Frostermit
    "frostermit": "Frostermit",
    // Hyperlinks
    "hlb": "Hyperlink_Blocked",
    "hyperlink": "Hyperlink_Blocked",
    // Spider
    "spider": "Spider",
    // Red Flower
    "seedlings": "Red_Flower",
    "seedling": "Red_Flower",
    // Casual Undyne
    "casual-undyne": "Casual_Undyne",
    "casdyne": "Casual_Undyne",
    // Mines
    "mines": "Mine",
    "mine": "Mine",
    // Coffin
    "coffin": "Coffin",
    // Berdly
    "berdly": "Berdly",
    // Contamination
    "contamination": "Contamination",
    "contam": "Contamination",
    // Shambling Mass
    "shambling-mass": "Shambling_Mass",
    "shambles": "Shambling_Mass",
    "shamble": "Shambling_Mass",
    // Moldsmal
    "moldsmal": "Moldsmal",
    "mold": "Moldsmal",
    // Cyber Trash
    "cyber-trash": "Cyber_Trash",
    "ctrash": "Cyber_Trash",
    "trash": "Cyber_Trash",
    // Bryan
    "bryan": "Bryan",
    // Gift
    "gift": "Gift",
    // Cactus
    "cactus": "Cactus",
    // Abstract Art
    "abstract-art": "Abstract_Art",
    "abs-art": "Abstract_Art",
    "absart": "Abstract_Art",
    // Seam
    "seam": "Seam",
    // Pipis
    "pipis": "Pipis",
    // Assault
    "assault": "Assault",
    // Angie
    "angie": "Angie",
    // Werewerewire
    "werewerewire": "Werewerewire",
    "plug": "Werewerewire",
    // Gerson Tombstone
    "gerson-tombstone": "Gerson_Tombstone",
    "gertomb": "Gerson_Tombstone",
    // Ceroba Ketsukane
    "ceroba-ketsukane": "Ceroba_Ketsukane",
    "ketsukane": "Ceroba_Ketsukane",
    "ketsu": "Ceroba_Ketsukane",
    // Tasque Singer
    "tasque-singer": "Tasque_Singer",
    "singer": "Tasque_Singer",
    // Cyber Balloon
    "cyber-balloon": "Cyber_Balloon",
    "balloon": "Cyber_Balloon",
    // Burning Snail
    "burning-snail": "Burning_Snail",
    "snail": "Burning_Snail",
    // Tnt Man
    "tnt-man": "TNT_Man",
    "tnt": "TNT_Man",
    // Gardener Asgore
    "gardener-asgore": "Gardener_Asgore",
    "gardengore": "Gardener_Asgore",
    "garden": "Gardener_Asgore",
    // Jigsawry
    "jigsawry": "Jigsawry",
    "jig": "Jigsawry",
    // Pillar
    "pillar": "Pillar",
    // Library Loox
    "library-loox": "Library_Loox",
    "lib-loox": "Library_Loox",
    "libloox": "Library_Loox",
    // Overlord Migosp
    "overlord-migosp": "Overlord_Migosp",
    "overlord": "Overlord_Migosp",
    // Angel of Death
    "angel-of-death": "Angel_of_Death",
    "aod": "Angel_of_Death",
    // Shield
    "soliditdy": "Shield",
    // The Barrier
    "barrier": "The_Barrier",
    // Undyne
    "undyne": "Undyne",
    // Eye
    "Amalgamate": "Eye",
    // Devil Doll
    "devil-doll": "Devil_Doll",
    // Icemeter
    "icemeter": "Icemeter",
    // Dalv's Wardrobe
    "dalvs-wardrobe": "Dalvs_Wardrobe",
    "wardrobe": "Dalvs_Wardrobe",
    // Defrosting
    "defrosting": "Defrosting",
    // Memory Keeper
    "memory-keeper": "Memory_Keeper",
    "meme-keeper": "Memory_Keeper",
    "keeper": "Memory_Keeper",
    // Ribbick
    "ribbick": "Ribbick",
    // Rockstar Kris
    "rockstar-kris": "Rockstar_Kris",
    // Mo
    "mo": "Mo",
    // Gacha Ball
    "gachapon": "Gacha_Ball",
    // Arcade Machine
    "arcade-machine": "Arcade_Machine",
    "arc-mac": "Arcade_Machine",
    "arcmac": "Arcade_Machine",
    // White Cloak
    "white-cloak": "White_Cloak",
    "cloak": "White_Cloak",
    // Whimsalot
    "whimsalot": "Whimsalot",
    "whimsa": "Whimsalot",
    // Rockstar Ralsei
    "rockstar-ralsei": "Rockstar_Ralsei",
    // Royal Loox
    "royal-loox": "Royal_Loox",
    "rloox": "Royal_Loox",
    // Hanging Spider
    "hanging-spider": "Hanging_Spider",
    "hang": "Hanging_Spider",
    // Titan Fuzzy
    "titan-fuzzy": "Titan_Fuzzy",
    "fuzzy": "Titan_Fuzzy",
    // Titan
    "titan": "Titan",
    // Shrine Mascot
    "shrine-mascot": "Deflated_Mascot",
    "mascot": "Deflated_Mascot",
    // Pumpkin Head
    "jackenstein": "Pumpkin_Head",
    "dark-zone": "Pumpkin_Head",
    "darkzone": "Pumpkin_Head",
    // Food Enjoyer
    "food-enjoyer": "Food_Enjoyer",
    // Wicabel
    "wicabel": "Wicabel",
    "wica": "Wicabel",
    // Gaster Blaster
    "gaster-blaster": "Gaster_Blaster",
    "science": "Gaster_Blaster",
    // Fire Chimney
    "fire-chimney": "Fire_Chimney",
    "chimney": "Fire_Chimney"
  };
  var ORDERED_CHANNEL_OVERRIDES = Object.entries(CHANNEL_OVERRIDES).sort(([a], [b]) => b.length - a.length);

  // packages/true-hub-bridge/deck-filter.js
  function decodeDeck(deckCode) {
    try {
      return JSON.parse(atob(deckCode));
    } catch {
      return null;
    }
  }
  function getCardById(id) {
    const getCard = getPageWindow().getCard;
    if (typeof getCard !== "function") return null;
    try {
      return getCard(id);
    } catch {
      return null;
    }
  }
  function getArtifactById(id) {
    const getArtifact = getPageWindow().getArtifact;
    if (typeof getArtifact !== "function") return null;
    try {
      return getArtifact(id);
    } catch {
      return null;
    }
  }
  function getPlayableCards() {
    return getAllCards().filter((c) => c.rarity !== "STORY" && c.rarity !== "TOKEN");
  }
  function determineImageFromDeck(deckCode) {
    const decoded = decodeDeck(deckCode);
    if (!decoded || !decoded.cardIds) return null;
    const counts = /* @__PURE__ */ new Map();
    decoded.cardIds.forEach((cardId) => {
      const card = getCardById(cardId);
      if (!card || card.typeCard !== 0) return;
      counts.set(cardId, (counts.get(cardId) || 0) + 1);
    });
    let winner = null;
    let highestCount = 0;
    decoded.cardIds.forEach((cardId) => {
      const card = getCardById(cardId);
      if (!card || card.typeCard !== 0) return;
      const count = counts.get(cardId);
      if (count >= highestCount) {
        highestCount = count;
        winner = card;
      }
    });
    return (winner == null ? void 0 : winner.image) || null;
  }
  function isCardInList(list, id) {
    return list.some((c) => c.id === id);
  }
  function removeCardFromList(list, id) {
    const idx = list.findIndex((c) => c.id === id);
    if (idx !== -1) list.splice(idx, 1);
  }
  function addCardToFilter(targetList, otherList, card) {
    if (isCardInList(targetList, card.id)) return;
    removeCardFromList(otherList, card.id);
    targetList.push({ id: card.id, name: card.name });
  }
  function removeCardFromFilter(list, id) {
    removeCardFromList(list, id);
  }
  function filterDecks(allDecks, { activeSoulFilter, activeSearch = "", includeCards = [], excludeCards = [] } = {}) {
    const term = activeSearch.trim().toLowerCase();
    return allDecks.filter((deck) => {
      if (activeSoulFilter) {
        const decoded = decodeDeck(deck.deckCode);
        if (!decoded) return false;
        const soul = decoded.soul || decoded.classe;
        if (soul !== activeSoulFilter) return false;
      }
      if (term) {
        const name = (deck.channel || "").toLowerCase().replace(/-/g, " ");
        const author = (deck.author || "").toLowerCase();
        const season = (deck.season || "").toLowerCase();
        if (!name.includes(term) && !author.includes(term) && !season.includes(term)) {
          return false;
        }
      }
      if (includeCards.length > 0 || excludeCards.length > 0) {
        const decoded = decodeDeck(deck.deckCode);
        if (!decoded || !Array.isArray(decoded.cardIds)) return false;
        const idSet = new Set(decoded.cardIds);
        for (const c of includeCards) {
          if (!idSet.has(c.id)) return false;
        }
        for (const c of excludeCards) {
          if (idSet.has(c.id)) return false;
        }
      }
      return true;
    });
  }

  // packages/true-hub-bridge/overlay.js
  var DECKS_PER_PAGE = 10;
  var SOUL_COLORS = {
    DETERMINATION: "red",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00"
  };
  function createTrueHubOverlay({ logger, getAutoOpen, getScrollPaging }) {
    let allDecks = [];
    let filteredDecks = [];
    let currentPage = 1;
    let mode = "classic";
    let includeCards = [];
    let excludeCards = [];
    let originalDecks = null;
    let template = null;
    let trueHubWrapper = null;
    let trueHubList = null;
    let trueHubNavEl = null;
    let selectPage = null, currentPageEl = null, maxPageEl = null, btnPrevious = null, btnNext = null;
    let ucNavRow = null;
    let classicState = null;
    let activeSoulFilter = null;
    let activeSearch = "";
    let cardFilterPanel = null, cardSearchInput = null, cardDropdown = null, cardTagsContainer = null;
    function setDecks(decks) {
      allDecks = Array.isArray(decks) ? decks : [];
      allDecks.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      filteredDecks = [...allDecks];
      logger.log("data", "Decks loaded.", { count: allDecks.length });
    }
    function applyFilters() {
      filteredDecks = filterDecks(allDecks, { activeSoulFilter, activeSearch, includeCards, excludeCards });
      currentPage = 1;
      renderPage();
    }
    function waitForHub(cb) {
      const check = () => {
        const hub = document.getElementById("hubDecks");
        const tmpl = hub == null ? void 0 : hub.querySelector(".hubDeck");
        if (hub && tmpl) cb(hub, tmpl);
        else setTimeout(check, 200);
      };
      check();
    }
    function buildCard(deck) {
      var _a, _b, _c, _d;
      const clone = template.cloneNode(true);
      const nameEl = clone.querySelector(".hubDeckName div");
      if (nameEl) {
        const decoded = decodeDeck(deck.deckCode);
        nameEl.textContent = (deck.channel || "Unknown").replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        if ((decoded == null ? void 0 : decoded.soul) && SOUL_COLORS[decoded.soul]) {
          nameEl.style.color = SOUL_COLORS[decoded.soul];
        }
      }
      const ownerEl = clone.querySelector(".hubDeckOwner");
      if (ownerEl) {
        const img = ownerEl.querySelector("img");
        if (img) img.remove();
        ownerEl.textContent = deck.author || "Unknown";
        ownerEl.style.textAlign = "center";
      }
      const imageEl = clone.querySelector(".hubDeckImage img");
      if (imageEl) {
        const channel = (deck.channel || "").toLowerCase();
        let imageName = null;
        for (const [term, card] of ORDERED_CHANNEL_OVERRIDES) {
          if (channel.includes(term.toLowerCase())) {
            imageName = card;
            break;
          }
        }
        if (!imageName) imageName = determineImageFromDeck(deck.deckCode);
        if (imageName) imageEl.src = `images/cards/${imageName}.png`;
      }
      const artifactContainer = clone.querySelector(".hubDeckArtifacts");
      if (artifactContainer) {
        artifactContainer.innerHTML = "";
        try {
          const decoded = decodeDeck(deck.deckCode);
          const artifacts = ((decoded == null ? void 0 : decoded.artifactIds) || []).map((id) => getArtifactById(id)).filter(Boolean);
          artifacts.forEach((artifact, index) => {
            const img = document.createElement("img");
            img.src = `images/artifacts/${artifact.image}.png`;
            img.title = artifact.name;
            artifactContainer.appendChild(img);
            if (index < artifacts.length - 1) artifactContainer.append(" ");
          });
        } catch (err) {
          logger.error("card", "Artifact decode failed", err, deck);
        }
      }
      const archetypeEl = clone.querySelector(".hubDeckArchetype div");
      if (archetypeEl) archetypeEl.textContent = deck.season || "s??";
      const likesEl = clone.querySelector(".hubDeckLikes");
      if (likesEl) {
        const wins = (_b = (_a = deck.record) == null ? void 0 : _a.wins) != null ? _b : "-";
        likesEl.innerHTML = `<span style="color:#0dd000">${wins}</span>`;
      }
      const starEl = clone.querySelector(".hubDeckStar");
      if (starEl) {
        const losses = (_d = (_c = deck.record) == null ? void 0 : _c.losses) != null ? _d : "-";
        starEl.innerHTML = `<span style="color:#f0003c">${losses}</span>`;
      }
      const diffEl = clone.querySelector(".hubDeckDifficulty");
      if (diffEl) {
        diffEl.innerHTML = "";
        const btn = document.createElement("button");
        btn.textContent = "Info";
        Object.assign(btn.style, {
          background: "#7a0000",
          border: "1px solid #f0003c",
          color: "white",
          padding: "3px 8px",
          cursor: "pointer",
          opacity: "0.85"
        });
        btn.onclick = (e) => {
          e.stopPropagation();
          showInfo(deck);
        };
        diffEl.appendChild(btn);
      }
      const previewButton = clone.querySelector(".show-button");
      if (previewButton) {
        previewButton.removeAttribute("onclick");
        previewButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const code = deck.deckCode;
          const published = deck.publishedAt || (/* @__PURE__ */ new Date()).toISOString();
          const script = document.createElement("script");
          script.textContent = `
          try {
            if (typeof showDeckLoadHub === "function") {
              showDeckLoadHub(${JSON.stringify(code)}, ${JSON.stringify(published)});
            } else {
              console.error("[TrueHub] showDeckLoadHub unavailable.");
            }
          } catch (err) {
            console.error("[TrueHub] Preview failed:", err);
          }
        `;
          document.documentElement.appendChild(script);
          script.remove();
        };
      }
      return clone;
    }
    function renderPage() {
      trueHubList.innerHTML = "";
      const start = (currentPage - 1) * DECKS_PER_PAGE;
      const visible = filteredDecks.slice(start, start + DECKS_PER_PAGE);
      visible.forEach((deck) => trueHubList.appendChild(buildCard(deck)));
      syncNav();
    }
    function buildCardFilterPanel() {
      cardFilterPanel = document.createElement("div");
      cardFilterPanel.id = "th-card-filter-panel";
      Object.assign(cardFilterPanel.style, {
        display: "none",
        width: "100%",
        boxSizing: "border-box",
        margin: "0 0 6px 0",
        padding: "10px 12px",
        background: "#1a1a1a",
        border: "1px solid #444",
        borderRadius: "4px"
      });
      const searchRow = document.createElement("div");
      Object.assign(searchRow.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" });
      cardSearchInput = document.createElement("input");
      cardSearchInput.type = "text";
      cardSearchInput.placeholder = "Search cards to filter...";
      cardSearchInput.className = "form-control";
      Object.assign(cardSearchInput.style, { width: "100%", boxSizing: "border-box", fontSize: "13px" });
      searchRow.appendChild(cardSearchInput);
      cardFilterPanel.appendChild(searchRow);
      cardDropdown = document.createElement("div");
      cardDropdown.id = "th-card-dropdown";
      Object.assign(cardDropdown.style, {
        background: "#222",
        border: "1px solid #555",
        borderRadius: "4px",
        maxHeight: "150px",
        overflowY: "auto",
        marginBottom: "8px",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0"
      });
      cardDropdown.style.display = "none";
      cardFilterPanel.appendChild(cardDropdown);
      cardTagsContainer = document.createElement("div");
      cardTagsContainer.id = "th-card-tags";
      Object.assign(cardTagsContainer.style, { display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" });
      cardFilterPanel.appendChild(cardTagsContainer);
      cardSearchInput.addEventListener("input", () => {
        const term = cardSearchInput.value.trim().toLowerCase();
        if (!term) {
          cardDropdown.style.display = "none";
          cardDropdown.innerHTML = "";
          return;
        }
        const playable = getPlayableCards();
        const matches = playable.filter((c) => c.name && c.name.toLowerCase().includes(term)).slice(0, 30);
        cardDropdown.innerHTML = "";
        if (matches.length === 0) {
          cardDropdown.style.display = "none";
          return;
        }
        cardDropdown.style.display = "grid";
        matches.forEach((card) => {
          const row = document.createElement("div");
          Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            color: "#eee",
            borderBottom: "1px solid #2a2a2a",
            borderRight: "1px solid #2a2a2a",
            overflow: "hidden"
          });
          const inInclude = isCardInList(includeCards, card.id);
          const inExclude = isCardInList(excludeCards, card.id);
          const nameSpan = document.createElement("span");
          nameSpan.textContent = card.name;
          Object.assign(nameSpan.style, {
            flex: "1",
            minWidth: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: inInclude ? "#4ade80" : inExclude ? "#f87171" : "#eee"
          });
          const btnGroup = document.createElement("div");
          Object.assign(btnGroup.style, { display: "flex", gap: "4px", flexShrink: "0" });
          const btnInclude = document.createElement("button");
          btnInclude.textContent = "+ Inc";
          Object.assign(btnInclude.style, {
            background: "#14532d",
            border: "1px solid #4ade80",
            color: "#4ade80",
            padding: "1px 5px",
            cursor: "pointer",
            fontSize: "10px",
            borderRadius: "3px",
            whiteSpace: "nowrap"
          });
          btnInclude.onclick = (e) => {
            e.stopPropagation();
            addCardToFilter(includeCards, excludeCards, card);
            applyFilters();
            renderCardFilterTags();
            cardSearchInput.value = "";
            cardDropdown.style.display = "none";
            cardDropdown.innerHTML = "";
          };
          const btnExclude = document.createElement("button");
          btnExclude.textContent = "\u2212 Exc";
          Object.assign(btnExclude.style, {
            background: "#450a0a",
            border: "1px solid #f87171",
            color: "#f87171",
            padding: "1px 5px",
            cursor: "pointer",
            fontSize: "10px",
            borderRadius: "3px",
            whiteSpace: "nowrap"
          });
          btnExclude.onclick = (e) => {
            e.stopPropagation();
            addCardToFilter(excludeCards, includeCards, card);
            applyFilters();
            renderCardFilterTags();
            cardSearchInput.value = "";
            cardDropdown.style.display = "none";
            cardDropdown.innerHTML = "";
          };
          btnGroup.appendChild(btnInclude);
          btnGroup.appendChild(btnExclude);
          row.appendChild(nameSpan);
          row.appendChild(btnGroup);
          cardDropdown.appendChild(row);
        });
      });
      document.addEventListener("click", (e) => {
        if (!cardFilterPanel.contains(e.target)) cardDropdown.style.display = "none";
      });
      return cardFilterPanel;
    }
    function renderCardFilterTags() {
      if (!cardTagsContainer) return;
      cardTagsContainer.innerHTML = "";
      const makeTag = (card, color, borderColor, list) => {
        const tag = document.createElement("span");
        Object.assign(tag.style, {
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "2px 8px",
          background: color,
          border: `1px solid ${borderColor}`,
          borderRadius: "3px",
          fontSize: "12px",
          color: "#fff",
          whiteSpace: "nowrap"
        });
        tag.textContent = card.name;
        const x = document.createElement("span");
        x.textContent = "\xD7";
        Object.assign(x.style, { cursor: "pointer", fontWeight: "bold", marginLeft: "2px", lineHeight: "1" });
        x.onclick = () => {
          removeCardFromFilter(list, card.id);
          applyFilters();
          renderCardFilterTags();
        };
        tag.appendChild(x);
        return tag;
      };
      includeCards.forEach((c) => cardTagsContainer.appendChild(makeTag(c, "#14532d", "#4ade80", includeCards)));
      excludeCards.forEach((c) => cardTagsContainer.appendChild(makeTag(c, "#450a0a", "#f87171", excludeCards)));
      if (includeCards.length === 0 && excludeCards.length === 0) {
        const hint = document.createElement("span");
        hint.textContent = "No card filters active.";
        hint.style.cssText = "font-size:12px; color:#777; font-style:italic;";
        cardTagsContainer.appendChild(hint);
      }
    }
    function buildTrueHubNav() {
      ucNavRow = (btnPrevious == null ? void 0 : btnPrevious.closest("tr, nav, .row, thead")) || (btnPrevious == null ? void 0 : btnPrevious.parentElement);
      const nav = document.createElement("div");
      nav.id = "truehub-nav";
      Object.assign(nav.style, { display: "none", margin: "8px 0", fontFamily: "inherit", boxSizing: "border-box", width: "100%" });
      const toolbar = document.createElement("div");
      toolbar.id = "th-toolbar";
      Object.assign(toolbar.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        boxSizing: "border-box",
        padding: "0",
        margin: "0 0 6px 0"
      });
      const leftControls = document.createElement("div");
      Object.assign(leftControls.style, { display: "flex", alignItems: "center", gap: "10px" });
      const searchBox = document.createElement("input");
      searchBox.id = "th-search";
      searchBox.type = "text";
      searchBox.placeholder = "Search decks...";
      searchBox.className = "form-control";
      Object.assign(searchBox.style, { width: "180px", padding: "4px 8px" });
      leftControls.appendChild(searchBox);
      const originalSoulSelect = document.getElementById("selectSouls");
      if (originalSoulSelect) {
        let updateSoulClass = function() {
          Object.keys(SOUL_COLORS).forEach((soul) => soulSelect.classList.remove(soul));
          if (soulSelect.value) soulSelect.classList.add(soulSelect.value);
        };
        const soulSelect = originalSoulSelect.cloneNode(true);
        soulSelect.id = "th-select-souls";
        const noneOption = soulSelect.querySelector('option[value=""]');
        if (noneOption) {
          noneOption.textContent = "Filter: Soul";
          noneOption.selected = true;
        }
        soulSelect.addEventListener("change", () => {
          updateSoulClass();
          activeSoulFilter = soulSelect.value || null;
          applyFilters();
        });
        leftControls.appendChild(soulSelect);
      }
      toolbar.appendChild(leftControls);
      const cardFilterBtn = document.createElement("button");
      cardFilterBtn.id = "th-card-filter-btn";
      cardFilterBtn.textContent = "Card Filter";
      cardFilterBtn.className = "btn btn-default";
      Object.assign(cardFilterBtn.style, {
        padding: "4px 16px",
        whiteSpace: "nowrap",
        background: "#0e1a30",
        border: "1px solid #1e3a60",
        color: "#4a7aaa"
      });
      cardFilterBtn.onclick = () => {
        const isOpen = cardFilterPanel.style.display !== "none";
        cardFilterPanel.style.display = isOpen ? "none" : "block";
        if (!isOpen) {
          cardSearchInput.focus();
          renderCardFilterTags();
        }
      };
      toolbar.appendChild(cardFilterBtn);
      const pagerGroup = document.createElement("div");
      Object.assign(pagerGroup.style, { display: "flex", alignItems: "center", gap: "6px" });
      const btnPrev = document.createElement("button");
      btnPrev.id = "th-btn-prev";
      btnPrev.className = "btn btn-primary";
      btnPrev.disabled = true;
      btnPrev.innerHTML = "&#10094;";
      const pageSelect = document.createElement("select");
      pageSelect.id = "th-select-page";
      const slash = document.createElement("span");
      slash.textContent = "/";
      const maxPage = document.createElement("span");
      maxPage.id = "th-max-page";
      maxPage.textContent = "1";
      const btnNext2 = document.createElement("button");
      btnNext2.id = "th-btn-next";
      btnNext2.className = "btn btn-primary";
      btnNext2.innerHTML = "&#10095;";
      pagerGroup.appendChild(btnPrev);
      pagerGroup.appendChild(pageSelect);
      pagerGroup.appendChild(slash);
      pagerGroup.appendChild(maxPage);
      pagerGroup.appendChild(btnNext2);
      toolbar.appendChild(pagerGroup);
      nav.appendChild(toolbar);
      nav.appendChild(buildCardFilterPanel());
      if (ucNavRow) ucNavRow.insertAdjacentElement("afterend", nav);
      else originalDecks.insertAdjacentElement("beforebegin", nav);
      searchBox.addEventListener("input", () => {
        activeSearch = searchBox.value;
        applyFilters();
      });
      btnPrev.onclick = () => {
        if (currentPage <= 1) return;
        currentPage--;
        renderPage();
      };
      btnNext2.onclick = () => {
        const total = Math.ceil(filteredDecks.length / DECKS_PER_PAGE);
        if (currentPage >= total) return;
        currentPage++;
        renderPage();
      };
      pageSelect.onchange = (e) => {
        currentPage = Number(e.target.value) + 1;
        renderPage();
      };
      trueHubNavEl = nav;
    }
    function syncNav() {
      const total = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));
      const thSelect = document.getElementById("th-select-page");
      const thMax = document.getElementById("th-max-page");
      const thPrev = document.getElementById("th-btn-prev");
      const thNext = document.getElementById("th-btn-next");
      if (!thSelect || !thMax || !thPrev || !thNext) return;
      thSelect.innerHTML = "";
      for (let i = 1; i <= total; i++) {
        const opt = document.createElement("option");
        opt.value = i - 1;
        opt.textContent = i;
        if (i === currentPage) opt.selected = true;
        thSelect.appendChild(opt);
      }
      thMax.textContent = total;
      thPrev.disabled = currentPage <= 1;
      thNext.disabled = currentPage >= total;
    }
    function enableTrueHubNav() {
      if (ucNavRow) ucNavRow.style.display = "none";
      if (trueHubNavEl) {
        const gridWidth = trueHubWrapper.offsetWidth || originalDecks.offsetWidth;
        if (gridWidth > 0) {
          trueHubNavEl.style.width = gridWidth + "px";
          trueHubNavEl.style.maxWidth = gridWidth + "px";
          if (cardFilterPanel) {
            cardFilterPanel.style.width = "100%";
            cardFilterPanel.style.maxWidth = "100%";
          }
        }
        trueHubNavEl.style.display = "";
      }
    }
    function restoreClassicNav() {
      if (trueHubNavEl) trueHubNavEl.style.display = "none";
      if (ucNavRow) ucNavRow.style.display = "";
      if (!classicState) return;
      const liveSelect = document.getElementById("selectPage");
      const livePrev = document.getElementById("btnPrevious");
      const liveNext = document.getElementById("btnNext");
      const liveCur = document.getElementById("currentPage");
      const liveMax = document.getElementById("maxPage");
      if (liveSelect) liveSelect.innerHTML = classicState.selectHTML;
      if (liveCur) liveCur.textContent = classicState.currentPage;
      if (liveMax) liveMax.textContent = classicState.maxPage;
      if (livePrev) livePrev.disabled = classicState.prevDisabled;
      if (liveNext) liveNext.disabled = classicState.nextDisabled;
    }
    function cleanNotes(notes) {
      if (!notes) return "No description available.";
      return notes.replace(/\\n/g, "\n").replace(/<[^>]+>/g, "").replace(/ {2,}/g, " ").split("\n").filter((line) => !line.trim().toLowerCase().startsWith("creator")).filter((line) => !/https?:\/\//i.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    function showInfo(deck) {
      const msg = cleanNotes(deck.notes);
      const BootstrapDialogRef = getPageWindow().BootstrapDialog;
      if (BootstrapDialogRef == null ? void 0 : BootstrapDialogRef.alert) {
        BootstrapDialogRef.alert({ title: deck.channel || "Deck Info", message: msg });
      } else {
        alert(msg);
      }
    }
    function buildToggle() {
      const wrap = document.createElement("div");
      wrap.style.cssText = "text-align:center; margin:20px 0;";
      wrap.innerHTML = `<button id="truehub-switch" class="btn btn-primary">Switch to True Hub</button>`;
      trueHubWrapper.insertAdjacentElement("afterend", wrap);
      document.getElementById("truehub-switch").onclick = () => {
        const btn = document.getElementById("truehub-switch");
        if (mode === "classic") {
          if (!classicState) {
            classicState = {
              selectHTML: selectPage.innerHTML,
              currentPage: currentPageEl.textContent,
              maxPage: maxPageEl.textContent,
              prevDisabled: btnPrevious.disabled,
              nextDisabled: btnNext.disabled
            };
          }
          originalDecks.style.display = "none";
          trueHubWrapper.style.display = "";
          currentPage = 1;
          enableTrueHubNav();
          renderPage();
          btn.textContent = "Switch to Classic Hub";
          mode = "true";
          logger.log("mode", "Switched to True Hub view.");
        } else {
          trueHubWrapper.style.display = "none";
          originalDecks.style.display = "";
          restoreClassicNav();
          btn.textContent = "Switch to True Hub";
          mode = "classic";
          logger.log("mode", "Switched to Classic Hub view.");
        }
      };
    }
    function init() {
      waitForHub((hub, tmpl) => {
        originalDecks = hub;
        template = tmpl;
        selectPage = document.getElementById("selectPage");
        currentPageEl = document.getElementById("currentPage");
        maxPageEl = document.getElementById("maxPage");
        btnPrevious = document.getElementById("btnPrevious");
        btnNext = document.getElementById("btnNext");
        if (!selectPage || !btnPrevious || !btnNext) {
          logger.error("init", "Could not find nav elements.");
          return;
        }
        const style = document.createElement("style");
        style.textContent = `
        #truehub-list .hubDeck { margin-right: 10px; margin-bottom: 10px; }
        #th-card-dropdown::-webkit-scrollbar { width: 6px; }
        #th-card-dropdown::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      `;
        document.head.appendChild(style);
        trueHubWrapper = document.createElement("div");
        trueHubWrapper.id = "truehub-wrapper";
        trueHubWrapper.style.display = "none";
        trueHubList = originalDecks.cloneNode(false);
        trueHubList.id = "truehub-list";
        trueHubList.addEventListener("wheel", (e) => {
          if (!getScrollPaging()) return;
          if (mode !== "true") return;
          e.preventDefault();
          const totalPages = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));
          if (e.deltaY > 0) {
            if (currentPage < totalPages) {
              currentPage++;
              renderPage();
            }
          } else if (e.deltaY < 0) {
            if (currentPage > 1) {
              currentPage--;
              renderPage();
            }
          }
        }, { passive: false });
        trueHubWrapper.appendChild(trueHubList);
        originalDecks.insertAdjacentElement("afterend", trueHubWrapper);
        buildTrueHubNav();
        buildToggle();
        if (getAutoOpen()) {
          const toggleBtn = document.getElementById("truehub-switch");
          logger.log("init", "Auto-opening True Hub view.");
          if (toggleBtn) toggleBtn.click();
        }
        logger.log("init", "Ready.", { decksLoaded: allDecks.length });
      });
    }
    return { init, setDecks };
  }

  // packages/true-hub-bridge/decks-api.js
  var DECKS_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/bot/decks.json";
  function loadDecks() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: DECKS_URL,
        onload(res) {
          if (res.status !== 200) {
            reject(new Error(
              `Failed to fetch decks.json (HTTP ${res.status}). Check that the repo is public and bot/decks.json exists on main.`
            ));
            return;
          }
          try {
            const raw = JSON.parse(res.responseText);
            resolve(Array.isArray(raw) ? raw : raw.decks || []);
          } catch (e) {
            reject(e);
          }
        },
        onerror(err) {
          reject(err);
        }
      });
    });
  }

  // packages/true-hub-bridge/index.js
  function isHubPage() {
    return location.pathname.toLowerCase().includes("hub");
  }
  function initTrueHubBridge(plugin) {
    const settings = registerTrueHubBridgeSettings(plugin);
    if (!settings.enabled.value()) return;
    if (!isHubPage()) return;
    const logger = createLogger("TrueHubBridge");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings.debugLogging.value()) originalWarn(...args);
    };
    const overlay = createTrueHubOverlay({
      logger,
      getAutoOpen: () => settings.autoOpen.value(),
      getScrollPaging: () => settings.scrollPaging.value()
    });
    loadDecks().then((decks) => {
      overlay.setDecks(decks);
      overlay.init();
    }).catch((e) => logger.error("data", "Failed to load decks.json", e));
  }

  // packages/deck-tracker/settings.js
  var NOTEPAD_RANT_NAME = "Enable The Notepad They Said Was Fine I Swear Don't Send Them After Me It Was ONE Time Ok? Look I Read The Actual Statement Very Carefully And It Specifically Says Pen And Paper Type Tools Are Completely Fine And This Is Quite Literally Just Digital Pen And Paper, It Doesn't Calculate Anything, It Doesn't Hook Into Any Game Events, It Doesn't Even Know What Turn It Is, Please I Am Begging You Just Let Me Have This One Silly Little Drawing Feature Its So Cool And Awesome Just Try It Yourself Before You Nuke My Script First Ok?";
  var NOTEPAD_SHORT_NAME = "Enable Notepad Overlay Option";
  var RANT_DISABLED_CACHE_KEY = "wizascript.decktracker.rantDisabledCache";
  var CACHE_SYNC_INTERVAL_MS = 3e3;
  function registerDeckTrackerSettings(plugin) {
    const settings = createFeatureSettings(plugin, "decktracker", "Deck Tracker");
    const enabled = settings.add("enabled", {
      name: "Enable Deck Tracker",
      type: "boolean",
      default: true
    });
    const debugLogging = settings.add("debugLogging", {
      name: "Enable debug logging",
      type: "boolean",
      default: false
    });
    const retainUnclosedPresets = settings.add("retainUnclosedPresets", {
      name: "Retain Unclosed Presets Between Matches",
      type: "boolean",
      default: false
    });
    const allowFavoritedRetainedWhileSpectating = settings.add("allowFavoritedRetainedWhileSpectating", {
      name: "Auto-load Favorited/Retained Presets While Spectating",
      type: "boolean",
      default: false
    });
    const dimOpacity = settings.add("dimOpacity", {
      name: "Tracker Button Dim Opacity",
      type: "slider",
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.05
    });
    let cachedRantDisabled;
    try {
      cachedRantDisabled = GM_getValue(RANT_DISABLED_CACHE_KEY, false);
    } catch (e) {
      cachedRantDisabled = false;
    }
    const enableNotepad = settings.add("enableNotepad", {
      name: cachedRantDisabled ? NOTEPAD_SHORT_NAME : NOTEPAD_RANT_NAME,
      type: "boolean",
      default: false
    });
    const disableWizaRanting = settings.add("disableWizaRanting", {
      name: "Disable Incessant Ranting",
      type: "boolean",
      default: false
    });
    function syncRantCache() {
      try {
        GM_setValue(RANT_DISABLED_CACHE_KEY, disableWizaRanting.value());
      } catch (e) {
      }
    }
    syncRantCache();
    setInterval(syncRantCache, CACHE_SYNC_INTERVAL_MS);
    return {
      settings,
      enabled,
      debugLogging,
      retainUnclosedPresets,
      allowFavoritedRetainedWhileSpectating,
      dimOpacity,
      enableNotepad,
      disableWizaRanting
    };
  }

  // packages/deck-tracker/registry.js
  var FAVORITES_KEY = "wizascript.decktracker.favorites";
  var CUSTOM_PRESETS_KEY = "wizascript.decktracker.customPresets";
  var RETAINED_KEY = "wizascript.decktracker.retained";
  var POSITIONS_KEY = "wizascript.decktracker.positions";
  var presetTypes = /* @__PURE__ */ new Map();
  var activeInstances = /* @__PURE__ */ new Map();
  var favoritesCache = null;
  var customPresetsCache = null;
  var retainedCache = null;
  var positionsCache = null;
  var retainEnabledGetter = () => false;
  function loadFavorites() {
    if (favoritesCache) return favoritesCache;
    try {
      favoritesCache = JSON.parse(GM_getValue(FAVORITES_KEY, "{}"));
    } catch {
      favoritesCache = {};
    }
    return favoritesCache;
  }
  function saveFavorites() {
    GM_setValue(FAVORITES_KEY, JSON.stringify(favoritesCache || {}));
  }
  function loadCustomPresets() {
    if (customPresetsCache) return customPresetsCache;
    try {
      customPresetsCache = JSON.parse(GM_getValue(CUSTOM_PRESETS_KEY, "[]"));
    } catch {
      customPresetsCache = [];
    }
    return customPresetsCache;
  }
  function saveCustomPresets() {
    GM_setValue(CUSTOM_PRESETS_KEY, JSON.stringify(customPresetsCache || []));
  }
  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tracker";
  }
  function registerPresetType(definition, { onGameEvent, hudBehavior } = {}) {
    if (!definition || !definition.id) throw new Error("Preset definition requires an id");
    presetTypes.set(definition.id, { definition, onGameEvent: onGameEvent || null, hudBehavior: hudBehavior || null });
  }
  function getHudBehavior(id) {
    var _a;
    return ((_a = presetTypes.get(id)) == null ? void 0 : _a.hudBehavior) || null;
  }
  function createCustomPreset({ name, description = "", sprite = null }) {
    const id = `custom:${slugify(name)}:${Date.now().toString(36)}`;
    const definition = { id, name, description, sprite, soul: null, custom: true, kind: "manual" };
    const list = loadCustomPresets();
    list.push(definition);
    saveCustomPresets();
    presetTypes.set(id, { definition, onGameEvent: null });
    return definition;
  }
  function deleteCustomPreset(id) {
    customPresetsCache = loadCustomPresets().filter((p) => p.id !== id);
    saveCustomPresets();
    presetTypes.delete(id);
    deactivate(id);
    setFavorited(id, false);
  }
  function ensureCustomPresetsRegistered() {
    loadCustomPresets().forEach((def) => {
      if (!presetTypes.has(def.id)) presetTypes.set(def.id, { definition: def, onGameEvent: null });
    });
  }
  function getAvailablePresets() {
    ensureCustomPresetsRegistered();
    return [...presetTypes.values()].map((entry) => ({
      ...entry.definition,
      favorited: isFavorited(entry.definition.id)
    }));
  }
  function getDefinition(id) {
    var _a;
    ensureCustomPresetsRegistered();
    return ((_a = presetTypes.get(id)) == null ? void 0 : _a.definition) || null;
  }
  function isFavorited(id) {
    var _a;
    return !!((_a = loadFavorites()[id]) == null ? void 0 : _a.favorited);
  }
  function setFavorited(id, favorited) {
    const favorites = loadFavorites();
    if (favorited) {
      favorites[id] = { ...favorites[id] || {}, favorited: true };
    } else {
      delete favorites[id];
    }
    saveFavorites();
  }
  function getFavoritedPresetIds() {
    return Object.keys(loadFavorites());
  }
  function activate(id, { initialCount = 0 } = {}) {
    if (activeInstances.has(id)) return activeInstances.get(id);
    const instance = { count: initialCount, listeners: /* @__PURE__ */ new Set() };
    activeInstances.set(id, instance);
    return instance;
  }
  function deactivate(id) {
    activeInstances.delete(id);
  }
  function getCount(id) {
    var _a, _b;
    return (_b = (_a = activeInstances.get(id)) == null ? void 0 : _a.count) != null ? _b : 0;
  }
  function setCount(id, count) {
    const instance = activeInstances.get(id);
    if (!instance) return;
    instance.count = Math.max(0, count);
    instance.listeners.forEach((fn) => fn(instance.count));
  }
  function onCountChange(id, callback) {
    const instance = activeInstances.get(id);
    if (!instance) return () => {
    };
    instance.listeners.add(callback);
    return () => instance.listeners.delete(callback);
  }
  function dispatchGameEvent(event) {
    activeInstances.forEach((instance, id) => {
      const type = presetTypes.get(id);
      if (!type || !type.onGameEvent) return;
      type.onGameEvent(event, {
        getCount: () => instance.count,
        setCount: (next) => setCount(id, next)
      });
    });
  }
  function loadRetained() {
    if (retainedCache) return retainedCache;
    try {
      retainedCache = JSON.parse(GM_getValue(RETAINED_KEY, "{}"));
    } catch {
      retainedCache = {};
    }
    return retainedCache;
  }
  function saveRetained() {
    GM_setValue(RETAINED_KEY, JSON.stringify(retainedCache || {}));
  }
  function setRetainEnabledGetter(fn) {
    retainEnabledGetter = fn;
  }
  function getRetainedPresetIds() {
    return Object.keys(loadRetained());
  }
  function markRetained(id) {
    if (!retainEnabledGetter()) return;
    const retained = loadRetained();
    retained[id] = true;
    saveRetained();
  }
  function unmarkRetained(id) {
    const retained = loadRetained();
    if (retained[id]) {
      delete retained[id];
      saveRetained();
    }
  }
  function loadPositions() {
    if (positionsCache) return positionsCache;
    try {
      positionsCache = JSON.parse(GM_getValue(POSITIONS_KEY, "{}"));
    } catch {
      positionsCache = {};
    }
    return positionsCache;
  }
  function savePositions() {
    GM_setValue(POSITIONS_KEY, JSON.stringify(positionsCache || {}));
  }
  function getSavedPosition(id) {
    return loadPositions()[id] || null;
  }
  function setSavedPosition(id, layout) {
    const positions = loadPositions();
    positions[id] = layout;
    savePositions();
  }
  function clearSavedPosition(id) {
    const positions = loadPositions();
    if (positions[id]) {
      delete positions[id];
      savePositions();
    }
  }

  // packages/deck-tracker/notepad.js
  var POSITION_KEY = "notepad";
  var DRAWING_STORAGE_KEY = "wizascript.decktracker.notepadDrawing";
  var CANVAS_WIDTH = 240;
  var CANVAS_HEIGHT = 200;
  var DEFAULT_THICKNESS = 5;
  var DEFAULT_BACKGROUND = "#fffef8";
  var COLORS = {
    Black: "#1a1a1a",
    White: "#ffffff",
    Red: "#e53935",
    Orange: "#fb8c00",
    Yellow: "#f2c200",
    Green: "#43a047",
    Blue: "#2255cc",
    Indigo: "#3f51b5",
    Violet: "#8e24aa"
  };
  var widgetEl = null;
  var colorPopupEl = null;
  function injectStyle() {
    if (document.getElementById("wizascript-notepad-style")) return;
    const style = document.createElement("style");
    style.id = "wizascript-notepad-style";
    style.textContent = `
.wizascript-notepad {
  position: fixed;
  z-index: 8;
  background: #fdf6e3;
  border: 2px solid #8a7355;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  font-family: Arial, sans-serif;
  user-select: none;
}
.wizascript-notepad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background: #8a7355;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  cursor: grab;
  border-radius: 4px 4px 0 0;
}
.wizascript-notepad-header-buttons span {
  cursor: pointer;
  margin-left: 6px;
  font-size: 12px;
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
  padding: 1px 5px;
}
.wizascript-notepad-body {
  padding: 8px;
  display: flex;
  gap: 6px;
}
.wizascript-notepad-main-column {
  display: flex;
  flex-direction: column;
}
.wizascript-notepad-canvas {
  border: 1px solid #d8cbb0;
  display: block;
  cursor: crosshair !important;
}
.wizascript-notepad-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wizascript-notepad-tool-box {
  padding: 3px 10px;
  border: 2px solid #8a7355;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #5a4a35;
  background: #efe4cf;
  cursor: pointer;
}
.wizascript-notepad-tool-box.active {
  background: #d4a017;
  color: #fff;
  border-color: #a97e0f;
}
.wizascript-notepad-color-indicator {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  margin-left: 5px;
  vertical-align: middle;
}
.wizascript-notepad-size-slider {
  flex: 1;
  min-width: 60px;
}
.wizascript-notepad-bg-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 2px;
}
.wizascript-notepad-bg-label {
  font-size: 9px;
  color: #6b5a42;
  text-align: center;
  margin-bottom: 2px;
}
.wizascript-notepad-bg-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.3);
  cursor: pointer;
}
.wizascript-notepad-bg-swatch.active {
  outline: 2px solid #2255cc;
  outline-offset: 1px;
}
.wizascript-notepad-color-popup {
  position: fixed;
  z-index: 100002;
  background: #fff;
  border: 1px solid #999;
  border-radius: 5px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.wizascript-notepad-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.3);
  cursor: pointer;
}
`;
    document.head.appendChild(style);
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
  }
  function saveDrawing(canvasEl) {
    try {
      GM_setValue(DRAWING_STORAGE_KEY, canvasEl.toDataURL("image/png"));
    } catch (e) {
    }
  }
  function downloadAsPng(canvasEl) {
    const link = document.createElement("a");
    link.download = "notepad-doodle.png";
    link.href = canvasEl.toDataURL("image/png");
    link.click();
  }
  function closeColorPopup() {
    if (colorPopupEl) {
      colorPopupEl.remove();
      colorPopupEl = null;
    }
  }
  function bindWidgetDrag(widget, header) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    header.addEventListener("mousedown", (e) => {
      dragging = true;
      const rect = widget.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      header.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      widget.style.left = e.clientX - offsetX + "px";
      widget.style.top = e.clientY - offsetY + "px";
      widget.style.right = "auto";
      widget.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = "grab";
      const rect = widget.getBoundingClientRect();
      setSavedPosition(POSITION_KEY, { left: rect.left, top: rect.top });
    });
  }
  function showNotepad() {
    if (widgetEl) return;
    injectStyle();
    let currentTool = "draw";
    let currentPenColor = COLORS.Black;
    let backgroundColor = DEFAULT_BACKGROUND;
    let currentThickness = DEFAULT_THICKNESS;
    let drawing = false;
    let lastX = null;
    let lastY = null;
    const widget = document.createElement("div");
    widget.className = "wizascript-notepad";
    const savedLayout = getSavedPosition(POSITION_KEY);
    if (savedLayout) {
      widget.style.left = savedLayout.left + "px";
      widget.style.top = savedLayout.top + "px";
    } else {
      widget.style.right = "16px";
      widget.style.bottom = "16px";
    }
    const header = document.createElement("div");
    header.className = "wizascript-notepad-header";
    header.innerHTML = `<span>Notepad</span>`;
    const headerButtons = document.createElement("span");
    headerButtons.className = "wizascript-notepad-header-buttons";
    const clearBtn = document.createElement("span");
    clearBtn.textContent = "Clear";
    const saveBtn = document.createElement("span");
    saveBtn.textContent = "Save PNG";
    const closeBtn = document.createElement("span");
    closeBtn.textContent = "\xD7";
    headerButtons.append(clearBtn, saveBtn, closeBtn);
    header.appendChild(headerButtons);
    const body = document.createElement("div");
    body.className = "wizascript-notepad-body";
    const mainColumn = document.createElement("div");
    mainColumn.className = "wizascript-notepad-main-column";
    const toolbar = document.createElement("div");
    toolbar.className = "wizascript-notepad-toolbar";
    const drawBox = document.createElement("div");
    drawBox.className = "wizascript-notepad-tool-box active";
    drawBox.textContent = "Draw";
    const colorIndicator = document.createElement("span");
    colorIndicator.className = "wizascript-notepad-color-indicator";
    colorIndicator.style.background = currentPenColor;
    drawBox.appendChild(colorIndicator);
    drawBox.title = "Left-click to select. Right-click to change color.";
    const eraseBox = document.createElement("div");
    eraseBox.className = "wizascript-notepad-tool-box";
    eraseBox.textContent = "Erase";
    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.className = "wizascript-notepad-size-slider";
    sizeSlider.min = "1";
    sizeSlider.max = "30";
    sizeSlider.value = String(currentThickness);
    sizeSlider.title = "Brush size";
    toolbar.append(drawBox, eraseBox, sizeSlider);
    const canvas = document.createElement("canvas");
    canvas.className = "wizascript-notepad-canvas";
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    canvas.style.cursor = "none";
    const canvasWrapper = document.createElement("div");
    canvasWrapper.style.position = "relative";
    canvasWrapper.style.width = CANVAS_WIDTH + "px";
    canvasWrapper.style.height = CANVAS_HEIGHT + "px";
    const cursorIndicator = document.createElement("div");
    cursorIndicator.style.position = "absolute";
    cursorIndicator.style.pointerEvents = "none";
    cursorIndicator.style.borderRadius = "50%";
    cursorIndicator.style.border = "1.5px solid rgba(0,0,0,0.75)";
    cursorIndicator.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.7)";
    cursorIndicator.style.transform = "translate(-50%, -50%)";
    cursorIndicator.style.display = "none";
    canvasWrapper.append(canvas, cursorIndicator);
    mainColumn.append(toolbar, canvasWrapper);
    const bgColumn = document.createElement("div");
    bgColumn.className = "wizascript-notepad-bg-column";
    const bgLabel = document.createElement("div");
    bgLabel.className = "wizascript-notepad-bg-label";
    bgLabel.textContent = "Paper";
    bgColumn.appendChild(bgLabel);
    const bgSwatches = {};
    Object.entries(COLORS).forEach(([name, hex]) => {
      const swatch = document.createElement("div");
      swatch.className = "wizascript-notepad-bg-swatch";
      swatch.style.background = hex;
      swatch.title = name;
      if (hex.toLowerCase() === DEFAULT_BACKGROUND.toLowerCase()) {
        swatch.classList.add("active");
      }
      swatch.addEventListener("click", () => changeBackground(hex));
      bgSwatches[hex] = swatch;
      bgColumn.appendChild(swatch);
    });
    body.append(mainColumn, bgColumn);
    widget.append(header, body);
    document.body.appendChild(widget);
    function paintBackground(color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function changeBackground(newColor) {
      if (newColor === backgroundColor) return;
      const oldRgb = hexToRgb(backgroundColor);
      const newRgb = hexToRgb(newColor);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const TOLERANCE = 40;
      for (let i = 0; i < data.length; i += 4) {
        const dr = Math.abs(data[i] - oldRgb.r);
        const dg = Math.abs(data[i + 1] - oldRgb.g);
        const db = Math.abs(data[i + 2] - oldRgb.b);
        if (dr <= TOLERANCE && dg <= TOLERANCE && db <= TOLERANCE) {
          data[i] = newRgb.r;
          data[i + 1] = newRgb.g;
          data[i + 2] = newRgb.b;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      if (bgSwatches[backgroundColor]) bgSwatches[backgroundColor].classList.remove("active");
      backgroundColor = newColor;
      if (bgSwatches[backgroundColor]) bgSwatches[backgroundColor].classList.add("active");
      saveDrawing(canvas);
    }
    function loadDrawing() {
      let saved;
      try {
        saved = GM_getValue(DRAWING_STORAGE_KEY, null);
      } catch (e) {
        saved = null;
      }
      if (!saved) {
        paintBackground(backgroundColor);
        return;
      }
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.onerror = () => paintBackground(backgroundColor);
      img.src = saved;
    }
    loadDrawing();
    bindWidgetDrag(widget, header);
    function selectTool(tool) {
      currentTool = tool;
      drawBox.classList.toggle("active", tool === "draw");
      eraseBox.classList.toggle("active", tool === "erase");
      updateCursorIndicatorSize();
    }
    function getCanvasPoint(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function useAt(x, y) {
      const isErase = currentTool === "erase";
      const size = isErase ? currentThickness * 2.2 : currentThickness;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = isErase ? backgroundColor : currentPenColor;
      ctx.beginPath();
      ctx.moveTo(lastX != null ? lastX : x, lastY != null ? lastY : y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    }
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      drawing = true;
      const pt = getCanvasPoint(e);
      lastX = pt.x;
      lastY = pt.y;
      useAt(pt.x, pt.y);
    });
    function updateCursorIndicatorSize() {
      const size = currentTool === "erase" ? currentThickness * 2.2 : currentThickness;
      cursorIndicator.style.width = size + "px";
      cursorIndicator.style.height = size + "px";
    }
    canvas.addEventListener("mouseenter", () => {
      cursorIndicator.style.display = "block";
      updateCursorIndicatorSize();
    });
    canvas.addEventListener("mouseleave", () => {
      cursorIndicator.style.display = "none";
    });
    canvas.addEventListener("mousemove", (e) => {
      const pt = getCanvasPoint(e);
      cursorIndicator.style.left = pt.x + "px";
      cursorIndicator.style.top = pt.y + "px";
    });
    document.addEventListener("mousemove", (e) => {
      if (!drawing) return;
      const pt = getCanvasPoint(e);
      useAt(pt.x, pt.y);
    });
    document.addEventListener("mouseup", () => {
      if (!drawing) return;
      drawing = false;
      lastX = null;
      lastY = null;
      saveDrawing(canvas);
    });
    drawBox.addEventListener("click", () => selectTool("draw"));
    eraseBox.addEventListener("click", () => selectTool("erase"));
    drawBox.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      closeColorPopup();
      const popup = document.createElement("div");
      popup.className = "wizascript-notepad-color-popup";
      popup.style.left = e.clientX + "px";
      popup.style.top = e.clientY + "px";
      Object.entries(COLORS).forEach(([name, hex]) => {
        const swatch = document.createElement("div");
        swatch.className = "wizascript-notepad-color-swatch";
        swatch.style.background = hex;
        swatch.title = name;
        swatch.addEventListener("click", (ev) => {
          ev.stopPropagation();
          currentPenColor = hex;
          colorIndicator.style.background = hex;
          closeColorPopup();
        });
        popup.appendChild(swatch);
      });
      document.body.appendChild(popup);
      colorPopupEl = popup;
      setTimeout(() => {
        document.addEventListener("click", closeColorPopup, { once: true });
      }, 0);
    });
    sizeSlider.addEventListener("input", () => {
      currentThickness = Number(sizeSlider.value);
      updateCursorIndicatorSize();
    });
    clearBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    clearBtn.addEventListener("click", () => {
      paintBackground(backgroundColor);
      saveDrawing(canvas);
    });
    saveBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    saveBtn.addEventListener("click", () => downloadAsPng(canvas));
    closeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", () => hideNotepad());
    widgetEl = widget;
  }
  function hideNotepad() {
    closeColorPopup();
    if (!widgetEl) return;
    widgetEl.remove();
    widgetEl = null;
  }

  // packages/deck-tracker/hud.js
  var CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
  var SPRITE_RATIO = "160 / 90";
  var MIN_WIDTH = 90;
  var MAX_WIDTH = 220;
  var DEFAULT_WIDTH = 155;
  var COMPACT_DEFAULT_WIDTH = 120;
  var CASCADE_STEP = 24;
  var CASCADE_MAX_STEPS = 6;
  var CASCADE_BASE = 20;
  var cascadeIndex = 0;
  function getNextCascadePosition() {
    const step = cascadeIndex % CASCADE_MAX_STEPS;
    cascadeIndex++;
    return {
      right: CASCADE_BASE + step * CASCADE_STEP,
      bottom: CASCADE_BASE + step * CASCADE_STEP
    };
  }
  var liveWidgets = /* @__PURE__ */ new Map();
  function widgetElementId(id) {
    return `dt-tracker-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }
  function genericIcon() {
    return $("<div>").css({
      width: "100%",
      aspectRatio: SPRITE_RATIO,
      background: "#333",
      borderRadius: "3px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#777"
    }).text("#");
  }
  function spriteImage(sprite) {
    if (!sprite) return genericIcon();
    return $("<img>").attr("src", `${CARD_IMAGE_BASE}${sprite}.png`).css({
      width: "100%",
      aspectRatio: SPRITE_RATIO,
      objectFit: "cover",
      borderRadius: "3px",
      display: "block",
      background: "#000"
    }).on("error", function() {
      $(this).replaceWith(genericIcon());
    });
  }
  function buildWidget({ id, name, sprite, initialCount, initialLabel, isLabelMode = false, savedLayout, showSaveButton = false, showImage = true, contentMode = null, initialListItems = [], onRemoveListItem = null, firstItemLabel = "next" }) {
    const elId = widgetElementId(id);
    $(`#${elId}`).remove();
    const ns = `.dt-widget-${Math.random().toString(36).slice(2)}`;
    let width = (savedLayout == null ? void 0 : savedLayout.width) || (showImage ? DEFAULT_WIDTH : COMPACT_DEFAULT_WIDTH);
    const widget = $(`<div id="${elId}">`).addClass("dt-tracker-widget").css({
      position: "fixed",
      zIndex: 8,
      width: width + "px",
      background: "#1a1a1a",
      border: "2px solid #444",
      borderRadius: "6px",
      padding: "6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      color: "white",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      userSelect: "none",
      cursor: "grab"
    });
    if (savedLayout) {
      widget.css({ left: savedLayout.left + "px", top: savedLayout.top + "px", right: "auto", bottom: "auto" });
    } else {
      const pos = getNextCascadePosition();
      widget.css({ bottom: pos.bottom + "px", right: pos.right + "px", left: "auto", top: "auto" });
    }
    const nameLine = $("<div>").css({
      fontWeight: "bold",
      textAlign: "center",
      width: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }).text(name);
    const resizeHandle = $("<div>").css({
      position: "absolute",
      bottom: "-2px",
      right: "-2px",
      width: "14px",
      height: "14px",
      cursor: "nwse-resize",
      background: "transparent"
    });
    if (contentMode === "list") {
      let renderListItems = function(items) {
        listBody.empty();
        if (!items.length) {
          listBody.append($("<div>").css({
            fontSize: "11px",
            color: "#777",
            fontStyle: "italic",
            textAlign: "center",
            padding: "4px 0"
          }).text("No known cards yet"));
          return;
        }
        items.forEach((item, idx) => {
          const row = $("<div>").css({
            fontSize: "12px",
            padding: "3px 6px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "3px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }).attr("title", "Right-click to remove this card");
          row.append(
            $("<span>").css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }).text(item.name),
            $("<span>").css({ fontSize: "10px", color: "#777", flexShrink: 0, marginLeft: "6px" }).text(idx === 0 ? firstItemLabel : `+${idx}`)
          );
          row.on("mouseenter", () => row.css("background", "rgba(255,255,255,0.12)"));
          row.on("mouseleave", () => row.css("background", "rgba(255,255,255,0.06)"));
          row.on("mousedown", (e) => e.stopPropagation());
          row.on("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveListItem == null ? void 0 : onRemoveListItem(item);
          });
          listBody.append(row);
        });
      }, applySizeList = function(newWidth) {
        width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
        widget.css("width", width + "px");
        nameLine.css("fontSize", Math.round(width * 0.105) + "px");
        listBody.css("fontSize", Math.round(width * 0.09) + "px");
        return width;
      };
      widget.append(nameLine);
      const closeBtnList = $("<span>").text("\xD7").css({
        position: "absolute",
        top: "-8px",
        left: "-8px",
        cursor: "pointer",
        color: "#eee",
        fontSize: "15px",
        fontWeight: "bold",
        background: "rgba(180,30,30,0.75)",
        borderRadius: "50%",
        width: "18px",
        height: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: "1"
      });
      closeBtnList.on("mousedown", (e) => e.stopPropagation());
      widget.append(closeBtnList);
      const listBody = $("<div>").css({
        width: "100%",
        maxHeight: "150px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "3px"
      });
      renderListItems(initialListItems);
      widget.append(listBody, resizeHandle);
      $("body").append(widget);
      applySizeList(width);
      return {
        widget,
        nameLine,
        imageWrap: null,
        star: null,
        closeBtn: closeBtnList,
        resizeHandle,
        applySize: applySizeList,
        getWidth: () => width,
        ns,
        setSprite: () => {
        },
        setLabel: () => {
        },
        setListItems: renderListItems
      };
    }
    let imageWrap = null;
    let imageBox = null;
    let star = null;
    if (showImage) {
      imageWrap = $("<div>").css({ position: "relative", width: "100%" });
      imageBox = spriteImage(sprite);
      if (showSaveButton) {
        star = $("<span>").text("\u2606").attr("title", "Save as Preset").css({
          position: "absolute",
          top: "2px",
          right: "2px",
          cursor: "pointer",
          color: "#eee",
          fontSize: "15px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: "50%",
          width: "18px",
          height: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: "1"
        });
      }
    }
    const closeBtn = $("<span>").text("\xD7").css({
      position: "absolute",
      top: "2px",
      left: "2px",
      cursor: "pointer",
      color: "#eee",
      fontSize: "15px",
      fontWeight: "bold",
      background: "rgba(180,30,30,0.75)",
      borderRadius: "50%",
      width: "18px",
      height: "18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: "1"
    });
    if (showImage) {
      imageWrap.append(imageBox);
      if (star) imageWrap.append(star);
      imageWrap.append(closeBtn);
    } else {
      widget.css("position", "fixed");
      closeBtn.css({ top: "-8px", left: "-8px" });
      widget.append(closeBtn);
    }
    const countEl = $("<div>").css({
      fontWeight: "bold",
      width: "100%",
      textAlign: "center",
      background: "rgba(255,255,255,0.08)",
      borderRadius: "3px",
      padding: "2px 0"
    });
    if (isLabelMode) {
      countEl.html(initialLabel != null ? initialLabel : "?");
    } else {
      countEl.text("\xD7" + initialCount);
    }
    function applySize(newWidth) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      widget.css("width", width + "px");
      nameLine.css("fontSize", Math.round(width * 0.105) + "px");
      countEl.css("fontSize", Math.round(width * 0.14) + "px");
      return width;
    }
    applySize(width);
    if (showImage) {
      widget.append(nameLine, imageWrap, countEl, resizeHandle);
    } else {
      widget.append(nameLine, countEl, resizeHandle);
    }
    $("body").append(widget);
    if (star) star.on("mousedown", (e) => e.stopPropagation());
    closeBtn.on("mousedown", (e) => e.stopPropagation());
    function setSprite(newSprite) {
      if (!showImage || !imageBox) return;
      const fresh = spriteImage(newSprite);
      imageBox.replaceWith(fresh);
      imageBox = fresh;
    }
    function setLabel(html) {
      countEl.html(html);
    }
    return { widget, nameLine, countEl, imageWrap, star, closeBtn, resizeHandle, applySize, getWidth: () => width, ns, setSprite, setLabel };
  }
  function bindInteractions(parts, { onLeftClick, onRightClick, onMiddleClick, id, trackRetain = false }) {
    const { widget, resizeHandle, applySize, getWidth, ns } = parts;
    widget.off(ns).off("contextmenu" + ns);
    $(document).off(ns);
    resizeHandle.off(ns);
    let dragging = false, dragMoved = false, startX, startY, offsetX, offsetY;
    widget.on("mousedown" + ns, function(e) {
      if (e.button === 1) {
        e.preventDefault();
        onMiddleClick == null ? void 0 : onMiddleClick();
        return;
      }
      if (e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      const rect = widget[0].getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      startX = e.clientX;
      startY = e.clientY;
      widget.css("cursor", "grabbing");
      e.preventDefault();
    });
    $(document).on("mousemove" + ns, function(e) {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) dragMoved = true;
      if (dragMoved) {
        widget.css({ left: e.clientX - offsetX + "px", top: e.clientY - offsetY + "px", right: "auto", bottom: "auto" });
      }
    });
    $(document).on("mouseup" + ns, function() {
      if (!dragging) return;
      dragging = false;
      widget.css("cursor", "grab");
      if (dragMoved) {
        const rect = widget[0].getBoundingClientRect();
        const layout = { left: rect.left, top: rect.top, width: getWidth() };
        if (trackRetain) {
          setSavedPosition(id, layout);
          markRetained(id);
        }
      } else {
        onLeftClick == null ? void 0 : onLeftClick();
      }
    });
    widget.on("contextmenu" + ns, function(e) {
      e.preventDefault();
      onRightClick == null ? void 0 : onRightClick();
    });
    let resizing = false, resizeStartX, resizeStartWidth;
    resizeHandle.on("mousedown" + ns, function(e) {
      e.stopPropagation();
      e.preventDefault();
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartWidth = getWidth();
    });
    $(document).on("mousemove" + ns + "-resize", function(e) {
      if (!resizing) return;
      applySize(resizeStartWidth + (e.clientX - resizeStartX));
    });
    $(document).on("mouseup" + ns + "-resize", function() {
      if (!resizing) return;
      resizing = false;
      const rect = widget[0].getBoundingClientRect();
      const layout = { left: rect.left, top: rect.top, width: getWidth() };
      if (trackRetain) {
        setSavedPosition(id, layout);
        markRetained(id);
      }
    });
  }
  function spawnPreset(id) {
    var _a, _b, _c;
    const definition = getDefinition(id);
    if (!definition) {
      console.warn("[DeckTracker] Unknown preset id:", id);
      return null;
    }
    if (liveWidgets.has(id)) return liveWidgets.get(id).widget;
    activate(id);
    const savedLayout = getSavedPosition(id);
    const behavior = getHudBehavior(id);
    const parts = buildWidget({
      id,
      // The picker lists presets by their real name, but
      // the on-screen widget itself can show something more directly
      // descriptive of what it's currently displaying, if the preset
      // supplies one.
      name: (_a = behavior == null ? void 0 : behavior.widgetTitle) != null ? _a : definition.name,
      sprite: (behavior == null ? void 0 : behavior.getInitialSprite) ? behavior.getInitialSprite() : definition.sprite,
      initialCount: getCount(id),
      initialLabel: (behavior == null ? void 0 : behavior.getInitialLabel) ? behavior.getInitialLabel() : void 0,
      isLabelMode: !!behavior,
      savedLayout,
      showSaveButton: false,
      showImage: !(behavior == null ? void 0 : behavior.compact),
      contentMode: (behavior == null ? void 0 : behavior.listMode) ? "list" : null,
      initialListItems: (behavior == null ? void 0 : behavior.getInitialListItems) ? behavior.getInitialListItems() : [],
      onRemoveListItem: (behavior == null ? void 0 : behavior.onRemoveListItem) ? (item) => behavior.onRemoveListItem(id, item) : null,
      firstItemLabel: (_b = behavior == null ? void 0 : behavior.firstItemLabel) != null ? _b : "next"
    });
    const baselineRect = { left: parts.widget[0].getBoundingClientRect().left, top: parts.widget[0].getBoundingClientRect().top, width: parts.getWidth() };
    setSavedPosition(id, baselineRect);
    markRetained(id);
    parts.closeBtn.on("click", (e) => {
      e.stopPropagation();
      closeWidget(id);
    });
    const interactionCallbacks = behavior ? {
      onLeftClick: () => {
        var _a2;
        return (_a2 = behavior.onLeftClick) == null ? void 0 : _a2.call(behavior, id, parts);
      },
      onRightClick: () => {
        var _a2;
        return (_a2 = behavior.onRightClick) == null ? void 0 : _a2.call(behavior, id, parts);
      },
      onMiddleClick: () => {
        var _a2;
        return (_a2 = behavior.onMiddleClick) == null ? void 0 : _a2.call(behavior, id, parts);
      }
    } : {
      onLeftClick: () => setCount(id, getCount(id) + 1),
      onRightClick: () => setCount(id, getCount(id) - 1),
      onMiddleClick: () => setCount(id, 0)
    };
    bindInteractions(parts, {
      ...interactionCallbacks,
      id,
      trackRetain: true
    });
    const unsubscribe = behavior ? null : onCountChange(id, (count) => parts.countEl.text("\xD7" + count));
    liveWidgets.set(id, { ...parts, unsubscribe });
    (_c = behavior == null ? void 0 : behavior.onMount) == null ? void 0 : _c.call(behavior, id, parts);
    return parts.widget;
  }
  function closeWidget(id, { userInitiated = true } = {}) {
    var _a, _b, _c;
    const entry = liveWidgets.get(id);
    if (!entry) return;
    (_a = entry.unsubscribe) == null ? void 0 : _a.call(entry);
    $(document).off(entry.ns);
    entry.widget.remove();
    deactivate(id);
    liveWidgets.delete(id);
    (_c = (_b = getHudBehavior(id)) == null ? void 0 : _b.onUnmount) == null ? void 0 : _c.call(_b, id);
    if (userInitiated) {
      clearSavedPosition(id);
      unmarkRetained(id);
    }
  }
  function closeAllWidgets() {
    [...liveWidgets.keys()].forEach((id) => closeWidget(id, { userInitiated: false }));
  }
  function isWidgetOpen(id) {
    return liveWidgets.has(id);
  }
  function spawnAdHocCustomTracker({ name, sprite, onRequestSaveAsPreset }) {
    const tempId = `adhoc:${Date.now().toString(36)}`;
    let count = 0;
    const parts = buildWidget({
      id: tempId,
      name,
      sprite,
      initialCount: 0,
      savedLayout: null,
      showSaveButton: true
    });
    liveWidgets.set(tempId, { ...parts, unsubscribe: null });
    function setLocalCount(next) {
      count = Math.max(0, next);
      parts.countEl.text("\xD7" + count);
    }
    bindInteractions(parts, {
      onLeftClick: () => setLocalCount(count + 1),
      onRightClick: () => setLocalCount(count - 1),
      onMiddleClick: () => setLocalCount(0),
      id: tempId,
      trackRetain: false
      // no real registry id yet - nothing meaningful to retain
    });
    parts.closeBtn.on("click", (e) => {
      e.stopPropagation();
      closeWidget(tempId);
    });
    parts.star.on("click", (e) => {
      e.stopPropagation();
      onRequestSaveAsPreset(name, sprite, (savedName, description) => {
        const definition = createCustomPreset({ name: savedName, description, sprite });
        activate(definition.id, { initialCount: count });
        const rect = parts.widget[0].getBoundingClientRect();
        setSavedPosition(definition.id, { left: rect.left, top: rect.top, width: parts.getWidth() });
        parts.widget.attr("id", widgetElementId(definition.id));
        parts.closeBtn.off("click").on("click", (e2) => {
          e2.stopPropagation();
          closeWidget(definition.id);
        });
        bindInteractions(parts, {
          onLeftClick: () => setCount(definition.id, getCount(definition.id) + 1),
          onRightClick: () => setCount(definition.id, getCount(definition.id) - 1),
          onMiddleClick: () => setCount(definition.id, 0),
          id: definition.id,
          trackRetain: true
        });
        const unsubscribe = onCountChange(definition.id, (c) => parts.countEl.text("\xD7" + c));
        liveWidgets.delete(tempId);
        liveWidgets.set(definition.id, { ...parts, unsubscribe });
        parts.star.remove();
      });
    });
    return parts.widget;
  }

  // packages/deck-tracker/picker.js
  function heartIconSVG(filled) {
    const fill = filled ? "#e74c3c" : "none";
    const stroke = filled ? "#e74c3c" : "#888";
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round">
    <path d="M12 21s-6.716-4.35-9.428-8.06C.686 10.06 1.2 6.5 4.2 5.1 6.6 4 9 5 12 8c3-3 5.4-4 7.8-2.9 3 1.4 3.514 4.96 1.628 7.84C18.716 16.65 12 21 12 21z"/>
  </svg>`;
  }
  function starIconSVG(filled) {
    const fill = filled ? "#2ecc71" : "none";
    const stroke = filled ? "#2ecc71" : "#888";
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round">
    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.6 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"/>
  </svg>`;
  }
  function buildPresetRow(preset, onAdd, onCloseWidget, onDelete) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 6px",
      borderBottom: "1px solid rgba(255,255,255,0.1)"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const heart = $("<span>").css({
      width: "20px",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    });
    function renderHeart() {
      heart.html(heartIconSVG(isFavorited(preset.id)));
    }
    renderHeart();
    heart.attr("title", "Favorite - always auto-load at match start");
    heart.on("click", (e) => {
      e.stopPropagation();
      const nowFavorited = !isFavorited(preset.id);
      setFavorited(preset.id, nowFavorited);
      renderHeart();
    });
    const info = $("<div>").css({ flex: 1 });
    const nameLine = $("<div>").css({ fontWeight: "bold", fontSize: "14px" }).text(preset.name);
    if (preset.soul) {
      nameLine.append($("<span>").text(` (${preset.soul})`).css({
        fontSize: "11px",
        fontWeight: "normal",
        color: "#4a7aaa",
        marginLeft: "6px"
      }));
    }
    const descLine = $("<div>").css({ fontSize: "12px", color: "#aaa", marginTop: "2px" }).text(preset.description || "");
    info.append(nameLine, descLine);
    const starBtn = $("<span>").css({
      width: "28px",
      height: "28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      background: "rgba(255,255,255,0.08)",
      cursor: "pointer",
      flexShrink: 0
    });
    let active = isWidgetOpen(preset.id);
    function renderStar() {
      starBtn.html(starIconSVG(active));
      if (active && preset.custom) {
        starBtn.attr("title", "Double-click to permanently delete this preset");
      } else if (active) {
        starBtn.attr("title", "Remove from screen");
      } else {
        starBtn.attr("title", "Add to screen");
      }
    }
    renderStar();
    starBtn.on("click", (e) => {
      e.stopPropagation();
      if (!active) {
        onAdd(preset.id);
        active = true;
        renderStar();
        return;
      }
      if (preset.custom) {
        if (e.detail !== 2) return;
        onDelete(preset.id);
        row.remove();
        return;
      }
      onCloseWidget(preset.id);
      active = false;
      renderStar();
    });
    row.append(heart, info, starBtn);
    return row;
  }
  function renderList(container, term, onAdd, onCloseWidget, onDelete) {
    container.empty();
    const all = getAvailablePresets();
    const filtered = term ? all.filter((p) => p.name.toLowerCase().includes(term.toLowerCase())) : all;
    if (!filtered.length) {
      container.append($("<div>").text("No presets found.").css({
        padding: "12px",
        color: "#777",
        fontStyle: "italic",
        textAlign: "center"
      }));
      return;
    }
    filtered.sort((a, b) => b.favorited - a.favorited).forEach((p) => container.append(buildPresetRow(p, onAdd, onCloseWidget, onDelete)));
  }
  function buildCustomRow(onCreateAdHoc) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 6px",
      marginTop: "8px",
      borderTop: "2px dashed rgba(255,255,255,0.25)",
      cursor: "pointer"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const info = $("<div>").css({ flex: 1 });
    info.append(
      $("<div>").css({ fontWeight: "bold", fontSize: "14px" }).text("Custom Tracker"),
      $("<div>").css({ fontSize: "12px", color: "#aaa", marginTop: "2px" }).text("Build your own manual counter, named and tracked however you like.")
    );
    const addBtn = $("<button>").text("+").css({
      width: "28px",
      height: "28px",
      lineHeight: "1",
      fontSize: "16px",
      fontWeight: "bold",
      background: "#2ecc71",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      flexShrink: 0
    }).on("click", (e) => {
      e.stopPropagation();
      onCreateAdHoc();
    });
    row.append(info, addBtn);
    return row;
  }
  function buildNotepadRow(onOpenNotepad) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 6px",
      marginTop: "8px",
      borderTop: "2px dashed rgba(255,255,255,0.25)",
      cursor: "pointer"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const info = $("<div>").css({ flex: 1 });
    info.append(
      $("<div>").css({ fontWeight: "bold", fontSize: "14px" }).text("Notepad"),
      $("<div>").css({ fontSize: "12px", color: "#aaa", marginTop: "2px" }).text("Reopen the drawing surface, if you closed it.")
    );
    const addBtn = $("<button>").text("+").css({
      width: "28px",
      height: "28px",
      lineHeight: "1",
      fontSize: "16px",
      fontWeight: "bold",
      background: "#2ecc71",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      flexShrink: 0
    }).on("click", (e) => {
      e.stopPropagation();
      onOpenNotepad();
    });
    row.append(info, addBtn);
    return row;
  }
  function openHelpDialog() {
    const content = $("<div>").css({ fontSize: "13px", lineHeight: "1.5" });
    function section(title, body) {
      content.append(
        $("<div>").css({ fontWeight: "bold", marginTop: "10px" }).text(title),
        $("<div>").css({ color: "#ccc", marginTop: "2px" }).html(body)
      );
    }
    section(
      "Manual trackers (click counters)",
      "Left-click: +1 &nbsp;&nbsp; Right-click: -1 &nbsp;&nbsp; Middle-click: reset to 0."
    );
    section(
      "The heart (\u2665 / \u2661)",
      "Favorites a preset - a favorited preset always auto-loads at the start of every match, in the same spot you left it."
    );
    section(
      "The star (\u2605 / \u2606)",
      "Adds the preset to your screen. Once active, the star fills in - click it again to remove it from screen. For your own custom presets specifically, double-clicking the filled star permanently deletes it (built-in presets can't be deleted this way)."
    );
    section(
      "Creating your own preset",
      'Use "Custom Tracker" below the list to build one - search for a card sprite (optional), name it, and create it. That gives you a plain counter on screen; click its own star to "Save as Preset," adding it to this list permanently.'
    );
    section(
      "Position &amp; size",
      "Drag a tracker by its body to move it, or its bottom-right corner to resize it - it'll remember exactly where you left it until you close it."
    );
    BootstrapDialog.show({
      title: "Deck Tracker Help",
      message: content,
      cssClass: "mono",
      buttons: [{ label: "Got it", cssClass: "btn-primary", action: (dialog) => dialog.close() }]
    });
  }
  function openPresetPicker({ onAddPreset, onCreateAdHoc, onCloseWidget, onDeletePreset, onOpenNotepad, showNotepadOption }) {
    const wrapper = $("<div>").css({ minWidth: "360px" });
    const searchInput = $('<input type="text" placeholder="Search presets...">').addClass("form-control").css({
      width: "100%",
      boxSizing: "border-box",
      padding: "6px 8px",
      marginBottom: "8px",
      fontSize: "13px"
    });
    const listContainer = $("<div>").css({
      maxHeight: "220px",
      overflowY: "auto",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "4px"
    });
    let dialogRef = null;
    const customRow = buildCustomRow(() => {
      dialogRef == null ? void 0 : dialogRef.close();
      onCreateAdHoc();
    });
    searchInput.on("input", function() {
      renderList(listContainer, $(this).val(), onAddPreset, onCloseWidget, onDeletePreset);
    });
    wrapper.append(searchInput, listContainer, customRow);
    if (showNotepadOption) {
      const notepadRow = buildNotepadRow(() => {
        dialogRef == null ? void 0 : dialogRef.close();
        onOpenNotepad();
      });
      wrapper.append(notepadRow);
    }
    renderList(listContainer, "", onAddPreset, onCloseWidget, onDeletePreset);
    dialogRef = BootstrapDialog.show({
      title: "Add Tracker Preset",
      message: wrapper,
      cssClass: "mono",
      onshown: () => searchInput.trigger("focus"),
      buttons: [
        // Deliberately does NOT close dialogRef - unlike the Custom
        // Tracker row above, help should stack on top and leave the
        // picker open underneath, since the user likely wants to keep
        // referring back to it while reading.
        { label: "Help", cssClass: "btn-default", action: () => openHelpDialog() },
        { label: "Close", cssClass: "btn-primary", action: (dialog) => dialog.close() }
      ]
    });
    return dialogRef;
  }

  // packages/deck-tracker/presets/custom.js
  var CARD_IMAGE_BASE2 = "https://undercards.net/images/cards/";
  var SPRITE_RATIO2 = "160 / 90";
  function searchSpriteCards(term) {
    if (!term) return [];
    const t = term.toLowerCase();
    return getAllCards().filter((c) => c.name && c.image && c.name.toLowerCase().includes(t)).slice(0, 20);
  }
  function buildSpriteResultRow(card, onPick) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 8px",
      cursor: "pointer",
      fontSize: "13px"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const thumb = $("<img>").attr("src", `${CARD_IMAGE_BASE2}${card.image}.png`).css({
      width: "28px",
      aspectRatio: SPRITE_RATIO2,
      objectFit: "cover",
      flexShrink: 0,
      background: "#111"
    }).on("error", function() {
      $(this).replaceWith($("<div>").css({ width: "28px", aspectRatio: SPRITE_RATIO2, background: "#333", flexShrink: 0 }));
    });
    row.append(thumb, $("<span>").text(card.name));
    row.on("click", () => onPick(card));
    return row;
  }
  function openCustomTrackerBuilder({ onCreate }) {
    let selectedCard = null;
    const wrapper = $("<div>").css({ minWidth: "340px" });
    const spriteSearch = $('<input type="text" placeholder="Search for a card sprite (optional)...">').addClass("form-control").css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px" });
    const spriteResults = $("<div>").css({
      maxHeight: "150px",
      overflowY: "auto",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "4px",
      marginTop: "4px",
      display: "none"
    });
    const selectedPreview = $("<div>").css({
      display: "none",
      alignItems: "center",
      gap: "8px",
      marginTop: "8px",
      padding: "6px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: "4px"
    });
    const nameInput = $('<input type="text" placeholder="Tracker name">').addClass("form-control").css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px", marginTop: "10px" });
    spriteSearch.on("input", function() {
      const matches = searchSpriteCards($(this).val());
      spriteResults.empty();
      if (!matches.length) {
        spriteResults.hide();
        return;
      }
      matches.forEach((card) => spriteResults.append(buildSpriteResultRow(card, (picked) => {
        selectedCard = picked;
        nameInput.val(picked.name);
        selectedPreview.empty().css("display", "flex").append(
          $("<img>").attr("src", `${CARD_IMAGE_BASE2}${picked.image}.png`).css({ width: "28px", aspectRatio: SPRITE_RATIO2, objectFit: "cover" }).on("error", function() {
            $(this).replaceWith("(image unavailable)");
          }),
          $("<span>").text(`Sprite: ${picked.name}`)
        );
        spriteResults.hide();
        spriteSearch.val("");
      })));
      spriteResults.show();
    });
    wrapper.append(spriteSearch, spriteResults, selectedPreview, nameInput);
    const dialog = BootstrapDialog.show({
      title: "Create Custom Tracker",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Cancel", action: (d) => d.close() },
        {
          label: "Create",
          cssClass: "btn-success",
          action: (d) => {
            const name = nameInput.val().trim() || "Untitled Tracker";
            d.close();
            onCreate({ name, sprite: (selectedCard == null ? void 0 : selectedCard.image) || null });
          }
        }
      ]
    });
    setTimeout(() => spriteSearch.trigger("focus"), 100);
    return dialog;
  }
  function openSaveAsPresetPrompt(defaultName, onSaved) {
    const wrapper = $("<div>").css({ minWidth: "320px" });
    const nameInput = $('<input type="text">').addClass("form-control").val(defaultName).css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px", marginBottom: "8px" });
    const descInput = $('<textarea placeholder="Short description (optional)">').addClass("form-control").css({
      width: "100%",
      boxSizing: "border-box",
      padding: "6px 8px",
      fontSize: "13px",
      minHeight: "60px",
      resize: "vertical",
      background: "#111",
      color: "#eee",
      border: "1px solid #444"
    });
    wrapper.append(
      $("<label>").css({ fontSize: "12px", color: "#aaa" }).text("Preset name"),
      nameInput,
      $("<label>").css({ fontSize: "12px", color: "#aaa", marginTop: "6px", display: "block" }).text("Description"),
      descInput
    );
    return BootstrapDialog.show({
      title: "Save as Preset",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Cancel", action: (d) => d.close() },
        {
          label: "Save",
          cssClass: "btn-success",
          action: (d) => {
            const name = nameInput.val().trim() || defaultName;
            const description = descInput.val().trim();
            d.close();
            onSaved(name, description);
          }
        }
      ]
    });
  }

  // packages/deck-tracker/presets/built-in.js
  var BUILT_IN_PRESETS = [
    {
      id: "builtin:enemy-hlbs",
      name: "Enemy HLBs",
      description: "Tracks Hyperlinks Blocked added to the enemy deck",
      sprite: "Hyperlink_Blocked"
    },
    {
      id: "builtin:enemy-mines",
      name: "Enemy Mines",
      description: "Tracks Mines added to the enemy deck",
      sprite: "Mine"
    },
    {
      id: "builtin:cjester-procs",
      name: "CJester Procs",
      description: "Tracks the counters to be added by Freedom",
      sprite: "Caged_Jester"
    },
    {
      id: "builtin:pink-laser-atk",
      name: "Pink Laser ATK",
      description: "Tracks the number of monsters you played this game with 7 base HP",
      sprite: "Pink_Laser"
      // best-guess image name, not yet confirmed
    },
    {
      id: "builtin:skris-procs",
      name: "Skris Procs",
      description: "Tracks the counters to be added by Dark Fountain",
      sprite: "Soulless_Kris"
    },
    {
      id: "builtin:noellecoaster",
      name: "Noellecoaster",
      description: "Tracks the number of spells costing 2+ G you casted this game",
      sprite: "Noellecoaster"
      // best-guess image name, not yet confirmed
    }
  ];
  function registerBuiltInPresets() {
    BUILT_IN_PRESETS.forEach(({ id, name, description, sprite }) => {
      registerPresetType({
        id,
        name,
        description,
        sprite,
        soul: null,
        // card/archetype-specific, not a whole-Soul strategy tracker
        custom: false,
        // built-in - cannot be deleted via the picker's double-click
        kind: "manual"
        // click/right-click/middle-click driven, same as user custom trackers
      });
    });
  }

  // packages/core/player-context.js
  function isSpectating() {
    return location.pathname.toLowerCase().includes("spectate");
  }

  // packages/deck-tracker/index.js
  function isGamePage() {
    const path = location.pathname.toLowerCase();
    return path.includes("game") || path.includes("spectate");
  }
  function waitForAvatar(callback) {
    const existing = document.getElementById("yourAvatar");
    if (existing) return callback(existing);
    setTimeout(() => waitForAvatar(callback), 100);
  }
  function initDeckTracker(plugin) {
    const settings = registerDeckTrackerSettings(plugin);
    if (!settings.enabled.value()) return;
    if (!isGamePage()) return;
    const logger = createLogger("DeckTracker");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings.debugLogging.value()) originalWarn(...args);
    };
    setRetainEnabledGetter(() => settings.retainUnclosedPresets.value());
    registerBuiltInPresets();
    function syncNotepadVisibility() {
      if (settings.enableNotepad.value()) {
        showNotepad();
      } else {
        hideNotepad();
      }
    }
    syncNotepadVisibility();
    function handleAddPreset(id) {
      spawnPreset(id);
      logger.log("hud", "Spawned preset from picker:", id);
    }
    function handleCloseWidget(id) {
      closeWidget(id);
      logger.log("hud", "Closed preset from picker:", id);
    }
    function handleDeletePreset(id) {
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
        position: "fixed",
        zIndex: 8,
        width: "34px",
        height: "34px",
        borderRadius: "4px",
        background: "#2ecc71",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontSize: "20px",
        fontWeight: "bold",
        lineHeight: "1",
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        opacity: "0"
        // hidden until we've confirmed a real position - see tryReveal() below
      });
      document.body.appendChild(btn);
      let revealed = false;
      function reposition() {
        const rect = avatar.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const btnRect = btn.getBoundingClientRect();
        btn.style.left = rect.left - btnRect.width - 16 + "px";
        btn.style.top = rect.top + (rect.height - btnRect.height) / 2 + "px";
        return true;
      }
      function tryReveal() {
        let lastRect = null;
        let lastChangeTime = performance.now();
        const startTime = performance.now();
        const STABLE_MS = 200;
        const MAX_WAIT_MS = 3e3;
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
            const waitedTooLong = now - startTime > MAX_WAIT_MS;
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
      function isUnderScriptMenuOpen() {
        const menu = document.querySelector('.menu-content[role="Menu"]');
        return menu !== null && menu.offsetParent !== null;
      }
      function isBlockingModalOpen() {
        return document.body.classList.contains("modal-open") || document.querySelector(".modal-backdrop") !== null || isUnderScriptMenuOpen();
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
      window.addEventListener("scroll", reposition, { passive: true, capture: true });
      btn.onclick = () => openPresetPicker({
        onAddPreset: handleAddPreset,
        onCreateAdHoc: handleCreateAdHoc,
        onCloseWidget: handleCloseWidget,
        onDeletePreset: handleDeletePreset,
        onOpenNotepad: () => showNotepad(),
        showNotepadOption: settings.enableNotepad.value()
      });
      return btn;
    }
    let trackerButton = null;
    waitForAvatar((avatar) => {
      trackerButton = createButton(avatar);
    });
    plugin.events.on("GameEvent", (event) => {
      dispatchGameEvent(event);
      if ((event == null ? void 0 : event.action) === "getVictory" || (event == null ? void 0 : event.action) === "getDefeat" || (event == null ? void 0 : event.action) === "getResult") {
        (trackerButton == null ? void 0 : trackerButton.style) && (trackerButton.style.display = "none");
        closeAllWidgets();
      }
    });
    function restoreFavoritedAndRetained() {
      if (isSpectating() && !settings.allowFavoritedRetainedWhileSpectating.value()) return;
      const favoritedIds = getFavoritedPresetIds();
      const spawnedFavorites = favoritedIds.filter((id) => spawnPreset(id) !== null);
      if (spawnedFavorites.length) {
        logger.log("autoload", "Spawned favorited presets.", spawnedFavorites);
      }
      if (spawnedFavorites.length < favoritedIds.length) {
        logger.warn(
          "autoload",
          "Some favorited presets could not be spawned (missing definition).",
          favoritedIds.filter((id) => !spawnedFavorites.includes(id))
        );
      }
      if (settings.retainUnclosedPresets.value()) {
        const retainedIds = getRetainedPresetIds().filter((id) => !favoritedIds.includes(id));
        retainedIds.forEach((id) => spawnPreset(id));
        if (retainedIds.length) {
          logger.log("autoload", "Restored retained (unclosed) presets.", retainedIds);
        }
      }
    }
    plugin.events.on("GameStart", () => {
      if (trackerButton == null ? void 0 : trackerButton.style) trackerButton.style.display = "";
      restoreFavoritedAndRetained();
    });
    plugin.events.on("connect", (data) => {
      restoreFavoritedAndRetained();
      syncNotepadVisibility();
    });
  }

  // manifest.js
  bootstrap((plugin) => {
    initPatchMaker(plugin);
    initTrueHubBridge(plugin);
    initDeckTracker(plugin);
  });
})();
