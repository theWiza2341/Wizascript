// Pure text-formatting for patch note entries: keyword/stat/color
// highlighting, card references, switch effects, manual underline/skip
// escapes. No i18n, no DOM, no window access - wordColors and
// underlineTokens are resolved by core/card-data.js and passed in here.

export const BASE_WORD_COLORS = {
  ATK: "#f0003c", HP: "#0dd000", cost: "#00d0ff", DMG: "#ffcc00",
  DETERMINATION: "red", PATIENCE: "#41fcff", BRAVERY: "#fca500",
  INTEGRITY: "#0064ff", PERSEVERANCE: "#d535d9", KINDNESS: "#00c000",
  JUSTICE: "#ffff00", MONSTER: "#ffffff", TOKEN: "#00c800",
  BASE: "gray", COMMON: "#fff", RARE: "#00b8ff", EPIC: "#d535d9",
  LEGENDARY: "gold", DT: "red", COST: "#00d0ff", G: "gold",
  KR: "#d535d9"
};

const CARD_REF_REGEX = /\{([^{}]+?)\}/g;
const UL_OPEN = "__UC_UL_OPEN__";
const UL_CLOSE = "__UC_UL_CLOSE__";

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function sanitizeText(str) {
  return str ? str.replace(/\s+/g, " ").trim() : "";
}

export function insertUnderlineMarkers(text, underlineTokens) {
  let result = text;
  underlineTokens.forEach(token => {
    const re = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(token)})(?=([^A-Za-z0-9]|$))`, "g");
    result = result.replace(re, (m, pre, word) => pre + UL_OPEN + word + UL_CLOSE);
  });
  return result;
}

export function applyColorWords(seg, wordColors) {
  const colorKeys = Object.keys(wordColors).filter(Boolean)
    .sort((a, b) => b.length - a.length).map(escapeRegExp);
  if (!colorKeys.length) return seg;

  const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${colorKeys.join("|")})(?=([^\\p{L}\\p{N}_]|$))`, "giu");
  return seg.replace(regex, (match, pre, word) => {
    const c = wordColors[word] || wordColors[word.toUpperCase()] || wordColors[word.toLowerCase()];
    return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
  });
}

export function applyCardFormatting(seg, wordColors) {
  const cardColor = wordColors.PATIENCE || "#41fcff";
  return seg.replace(CARD_REF_REGEX, (match, inner) => {
    const cleaned = inner
      .replace(new RegExp(UL_OPEN, "g"), "").replace(new RegExp(UL_CLOSE, "g"), "")
      .replace(/<[^>]*>/g, "").trim();
    return `<span class="uc-card-ref" style="color:${cardColor};">${escapeHtml(cleaned)}</span>`;
  });
}

export function applyStatFormatting(seg, wordColors) {
  const statPattern = /(?<!\d)([+-]?)(\d+)\/([+-]?)(\d+)(?:\/([+-]?)(\d+))?(?=[^\d/]|$)/g;
  return seg.replace(statPattern, (match, s1, a, s2, b, s3, c) => {
    if (c !== undefined) {
      return `${s1}<span style="color:${wordColors.cost}">${a}</span>/` +
             `${s2}<span style="color:${wordColors.ATK}">${b}</span>/` +
             `${s3}<span style="color:${wordColors.HP}">${c}</span>`;
    }
    return `${s1}<span style="color:${wordColors.ATK}">${a}</span>/` +
           `${s2}<span style="color:${wordColors.HP}">${b}</span>`;
  });
}

// Shared by formatLine and formatSwitchInner - originally duplicated
// inline in both places in the pre-merge script.
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

  return parts.map(part => {
    let seg = part.text;
    if (part.manual) {
      return `<span style="text-decoration:underline;">${escapeHtml(seg.trim())}</span>`;
    }
    seg = insertUnderlineMarkers(seg, underlineTokens);
    seg = escapeHtml(seg);
    seg = applyColorWords(seg, wordColors);
    seg = applyCardFormatting(seg, wordColors);
    seg = applyStatFormatting(seg, wordColors);
    return seg
      .replace(new RegExp(UL_OPEN, "g"), `<span style="text-decoration:underline;">`)
      .replace(new RegExp(UL_CLOSE, "g"), `</span>`);
  }).join("");
}

export function extractSkipTokens(text) {
  const skipped = [];
  const work = text.replace(/\\([A-Za-z0-9\-]+)/g, (m, word) => {
    const idx = skipped.length;
    skipped.push(word);
    return `UCSK${idx}Z`;
  });
  return { work, skipped };
}

export function formatSwitchInner(rawText, wordColors, underlineTokens) {
  if (!rawText) return "";
  return formatSegments(rawText, wordColors, underlineTokens);
}

export function formatLine(rawText, wordColors, underlineTokens) {
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
