// Shared scraping/parsing logic for both bot.js (full sync) and
// new-only-sync.js (incremental sync). Consolidating this here fixes
// two real bugs found when these lived as separate copies:
//  - new-only-sync.js was missing `let match;` before its first
//    reassignment in extractRecord (silently created an implicit
//    global under non-strict mode)
//  - the two scripts used different season-channel matching regexes
//    (bot.js: loose prefix match /^s\d+/i; new-only-sync.js: exact
//    match /^s(\d+)$/i) - a category like "s118-archive" would be
//    picked up by a full sync but silently ignored forever by the
//    incremental one. There is now exactly one implementation, using
//    the stricter exact-match form.
//
// The context-window extraction (getContextWindow) stays parameterized
// rather than unified to one behavior - bot.js intentionally scans from
// the start of the channel (thorough, since full syncs are rare/manual),
// while new-only-sync.js intentionally uses a tight +/-5 window (fast,
// since it runs every few hours). That difference looked deliberate,
// not accidental, so it's preserved as an option here instead of erased.

function extractDeckCode(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/eyJ[A-Za-z0-9+/=\-_]+/);
    if (match) return match[0];
  }
  return null;
}

function normalizeDeckCode(code) {
  if (!code) return null;
  code = code.replace(/-/g, "+").replace(/_/g, "/");
  while (code.length % 4 !== 0) code += "=";
  return code;
}

function extractRecord(text) {
  if (!text) return null;

  const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .toLowerCase();

  let match;

  match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
  if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

  match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

  match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
  if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

  match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
  if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

  match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
  if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

  return null;
}

function extractCreator(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (!lower.includes("creator")) return null;

  let match = text.match(/<@!?(\d+)>/);
  if (match) return { type: "id", value: match[1] };

  match = text.match(/creator[:\s]+@?([\w\-]+)/i);
  if (match) return { type: "name", value: match[1] };

  return null;
}

async function resolveUser(client, creator) {
  try {
    if (creator.type === "id") {
      const user = await client.users.fetch(creator.value);
      return user.username;
    }
    return creator.value;
  } catch {
    return null;
  }
}

async function fetchAllMessages(channel, { cap = 5000 } = {}) {
  let all = [];
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (!batch.size) break;

    const msgs = [...batch.values()];
    all.push(...msgs);
    lastId = msgs[msgs.length - 1].id;

    if (all.length > cap) break;
  }

  return all;
}

// Matches "sNNN" category names exactly (e.g. "s118"). A category
// needs to be exactly this shape to be treated as a season - the
// stricter of the two forms the original scripts used.
function matchSeasonCategory(categoryName = "") {
  const match = categoryName.match(/^s(\d+)$/i);
  return match ? Number(match[1]) : null;
}

// fromStart: true reproduces bot.js's original thorough scan (from the
// channel's first message through the deck code). Default (false) is
// new-only-sync.js's tighter +/-`before` message window.
function getContextWindow(sorted, deckIndex, { before = 5, fromStart = false } = {}) {
  const start = fromStart ? 0 : Math.max(0, deckIndex - before);
  const end = Math.min(sorted.length, deckIndex + 5);
  return sorted.slice(start, end);
}

module.exports = {
  extractDeckCode,
  normalizeDeckCode,
  extractRecord,
  extractCreator,
  resolveUser,
  fetchAllMessages,
  matchSeasonCategory,
  getContextWindow
};
