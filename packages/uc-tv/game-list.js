// packages/uc-tv/game-list.js

const ONCLICK_RE = /Spectate\?gameId=(\d+)&playerId=(\d+)/;

export function readMode(row) {
  const cell = row.querySelector('td.home-match-time');
  if (!cell) return null;
  const extra = Array.from(cell.classList).find((c) => c !== 'home-match-time');
  return extra || null; // e.g. "RANKED", "CPU", "CUSTOM", "STORY", "STANDARD"
}

export function readTimeText(row) {
  const cell = row.querySelector('td.home-match-time');
  return cell ? cell.textContent.trim() : null;
}

// "M:SS" normally, defensively also handles "H:MM:SS" in case a match
// ever runs past 59 minutes. Returns null for anything unparseable
// rather than guessing.
export function parseElapsedSeconds(timeText) {
  if (!timeText) return null;
  const parts = timeText.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function readPlayerInfoSpan(cell) {
  return cell.querySelector('.playerInfo > span');
}

function readUsername(cell) {
  const soulSpan = readPlayerInfoSpan(cell);
  if (!soulSpan) return null;
  // Clone so removing the nested level span doesn't touch the live
  // page, then whatever text remains is just the username.
  const clone = soulSpan.cloneNode(true);
  const nestedLevel = clone.querySelector('span');
  if (nestedLevel) nestedLevel.remove();
  const text = clone.textContent.replace(/\s+/g, ' ').trim();
  return text || null;
}

function readSoul(cell) {
  const soulSpan = readPlayerInfoSpan(cell);
  return soulSpan ? soulSpan.className.trim() || null : null;
}

// The nested <img> only exists after client-side i18n processing runs
// on the live page - a raw fetch('/') response never gets that far,
// so the span is empty in what we actually receive from the
// homepage. The division name is still present as plain text in the
// data-i18n attribute itself though (e.g. data-i18n="[html]{{DIVISION:
// EMERALD_III}}"), which IS part of the raw HTML - parsing that
// directly sidesteps the client-side templating gap entirely. Returns
// null when there's no division badge at all (unranked, or a fresh/
// low-placement account).
function readDivision(cell) {
  const span = cell.querySelector('span[data-i18n*="DIVISION"]');
  if (!span) return null;
  const raw = span.getAttribute('data-i18n') || '';
  const match = raw.match(/DIVISION:([A-Z_]+)/);
  return match ? match[1] : null;
}

function readPlayerCell(cell) {
  const m = (cell.getAttribute('onclick') || '').match(ONCLICK_RE);
  if (!m) return null;
  const levelMatch = cell.textContent.match(/LV\s*(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : null;
  return { gameId: m[1], playerId: m[2], level, rank: readDivision(cell) };
}

function readPlayerCellFull(cell) {
  const m = (cell.getAttribute('onclick') || '').match(ONCLICK_RE);
  if (!m) return null;
  const levelMatch = cell.textContent.match(/LV\s*(\d+)/);
  return {
    gameId: m[1],
    playerId: m[2],
    username: readUsername(cell),
    soul: readSoul(cell),
    level: levelMatch ? parseInt(levelMatch[1], 10) : null,
    // e.g. "EMERALD_III", "MASTER", or null if unranked/no badge.
    rank: readDivision(cell)
  };
}

// Slim shape - one representative playerId/level/rank per row, used
// by auto-continue and Ctrl+Arrow channel-switching (neither needs
// full per-player detail, just enough to filter and pick a target).
function parseRow(row) {
  const cells = Array.from(row.querySelectorAll('td.spectate-player'));
  const players = cells.map(readPlayerCell).filter(Boolean);
  if (!players.length) return null;
  const mode = readMode(row);
  // Prefer spectating from whichever side has a real level - in a
  // CPU match the bot's cell won't have parsed a level at all.
  const preferred = players.find((p) => p.level !== null) || players[0];
  return {
    gameId: players[0].gameId,
    playerId: preferred.playerId,
    mode,
    time: readTimeText(row),
    levels: players.map((p) => p.level), // e.g. [580, null] for a CPU match
    ranks: players.map((p) => p.rank) // e.g. ["EMERALD_III", null]
  };
}

// Full shape - both players' full detail, used by the channel guide
// and the __ucTVScope() debug command.
function parseRowFull(row) {
  const cells = Array.from(row.querySelectorAll('td.spectate-player'));
  const players = cells.map(readPlayerCellFull).filter(Boolean);
  if (!players.length) return null;
  return {
    gameId: players[0].gameId,
    mode: readMode(row),
    time: readTimeText(row),
    players
  };
}

async function fetchHomepageDoc() {
  const res = await fetch('/', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Homepage fetch failed: ${res.status}`);
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

const ROW_SELECTOR = 'table.spectateTable tbody tr, #liste table tbody tr';

export async function fetchLiveGames() {
  const doc = await fetchHomepageDoc();
  const rows = Array.from(doc.querySelectorAll(ROW_SELECTOR));
  return rows.map(parseRow).filter(Boolean);
}

export async function fetchLiveGamesFull() {
  const doc = await fetchHomepageDoc();
  const rows = Array.from(doc.querySelectorAll(ROW_SELECTOR));
  return rows.map(parseRowFull).filter(Boolean);
}
