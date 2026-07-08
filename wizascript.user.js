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
  // packages/core/bootstrap.js
  var SUITE_NAME = "Wizascript";
  var SUITE_VERSION = "0.1.0";
  var DOWNLOAD_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js";
  var RETRY_MS = 250;
  var suitePlugin = null;
  var readyCallbacks = [];
  function tryBootstrap() {
    if (suitePlugin) return;
    if (typeof window.underscript === "undefined" || typeof window.underscript.plugin !== "function") {
      setTimeout(tryBootstrap, RETRY_MS);
      return;
    }
    suitePlugin = window.underscript.plugin(SUITE_NAME, SUITE_VERSION);
    suitePlugin.updater(DOWNLOAD_URL);
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
    return {
      setCategory(category, isEnabled) {
        enabled[category] = isEnabled;
      },
      log(category, ...args) {
        if (category && !enabled[category]) return;
        console.log(tag(category), ...args);
      },
      warn(category, ...args) {
        if (category && !enabled[category]) return;
        console.warn(tag(category), ...args);
      },
      error(category, ...args) {
        console.error(tag(category), ...args);
      }
    };
  }

  // packages/core/page-window.js
  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
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
  function applyColorWords(seg, wordColors) {
    const colorKeys = Object.keys(wordColors).filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegExp);
    if (!colorKeys.length) return seg;
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${colorKeys.join("|")})(?=([^\\p{L}\\p{N}_]|$))`, "giu");
    return seg.replace(regex, (match, pre, word) => {
      const c = wordColors[word] || wordColors[word.toUpperCase()] || wordColors[word.toLowerCase()];
      return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
    });
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

  // packages/patch-maker/overlay.js
  var STATE_KEY = "wizascript.patchmaker.state.v1";
  var cycleOrder = ["none", "other", "buff", "rework", "nerf"];
  function createPatchMakerOverlay({
    logger,
    getWordColors,
    getUnderlineTokens,
    getCardHoversEnabled,
    getCardNameMap
  }) {
    let overlay, container, toggle, modeToggle, resetBtn, helpBtn;
    let custom = false;
    let isViewerMode = false;
    function saveState() {
      try {
        const state = collectState();
        if (state) GM_setValue(STATE_KEY, JSON.stringify(state));
      } catch (e) {
        logger.error("save", "Failed to save state", e);
      }
    }
    function loadState() {
      const text = GM_getValue(STATE_KEY, "");
      if (!text) return;
      try {
        const saved = JSON.parse(text);
        if (saved && saved.sections) restoreState(saved);
      } catch (e) {
        logger.error("load", "Failed to parse saved state", e);
      }
    }
    function resetState() {
      GM_deleteValue(STATE_KEY);
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
      });
      span.addEventListener("blur", () => {
        let t = sanitizeText(span.textContent);
        if (!t) t = "[New entry]";
        span.textContent = t;
        li.dataset.raw = t;
        saveState();
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
    }
    function appendSection(label, isCustom, focusName, beforeNode) {
      const p = document.createElement("p");
      p.className = "uc-section-header";
      p.dataset.custom = isCustom ? "true" : "false";
      const labelEl = document.createElement("span");
      labelEl.className = "uc-section-label";
      labelEl.textContent = label || "[New Balance Section]";
      labelEl.setAttribute("contenteditable", isCustom ? "true" : "false");
      labelEl.setAttribute("tabindex", "0");
      labelEl.addEventListener("blur", () => {
        if (!isCustom) return;
        let t = sanitizeText(labelEl.textContent);
        if (!t) t = "[New Balance Section]";
        labelEl.textContent = t;
        saveState();
      });
      labelEl.addEventListener("keydown", (e) => handleShortcut(e), true);
      p.appendChild(labelEl);
      const ul = document.createElement("ul");
      ul.appendChild(createNewLI());
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "uc-collapse-btn";
      collapseBtn.textContent = "\u2212";
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
      const state = { title: "", sections: [] };
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
    function init(mainEl) {
      if (document.getElementById("uc-patch-overlay")) {
        logger.warn("init", "Overlay already exists; aborting duplicate init.");
        return;
      }
      const navbars = mainEl.querySelectorAll(".navbar.navbar-default");
      const headerNav = navbars[0];
      if (!headerNav) {
        logger.error("init", "Could not find header navbar.");
        return;
      }
      overlay = document.createElement("div");
      overlay.id = "uc-patch-overlay";
      overlay.style.display = "none";
      overlay.classList.add("editor-mode");
      container = document.createElement("div");
      const h2 = document.createElement("h2");
      h2.textContent = "[Untitled Patch]";
      h2.setAttribute("contenteditable", "true");
      h2.addEventListener("blur", saveState);
      container.appendChild(h2);
      [
        "Balancing (Monsters)",
        "Balancing (Spells)",
        "Balancing (Artifacts)",
        "Balancing (Board Slots)",
        "Balancing (Souls)",
        "Balancing (Other)"
      ].forEach((label) => appendSection(label, false, false));
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
      overlay.appendChild(container);
      headerNav.insertAdjacentElement("afterend", overlay);
      buildControlButtons();
      loadState();
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
      toggle.onclick = () => {
        custom = !custom;
        overlay.style.display = custom ? "" : "none";
        toggle.textContent = custom ? "Show Original Patch Notes" : "Show Custom Patch Notes";
        [modeToggle, resetBtn, helpBtn].forEach((b) => b.style.display = custom ? "inline-block" : "none");
        if (!custom && isViewerMode) {
          isViewerMode = false;
          overlay.classList.remove("viewer-mode");
          overlay.classList.add("editor-mode");
          modeToggle.textContent = "Switch to Viewer Mode";
          clearFormattingOverlay();
          setEditingEnabled(true);
        }
      };
      modeToggle.onclick = () => {
        if (!custom) return;
        isViewerMode = !isViewerMode;
        overlay.classList.toggle("viewer-mode", isViewerMode);
        overlay.classList.toggle("editor-mode", !isViewerMode);
        modeToggle.textContent = isViewerMode ? "Switch to Editor Mode" : "Switch to Viewer Mode";
        if (isViewerMode) {
          applyFormattingOverlay();
          setEditingEnabled(false);
        } else {
          clearFormattingOverlay();
          setEditingEnabled(true);
        }
      };
      resetBtn.onclick = (e) => {
        if (custom && e.detail === 2) {
          resetState();
          location.reload();
        }
      };
      helpBtn.onclick = () => {
        const message = "Patch Maker help - see documentation for full shortcut list.";
        const BootstrapDialogRef = window.BootstrapDialog;
        if (BootstrapDialogRef && typeof BootstrapDialogRef.alert === "function") {
          BootstrapDialogRef.alert({ title: "Custom Patch Maker \u2013 Help", message, closable: true });
        } else {
          alert(message);
        }
      };
    }
    return { init };
  }

  // packages/patch-maker/index.js
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
    refreshLocalizedData().then(() => waitForMainContent((mainEl) => overlay.init(mainEl))).catch((e) => logger.error("init", "Failed to initialize Patch Maker", e));
  }

  // manifest.js
  bootstrap((plugin) => {
    initPatchMaker(plugin);
  });
})();
