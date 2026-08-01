// packages/uc-tv/channel-guide.js

import { CONFIG, logDebug } from './settings.js';
import { fetchLiveGamesFull } from './game-list.js';
import { isModeAllowed, levelsPass, ranksPass } from './filters.js';
import { divisionIconUrl } from './divisions.js';
import { cancelActiveCountdown } from './countdown.js';
import { navigationReady } from './utils.js';
import { registerKeybind, getPrimaryKeyDisplay } from '../core/keybinds.js';
import { matchesPage } from '../core/page-match.js';

function isSpectatePage() {
  return matchesPage({ prefix: '/Spectate' });
}

// Undertale's canonical soul colors - these are real, well-known
// values, not a guess at Undercards' specific palette. The soul class
// name (KINDNESS, INTEGRITY, etc.) comes straight off the username
// span in the real markup.
const SOUL_COLORS = {
  DETERMINATION: '#ff4d4d',
  BRAVERY: '#ffb03b',
  JUSTICE: '#ffe75e',
  KINDNESS: '#4ddb4d',
  PATIENCE: '#4dd9e8',
  INTEGRITY: '#4d7bff',
  PERSEVERANCE: '#b366ff'
};

const MODE_COLORS = {
  RANKED: '#4dd9e8',
  STANDARD: '#7ee787',
  CUSTOM: '#b366ff',
  CPU: '#666666',
  STORY: '#ffb03b'
};
const LEGEND_MODES = ['RANKED', 'STANDARD', 'CUSTOM', 'CPU', 'STORY'];

function soulColor(soul) {
  return SOUL_COLORS[soul] || '#cfd8e3';
}
function modeColor(mode) {
  return MODE_COLORS[mode] || '#4dd9e8';
}

function jumpTo(plugin, gameId, playerId) {
  if (!navigationReady()) {
    if (plugin && typeof plugin.toast === 'function') {
      plugin.toast({ title: 'UC TV', text: 'Still loading - try again in a moment.' });
    }
    return;
  }
  location.href = `/Spectate?gameId=${gameId}&playerId=${playerId}`;
}

const GUIDE_FONT = "12px 'DTM-Mono', monospace";
const GUIDE_MIN_WIDTH = 300;
const GUIDE_MAX_WIDTH = 480;
const GUIDE_VISIBLE_ROWS = 10;
const GUIDE_ROW_HEIGHT_PX = 30; // matches the trimmed-down 12px row font size
const GUIDE_CHROME_HEIGHT_PX = 70; // header + legend + padding, roughly
// 'bottom-right' or 'center-right' - top-anchored was dropped, it
// collided with the top HUD row (portraits/soul icons) in practice.
const GUIDE_POSITION = 'bottom-right';
const RANK_ICON_WIDTH_PX = 14; // 12px icon + 2px margin, per player that has one

// Measures actual rendered text width (via an offscreen canvas, same
// font as what we render with) so the panel sizes itself to the
// widest real row instead of guessing a fixed number - falls back to
// whatever the browser resolves GUIDE_FONT to if the DTM-Mono face
// isn't loaded yet, which just makes this an estimate rather than
// pixel-perfect, still far better than a static guess.
function estimateWidestRowWidth(list) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = GUIDE_FONT;
  let max = 0;
  list.forEach((entry) => {
    let text = '';
    let iconWidth = 0;
    entry.players.forEach((p, i) => {
      if (i > 0) text += ' vs ';
      text += `\u2665 ${p.username || '?'}${p.level !== null ? ` LV ${p.level}` : ''}`;
      if (entry.mode === 'RANKED' && p.rank) iconWidth += RANK_ICON_WIDTH_PX;
    });
    text += `   ${entry.time || ''}`;
    const width = ctx.measureText(text).width + iconWidth;
    if (width > max) max = width;
  });
  return max;
}

let guideOverlay = null;
let guideLoading = false;

async function showChannelGuide(plugin) {
  if (guideOverlay || guideLoading) return; // already open, or a fetch is already in flight - keydown auto-repeat guard
  guideLoading = true;

  let entries;
  try {
    entries = await fetchLiveGamesFull();
  } catch (e) {
    console.warn('[UC TV] [guide] Failed to fetch live games:', e);
    guideLoading = false;
    return;
  }

  const filtered = entries.filter((entry) =>
    isModeAllowed(entry.mode) &&
    levelsPass(entry.players.map((p) => p.level)) &&
    ranksPass(entry.players.map((p) => p.rank), entry.mode)
  );
  const list = filtered.length ? filtered : entries; // don't show an empty guide if filters wipe everything out

  const currentGameId = new URLSearchParams(location.search).get('gameId');
  const targetWidth = Math.min(GUIDE_MAX_WIDTH, Math.max(GUIDE_MIN_WIDTH, estimateWidestRowWidth(list) + 55));
  const targetHeight = GUIDE_VISIBLE_ROWS * GUIDE_ROW_HEIGHT_PX + GUIDE_CHROME_HEIGHT_PX;

  const positionCSS = GUIDE_POSITION === 'center-right'
    ? 'top: 50%; right: 16px; transform: translateY(-50%);'
    : 'bottom: 90px; right: 16px;';

  // Right-anchored so it doesn't sit over the board/chat, and styled
  // to echo the homepage's own game list (dark panel, DTM-Mono if the
  // page has that font-face loaded already, soul-colored names, a
  // mode-colored accent stripe) rather than reproducing their actual
  // profile art/icons, which we don't have and shouldn't hotlink.
  const overlay = document.createElement('div');
  overlay.id = 'uctv-guide-overlay';
  overlay.style.cssText = `
    position: fixed;
    ${positionCSS}
    z-index: 999999;
    width: ${targetWidth}px;
    max-height: ${targetHeight}px;
    overflow-y: auto;
    background: rgba(5, 8, 16, 0.94);
    border: 1px solid rgba(77, 217, 232, 0.4);
    border-radius: 6px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.75);
    font-family: 'DTM-Mono', monospace;
    font-size: 12px;
    color: #d7e6f2;
    padding: 6px;
  `;

  const header = document.createElement('div');
  header.textContent = `UC TV Guide - ${list.length} shown | release ${getPrimaryKeyDisplay()} to close`;
  header.style.cssText = `
    font-size: 12px;
    letter-spacing: 0.5px;
    color: #4dd9e8;
    padding: 4px 6px 8px;
    border-bottom: 1px solid rgba(77,217,232,0.25);
    margin-bottom: 4px;
  `;
  overlay.appendChild(header);

  list.forEach((entry) => {
    const isCurrent = entry.gameId === currentGameId;
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 6px;
      margin-bottom: 2px;
      border-left: 3px solid ${modeColor(entry.mode)};
      background: ${isCurrent ? 'rgba(77,217,232,0.12)' : 'rgba(255,255,255,0.03)'};
      border-radius: 2px;
    `;

    entry.players.forEach((p, i) => {
      if (i > 0) {
        const divider = document.createElement('span');
        divider.textContent = 'vs';
        divider.style.cssText = 'opacity:0.35; font-size:11px; flex-shrink:0;';
        row.appendChild(divider);
      }

      const playerEl = document.createElement('span');
      playerEl.style.cssText = `
        flex: 0 1 auto;
        max-width: 46%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      `;

      // Only Ranked matches show the division icon - Custom/Standard/
      // CPU stay as they are, even if a division badge happens to be
      // present in that row's markup.
      const showRankIcon = entry.mode === 'RANKED' && p.rank;
      const rankIcon = document.createElement('img');
      if (showRankIcon) {
        rankIcon.src = divisionIconUrl(p.rank);
        rankIcon.alt = p.rank;
        rankIcon.title = p.rank.replace(/_/g, ' ');
        rankIcon.style.cssText = 'height:12px; vertical-align:middle; margin-right:2px;';
      }

      const heart = document.createElement('span');
      heart.textContent = '\u2665 ';
      heart.style.color = soulColor(p.soul);

      const name = document.createElement('span');
      name.textContent = p.username || '?';
      name.style.color = soulColor(p.soul);
      name.style.fontWeight = 'bold';

      const lvl = document.createElement('span');
      lvl.textContent = p.level !== null ? ` LV ${p.level}` : '';
      lvl.style.cssText = 'color:#6fa8ff; opacity:0.9;';

      if (showRankIcon) playerEl.appendChild(rankIcon);
      playerEl.append(heart, name, lvl);
      playerEl.addEventListener('mouseenter', () => { playerEl.style.textDecoration = 'underline'; });
      playerEl.addEventListener('mouseleave', () => { playerEl.style.textDecoration = 'none'; });
      playerEl.addEventListener('click', () => {
        logDebug(`[guide] Jumping to gameId=${entry.gameId}, playerId=${p.playerId}.`);
        jumpTo(plugin, entry.gameId, p.playerId);
      });

      row.appendChild(playerEl);
    });

    const timeEl = document.createElement('span');
    timeEl.textContent = entry.time || '';
    timeEl.style.cssText = 'color:#7dffb0; font-size:12px; flex-shrink:0; margin-left:4px;';
    row.appendChild(timeEl);

    overlay.appendChild(row);
  });

  // Built from LEGEND_MODES/MODE_COLORS directly rather than
  // hardcoded text, so it can't silently drift out of sync with the
  // actual stripe colors.
  const legend = document.createElement('div');
  legend.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 8px 6px 4px;
    margin-top: 4px;
    border-top: 1px solid rgba(77,217,232,0.25);
    font-size: 11px;
  `;
  LEGEND_MODES.forEach((mode) => {
    const item = document.createElement('span');
    item.style.cssText = 'display:flex; align-items:center; gap:4px; opacity:0.85;';
    const swatch = document.createElement('span');
    swatch.style.cssText = `width:9px; height:9px; border-radius:2px; background:${MODE_COLORS[mode]}; flex-shrink:0;`;
    const label = document.createElement('span');
    label.textContent = mode;
    item.append(swatch, label);
    legend.appendChild(item);
  });
  overlay.appendChild(legend);

  // Ctrl+scroll normally zooms the whole page - suppress that and
  // drive the scroll manually instead. Not conditioned on e.ctrlKey
  // specifically: the guide only ever exists while Primary is held
  // (releasing it closes the guide), so any wheel event received here
  // is inherently "the user wants to scroll this panel," regardless
  // of whether Primary is currently mapped to Ctrl or something else -
  // checking e.ctrlKey directly would silently stop working the
  // moment someone remaps Primary away from Ctrl.
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Most browsers reinterpret certain held modifiers (Shift being
    // the best-known case) as a horizontal-scroll gesture - deltaY
    // ends up near-zero and the actual scroll amount reports on
    // deltaX instead, even though the physical gesture was still a
    // normal vertical wheel roll. Since Primary is user-remappable and
    // could end up being exactly one of those keys, reading whichever
    // axis actually carries a nonzero delta keeps this working
    // regardless of what Primary happens to be bound to, rather than
    // silently going dead the moment someone remaps it to the "wrong" key.
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    overlay.scrollTop += delta;
  }, { passive: false });

  document.body.appendChild(overlay);
  guideOverlay = overlay;
  guideLoading = false;
}

function hideChannelGuide() {
  if (guideOverlay) {
    guideOverlay.remove();
    guideOverlay = null;
  }
}

export function bindChannelGuideKeybinds(plugin) {
  // No secondary key involved - this is purely about Primary alone,
  // so no defaultCode/onMatch here (registerKeybind skips creating a
  // "Primary + <key>" setting entry when onMatch is omitted).
  registerKeybind(plugin, {
    key: 'channelGuide',
    name: 'Open Channel Guide',
    scope: 'global',
    packageLabel: 'UC TV',
    // Fires the instant Primary goes down, not gated behind
    // confirming a hold first - this is what makes a simple tap
    // cancel the auto-continue countdown, rather than needing to hold
    // Primary the same way opening the guide does.
    onPrimaryPress: () => {
      if (!isSpectatePage()) return; // registered site-wide, but only does anything while spectating
      if (!CONFIG.masterEnabled) return;
      cancelActiveCountdown();
    },
    onPrimaryAlone: () => {
      if (!isSpectatePage()) return;
      if (!CONFIG.masterEnabled) return;
      showChannelGuide(plugin);
    },
    onPrimaryRelease: () => {
      if (!isSpectatePage()) return;
      hideChannelGuide();
    }
  });
}
