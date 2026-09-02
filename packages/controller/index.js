// packages/controller/index.js
//
// Full-controller navigation for Undercards: a free-roaming cursor, d-pad
// grid navigation across every screen the site renders (chrome nav,
// in-match hand/board/targeting, mulligan, Underscript's Settings/menu
// dialogs), an on-screen keyboard, and a configurable Primary+<button>
// relay onto Wizascript's own real keybind registry - plus a small set of
// direct hardware shortcuts (End Turn, Concede, dustpiles, Settings, Open
// Wizascript Settings, Go Home).
//
// This package was developed as a standalone prototype (a single
// self-registering Underscript plugin, `@grant none`, localStorage-backed)
// before being split up to integrate directly into the real Wizascript
// bundle. Unlike the prototype, this file does NOT register its own
// Underscript plugin - initController(plugin) receives the single shared
// `plugin` object every other Wizascript package uses, wired in by
// manifest.js/bootstrap.js. Persistence moved from localStorage to
// GM_getValue/GM_setValue (see storage.js), and settings registration
// moved from an ad-hoc `usPlugin.settings().add()` retry loop to the real
// createFeatureSettings() helper (see settings.js).
//
// Everything to do with reading the physical controller (Gamepad API
// merge, WebHID, button labels) lives in gamepad.js. Everything to do
// with the remappable-keybind settings surface (preset selector, capture
// widgets, the CONTROLLER_ACTIONS/HARDWARE_SHORTCUT_ACTIONS tables) lives
// in settings.js. This file owns the actual runtime: the on-screen
// keyboard, the free cursor and every navigation mode, and the
// requestAnimationFrame loop that drives all of it every frame.

import {
  getMergedGamepad, btnLabel, buttonToDisplay,
  pressIndicator,
  logRawGamepadStateIfChanged, logMergedInputEdges
} from './gamepad.js';
import {
  registerControllerSettings, isControllerSupportEnabled, isControllerCaptureActive,
  CONTROLLER_ACTIONS, HARDWARE_SHORTCUT_ACTIONS_BY_KEY,
  getControllerPrimaryButton, getBoundButton, getBoundShortcutButton,
  getChannelGuideButton,
  getPresetMenuState, isDebugTextEnabled, getHighlightColor
} from './settings.js';
import { getHudPosition, setHudPosition } from './storage.js';
import { getPageWindow } from '../core/page-window.js';

export function initController(plugin, controllerEnabledSetting) {
  // Tampermonkey sandbox gotcha: this build grants GM_getValue/GM_setValue,
  // which pulls the whole script into Tampermonkey's sandboxed JS realm. In
  // that realm a bare `window` is a sandbox proxy, not the real page window -
  // it fails when used as an event's `view` (new PointerEvent({view: window})
  // throws "Failed to convert value to 'Window'") and is unreliable for
  // innerWidth/innerHeight/getSelection()/jQuery/HTMLInputElement/location.
  // Every reference below that needs the real page window uses pageWindow,
  // resolved once via getPageWindow() (packages/core/page-window.js), which
  // returns unsafeWindow when present and falls back to window otherwise.
  const pageWindow = getPageWindow();

  // Highlight color now comes from the live "Selection Outline Color"
  // setting (settings.js's getHighlightColor(), soul-color presets) - see
  // that file for the defensive dual-read-path this reuses from the
  // Enable Debug Text fix, since this package's earlier attempts at
  // anything beyond 'boolean'/'text' SettingTypes were never confirmed
  // working end to end. Thickness stays a hardcoded constant - nobody's
  // asked to tune it, and it was never part of that unresolved history.
  const DEFAULT_HIGHLIGHT_THICKNESS = 4;
  function getHighlightThickness() { return DEFAULT_HIGHLIGHT_THICKNESS; }
  function cursorRestingDisplay() { return 'block'; }

  /* ---------- on-screen keyboard layout ---------- */
  const KEY_PAGES = {
    letters: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
      ['␣']
    ],
    symbols: [
      ['!', '?', '"', "'", '#', '%', '(', ')', '/', '\\'],
      ['-', '_', ',', '.', ':', ';', '*', '+', '=', '&'],
      ['<', '>', '@', '[', ']', '{', '}', '^', '`', '|'],
      ['$', '€'],
      ['␣']
    ]
  };
  function displayLabel(label, shift) {
    if (label === '␣') return 'SPACE';
    return shift ? label.toUpperCase() : label;
  }
  function keyInfo(ch) {
    if (ch === ' ') return { code: 'Space', keyCode: 32 };
    if (ch === ',') return { code: 'Comma', keyCode: 188 };
    if (ch === '.') return { code: 'Period', keyCode: 190 };
    if (/[a-z]/i.test(ch)) return { code: 'Key' + ch.toUpperCase(), keyCode: ch.toUpperCase().charCodeAt(0) };
    if (/[0-9]/.test(ch)) return { code: 'Digit' + ch, keyCode: ch.charCodeAt(0) };
    return { code: '', keyCode: ch.charCodeAt(0) };
  }

  /* ---------- shared panel positioning ---------- */
  function positionPanelNear(panel, target) {
    const rect = target.getBoundingClientRect();
    const w = panel.offsetWidth, h = panel.offsetHeight;
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + w > pageWindow.innerWidth - 8) left = pageWindow.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + h > pageWindow.innerHeight - 8) {
      top = rect.top - h - 8;
      if (top < 8) top = 8;
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  /* ---------- mount cursor + HUD + OSK + select picker ---------- */
  const cursor = document.createElement('div');
  Object.assign(cursor.style, {
    position: 'fixed', width: '18px', height: '18px', borderRadius: '50%',
    background: 'rgba(255,0,0,0.85)', border: '2px solid white',
    zIndex: 2147483647, pointerEvents: 'none', left: '0px', top: '0px',
    transform: 'translate(-50%,-50%)', display: 'none'
  });
  // The persistent green debug status readout - OFF by default (see
  // "Enable Debug Text" in settings.js; visibility is enforced every
  // frame near the top of frame() below, well before any of its many
  // `hud.textContent = ...` call sites further down, all of which stay
  // unconditional since writing text to a hidden element is harmless).
  // pointerEvents is 'auto' (not the usual 'none' for this package's
  // other overlays) specifically so it can be click-and-dragged out of
  // the way - it has no other reason to intercept clicks, being pure
  // status text with nothing to activate.
  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed', left: '8px', bottom: '8px', zIndex: 2147483647,
    background: 'rgba(0,0,0,0.6)', color: '#0f0', font: '12px monospace',
    padding: '4px 8px', borderRadius: '4px', pointerEvents: 'auto', whiteSpace: 'pre',
    cursor: 'move', userSelect: 'none', display: 'none'
  });
  // Restore a previously-dragged position, if any - switches from the
  // default bottom-left anchor to an explicit left/top the moment a saved
  // position exists, since dragging naturally produces left/top
  // coordinates rather than a distance-from-bottom.
  const savedHudPos = getHudPosition();
  if (savedHudPos) {
    hud.style.left = savedHudPos.left + 'px';
    hud.style.top = savedHudPos.top + 'px';
    hud.style.bottom = '';
  }
  // Real mouse drag-to-reposition - deliberately real DOM mouse events,
  // not this package's own synthetic controller-driven dispatch, since
  // this is a plain screen-space UI convenience for whoever's holding the
  // actual mouse, same small-movement-threshold shape as Deck Tracker's
  // own tracker-button drag (packages/deck-tracker/index.js) so a click
  // that barely twitches doesn't get mistaken for a drag and silently
  // move the HUD.
  (function makeHudDraggable() {
    const DRAG_THRESHOLD_PX = 4;
    let dragging = false, dragMoved = false, offsetX = 0, offsetY = 0;
    hud.addEventListener('mousedown', (e) => {
      dragging = true;
      dragMoved = false;
      const rect = hud.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    pageWindow.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = hud.getBoundingClientRect();
      const newLeft = e.clientX - offsetX, newTop = e.clientY - offsetY;
      if (!dragMoved && (Math.abs(newLeft - rect.left) > DRAG_THRESHOLD_PX || Math.abs(newTop - rect.top) > DRAG_THRESHOLD_PX)) {
        dragMoved = true;
      }
      if (!dragMoved) return;
      hud.style.left = Math.max(0, Math.min(pageWindow.innerWidth - 20, newLeft)) + 'px';
      hud.style.top = Math.max(0, Math.min(pageWindow.innerHeight - 20, newTop)) + 'px';
      hud.style.bottom = '';
    });
    pageWindow.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (dragMoved) {
        const rect = hud.getBoundingClientRect();
        setHudPosition(rect.left, rect.top);
      }
    });
  })();

  const OSK_THEMES = {
    dark:  { panelBg: '#1c1c1c', panelBorder: '1px solid rgba(255,255,255,0.15)', panelShadow: '0 4px 16px rgba(0,0,0,0.6)', hintColor: '#999', closeBg: '#3a3a3a' },
    light: { panelBg: '#f2f2f4', panelBorder: 'none', panelShadow: '0 8px 24px rgba(0,0,0,0.35)', hintColor: '#666', closeBg: '#333' }
  };
  const OSK_THEME_NAME = 'dark';
  const oskTheme = OSK_THEMES[OSK_THEME_NAME];

  const oskEl = document.createElement('div');
  Object.assign(oskEl.style, {
    position: 'fixed', zIndex: 2147483647, background: oskTheme.panelBg,
    padding: '16px 14px 10px', borderRadius: '14px', display: 'none',
    font: '15px -apple-system, "Segoe UI", sans-serif', pointerEvents: 'none',
    border: oskTheme.panelBorder, boxShadow: oskTheme.panelShadow
  });
  const oskClose = document.createElement('div');
  Object.assign(oskClose.style, {
    position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px',
    borderRadius: '50%', background: oskTheme.closeBg, color: '#fff', fontSize: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  });
  oskClose.textContent = '✕';
  oskEl.appendChild(oskClose);

  const oskGrid = document.createElement('div');
  oskEl.appendChild(oskGrid);
  let oskRowEls = [];
  function buildGrid(rows) {
    oskGrid.innerHTML = '';
    oskRowEls = [];
    rows.forEach((row) => {
      const rowEl = document.createElement('div');
      Object.assign(rowEl.style, { display: 'flex', justifyContent: 'center', marginBottom: '5px' });
      const keyEls = [];
      row.forEach((label) => {
        const keyEl = document.createElement('div');
        keyEl.textContent = displayLabel(label, oskShift);
        const wide = label === '␣';
        Object.assign(keyEl.style, {
          minWidth: wide ? '220px' : '34px', height: '34px', margin: '3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#232326', color: '#fff', borderRadius: '8px',
          border: '2px solid transparent', fontWeight: '600', fontSize: '14px'
        });
        rowEl.appendChild(keyEl);
        keyEls.push(keyEl);
      });
      oskGrid.appendChild(rowEl);
      oskRowEls.push(keyEls);
    });
  }

  const oskHint = document.createElement('div');
  Object.assign(oskHint.style, {
    marginTop: '4px', fontSize: '11px', color: oskTheme.hintColor, textAlign: 'center'
  });
  oskHint.textContent = '□ backspace   L1 shift   L3 symbols   △ space   L2/R2 caret (×2=edge)   R3 send   R1 pause   ○ close   ✕ type';
  oskEl.appendChild(oskHint);

  /* ---------- select picker - styled live from the real <select>/
     <option>'s computed CSS, so per-widget theming (e.g. soul-colored
     option rows) survives automatically instead of needing a hardcoded
     guess ---------- */
  const selectEl = document.createElement('div');
  Object.assign(selectEl.style, {
    position: 'fixed', zIndex: 2147483647, background: '#000',
    padding: '2px', borderRadius: '4px', display: 'none',
    font: 'inherit', fontSize: '14px', pointerEvents: 'none',
    border: '1px solid #ccc',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
    minWidth: '160px', maxHeight: '320px', overflowY: 'auto', overflowX: 'hidden'
  });
  let selectRowEls = [];
  function renderSelectOptions() {
    selectEl.innerHTML = '';
    selectRowEls = [];
    selectOptions.forEach((opt) => {
      const rowEl = document.createElement('div');
      rowEl.textContent = opt.text || opt.value;
      const optCs = getComputedStyle(opt);
      const bg = optCs.backgroundColor;
      Object.assign(rowEl.style, {
        padding: '6px 10px', margin: '0', borderRadius: '0',
        background: (bg && bg !== 'rgba(0, 0, 0, 0)') ? bg : 'transparent',
        color: optCs.color || '#fff',
        border: 'none', fontSize: 'inherit', fontFamily: 'inherit'
      });
      selectEl.appendChild(rowEl);
      selectRowEls.push(rowEl);
    });
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      marginTop: '2px', padding: '4px 10px 2px', fontSize: '11px',
      color: '#888', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.12)'
    });
    hint.textContent = '✕ confirm   ○ cancel';
    selectEl.appendChild(hint);
  }
  function updateSelectHighlight() {
    selectRowEls.forEach((el, i) => {
      const active = i === selectIndex;
      el.style.boxShadow = active ? 'inset 0 0 0 999px rgba(255,255,255,0.18)' : 'none';
    });
  }

  function mount() {
    if (!document.body) { requestAnimationFrame(mount); return; }
    document.body.appendChild(hud);
    document.body.appendChild(pressIndicator);
    document.body.appendChild(oskEl);
    document.body.appendChild(selectEl);
    // Cursor mounted LAST - it already sits at the max practical z-index
    // (2147483647) same as the other panels, so at equal z-index the
    // browser breaks the tie by DOM order, and appending it after the
    // panels is what actually puts it on top.
    document.body.appendChild(cursor);
  }
  mount();

  registerControllerSettings(plugin, controllerEnabledSetting);

  // Tracks which kind of input ('stick' or 'dpad') most recently drove
  // navigation. Used to gate the resolve/choice modal's d-pad focus
  // outline: choice modals only show d-pad-style highlighting while the
  // d-pad is what's actually driving selection, never for cursor hover.
  let navInputMethod = 'stick';

  /* ---------- groups ---------- */
  const GROUP_DEFS = [
    { name: 'navbar', containerSelectors: ['nav', '.navbar', '.navbar-nav', 'header nav'], itemSelector: 'a' },
    { name: 'footbar', containerSelectors: ['footer', '.footer', '.footer-nav'], itemSelector: 'a' }
  ];
  function buildGroup(def) {
    for (const sel of def.containerSelectors) {
      const container = document.querySelector(sel);
      if (!container) continue;
      const items = Array.from(container.querySelectorAll(def.itemSelector))
        .filter(el => el.offsetParent !== null);
      if (items.length) {
        console.log(`[Wizascript Controller] group "${def.name}" found via "${sel}": ${items.length} items`);
        return { name: def.name, container, items };
      }
    }
    console.log(`[Wizascript Controller] group "${def.name}" NOT found`);
    return null;
  }
  const navbarGroup = buildGroup(GROUP_DEFS[0]);
  const footbarGroup = buildGroup(GROUP_DEFS[1]);

  const chromeStates = [
    ...(navbarGroup ? [{ type: 'group', group: navbarGroup }] : []),
    { type: 'neutral' },
    ...(footbarGroup ? [{ type: 'group', group: footbarGroup }] : [])
  ];
  let chromeIndex = chromeStates.findIndex(s => s.type === 'neutral');
  const itemIndexByGroupName = {};

  /* ---------- match mode: in-game hand-nav / play / post-play targeting ----------
     No navbar/footer exists once you're in a match, so the d-pad is fully
     repurposed here instead of doing chrome group-nav. Detected live every
     frame via `#handCards` presence. Target/choice/drop-slot elements are
     laid out via buildRowGrid(), which clusters elements into rows by
     on-screen Y-position instead of assuming a single row. */
  let matchPhase = 'hand';        // 'hand' | 'placing' | 'resolve'
  let matchSubState = 'hand-nav'; // 'hand-nav' | 'neutral' (mirrors the navbar/footbar/neutral pattern)
  // Our own tracked reference to whichever monster board-nav's X press
  // last clicked to declare an attack - used so Circle can cancel an
  // in-progress attack-target selection by re-clicking the attacker.
  let pendingAttacker = null;
  let handItems = [];
  let handIndex = 0;
  let placingCard = null;   // hand card element currently being dragged
  let placingGrid = null;   // rows of currently-valid drop targets (`.ui-droppable-active`)
  let placingRow = 0, placingCol = 0;
  let resolveGrid = null;   // rows of `.target` or `.select-card-option.target` elements
  let resolveRow = 0, resolveCol = 0;
  let resolveKind = null;   // 'target' | 'choice', for the HUD label only
  let boardItems = [];      // your own board monsters, flat left-to-right
  let boardIndex = 0;
  let mulliganGrid = null;  // rows of mulligan cards + the trailing Confirm button
  let mulliganRow = 0, mulliganCol = 0;

  function queryHandCards() {
    const host = document.getElementById('handCards');
    if (!host) return [];
    let els = Array.from(host.querySelectorAll('.card'));
    if (!els.length) els = Array.from(host.children);
    return els.filter(el => el.offsetParent !== null);
  }
  // "Your" row is whichever row of monster slots sits lowest on screen
  // (closest to your hand) - same spatial reasoning a human uses to tell
  // their own board row from the opponent's, not a read of any hidden
  // ownership state.
  function queryBoardMonsterCards() {
    const slots = Array.from(document.querySelectorAll('.droppableMonster.slot, .droppableMonster'));
    const cards = slots.map(s => s.querySelector('.card')).filter(c => c && c.offsetParent !== null);
    if (!cards.length) return [];
    const rows = buildRowGrid(cards);
    if (!rows.length) return [];
    let bestRow = rows[0], bestTop = -Infinity;
    for (const row of rows) {
      const avgTop = row.reduce((sum, el) => sum + el.getBoundingClientRect().top, 0) / row.length;
      if (avgTop > bestTop) { bestTop = avgTop; bestRow = row; }
    }
    return bestRow;
  }
  // Set-based (order-independent) comparison - buildRowGrid() always
  // re-sorts its own input internally regardless of the order it's given,
  // so this only ever needs to care about SET membership (did the actual
  // navigable elements change), never about order.
  function elArraysEqual(a, b) {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    for (const el of b) if (!setA.has(el)) return false;
    return true;
  }
  // Clusters elements into rows by Y-position instead of assuming a fixed
  // layout, so both a single-row hand/target strip and a multi-row
  // discovery grid are handled by the same code.
  function buildRowGrid(els, rowTolerance = 28) {
    const withRect = els.map(el => ({ el, r: el.getBoundingClientRect() }))
      .sort((a, b) => a.r.top - b.r.top);
    const rows = [];
    for (const item of withRect) {
      let row = rows.find(r => Math.abs(r.top - item.r.top) <= rowTolerance);
      if (!row) { row = { top: item.r.top, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.forEach(r => r.items.sort((a, b) => a.r.left - b.r.left));
    return rows.map(r => r.items.map(i => i.el));
  }
  function gridFlat(grid) { return grid ? grid.flat() : []; }

  // Starts a synthetic drag on a playable hand card. Reuses the same
  // pointer/mouse event plumbing as the free-cursor drag (fire(), defined
  // below) rather than inventing a second mechanism - jQuery UI Draggable
  // only cares that it sees a real mousedown-then-mousemove sequence, not
  // who dispatched it.
  let placingOrigin = null; // the drag's starting point, so a cancel can release exactly back there
  function beginCardDrag(card) {
    pendingAttacker = null; // playing a card, not attacking
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    placingOrigin = { x: cx, y: cy };
    fire(card, 'pointerdown', PointerEvent, cx, cy, 0, 1);
    fire(card, 'mousedown', MouseEvent, cx, cy, 0, 1);
    // Small initial move so jQuery UI's drag-start distance threshold is
    // crossed and it commits to a real drag (and synchronously marks
    // every legal `.ui-droppable-active` target) before the 'placing'
    // branch runs on the next frame.
    const liftY = cy - 40;
    fire(card, 'pointermove', PointerEvent, cx, liftY, 0, 1);
    fire(card, 'mousemove', MouseEvent, cx, liftY, 0, 1);
    placingCard = card;
    placingGrid = null;
    matchPhase = 'placing';
    console.log('[Wizascript Controller] card drag started', card);
  }

  // Shared cancel logic for an in-progress placement. jQuery UI
  // Draggable/Droppable track "am I over a droppable" via mousemove-driven
  // internal state, not the mouseup event's own coordinates - move off
  // the drop target first (back to the drag's own starting point, so any
  // revert animation covers ~zero distance and reads as an instant
  // teleport rather than a jarring slide), then release.
  function cancelPlacingDrag(reason) {
    const card = placingCard;
    const origin = placingOrigin || { x: -9999, y: -9999 };
    fire(document.body, 'pointermove', PointerEvent, origin.x, origin.y, 0, 1);
    fire(document.body, 'mousemove', MouseEvent, origin.x, origin.y, 0, 1);
    fire(document.body, 'pointerup', PointerEvent, origin.x, origin.y, 0, 0);
    fire(document.body, 'mouseup', MouseEvent, origin.x, origin.y, 0, 0);
    if (pageWindow.jQuery) {
      pageWindow.jQuery(card).stop(true, true);
      pageWindow.jQuery('.ui-draggable-dragging').stop(true, true);
    }
    console.log('[Wizascript Controller] card drag cancelled via', reason);
    placingCard = null; placingGrid = null; placingOrigin = null;
    matchPhase = 'hand';
    refreshHighlight();
  }

  /* ---------- generic Underscript modal / menu navigation ----------
     Underscript exposes exactly two kinds of "everything blocks behind
     me" popup:
       1. Any `BootstrapDialog.show()` dialog - Settings (Underscript's
          own TabManager-tabbed screen), the Concede confirm, Smart
          Disenchant, the cosmetics-shop Purchase confirm, the changelog
          viewer, pack-opening error dialogs, and any dialog any OTHER
          plugin builds the same way. The mulligan modal is ALSO one of
          these underneath but keeps its own dedicated handling above -
          this generic path explicitly steps aside for it.
       2. Underscript's own hand-rolled overlay menu (`.menu-backdrop` /
          `.menu-content` / `.menu-body`) - Settings entry, Streamer-mode
          toggle, Update check, Changelog, Card Editor, Discord,
          Leaderboard+, etc.

     Both are treated uniformly: collect visible "navigable-looking"
     elements inside whichever root is open, lay them out with the same
     buildRowGrid() Y-clustering used everywhere else, and reuse
     activateHighlighted() for X/△.

     A TabManager-shaped dialog (`kind: 'tabbed'`, detected via
     `.tabbedView.left`) gets its own two-pane nav: LEFT/RIGHT toggles
     which pane has d-pad focus - 'categories' (the vertical sidebar) or
     'fields' (the active category's own setting rows). UP/DOWN browses
     within whichever pane is focused. A non-tabbed dialog (Concede
     confirm, Smart Disenchant, Purchase, changelog, pack errors -
     `kind: 'plain'`) keeps the flat single-grid behavior. */
  let modalGrid = null, modalRow = 0, modalCol = 0, modalKind = null;
  // 'categories' | 'fields' - only meaningful while modalKind === 'tabbed'.
  let modalPane = 'categories';
  let categoryItems = [], categoryIndex = 0;
  let fieldGrid = null, fieldRow = 0, fieldCol = 0;
  // Armed by a right-stick scroll of the fields pane (see the ry
  // handling in the tabbed-dialog block below) - while true, fieldRow/
  // fieldCol are considered stale (the list moved under them without
  // them moving), so the NEXT d-pad press re-anchors selection to
  // whichever row is now topmost-visible instead of applying its
  // direction on top of the old index. See topVisibleRowIndex() above.
  let fieldNeedsReanchor = false;
  // Traps d-pad focus inside a custom, non-native floating widget that a
  // field row opened (currently just the controller preset picker - see
  // settings.js's getPresetMenuState()) instead of letting up/down keep
  // moving fieldRow/fieldCol through the rows underneath it, which is
  // what a plain readOnly-input click previously did (the reported bug:
  // the preset dropdown opened, but the d-pad kept browsing the settings
  // list behind it instead of the dropdown's own rows). Shape:
  // { items, index, onConfirm(item), onCancel(), isAlive() }. Set inside
  // activateHighlighted() when opening a widget publishes menu state;
  // cleared on confirm/cancel or, defensively, the moment isAlive() says
  // the underlying widget closed itself some other way (outside click,
  // Escape key).
  let fieldSubmenu = null;
  // Tracks the checked-radio index as of LAST frame, for the edge-
  // triggered self-heal below (see its own comment at the use site).
  let lastKnownActiveCategoryIdx = -1;
  const MODAL_ITEM_SELECTOR = 'button, input:not([type="hidden"]):not(.tabButton), select, a[href], .card, li[role="button"], .tabLabel';
  function queryModalRoot() {
    // Prefer the last VISIBLE `.bootstrap-dialog`, not just the first one
    // in DOM order. Bootstrap can leave a just-closed dialog in the DOM
    // mid fade-out (display/opacity still non-'none' for a frame or two)
    // while a NEW one is already open on top of it (e.g. Deck Tracker's
    // "Add Tracker Preset" picker opening its own "Help" dialog on top,
    // per picker.js's own comment that Help stacks rather than replacing
    // it) - a plain `document.querySelector` would silently grab the
    // wrong (stale or underneath) one, and Cancel/Circle would then try
    // to dismiss a dialog the player can't even see, doing nothing
    // visible and forcing them out to the mouse instead.
    //
    // Deliberately `getComputedStyle(...).display !== 'none'`, NOT
    // `offsetParent !== null` (a first attempt at this that shipped
    // broken and got caught in live testing) - `offsetParent` is null for
    // ANY `position: fixed` element regardless of visibility, which is
    // exactly how BootstrapDialog renders, so that check was silently
    // treating every real, visible Settings/Concede/etc dialog as
    // invisible and made queryModalRoot() never detect a tabbed dialog at
    // all. getComputedStyle's `display` isn't fooled by position, and
    // matches the check already used for `.menu-backdrop` below.
    const visibleDialogs = Array.from(document.querySelectorAll('.bootstrap-dialog'))
      .filter((d) => getComputedStyle(d).display !== 'none');
    const dialog = visibleDialogs[visibleDialogs.length - 1] || null;
    if (dialog && !document.querySelector('.mulligan')) {
      const tabbedRoot = dialog.querySelector('.tabbedView.left');
      return tabbedRoot
        ? { root: dialog, kind: 'tabbed', tabbedRoot }
        : { root: dialog, kind: 'plain' };
    }
    const menu = document.querySelector('.menu-backdrop');
    if (menu && getComputedStyle(menu).display !== 'none') return { root: menu, kind: 'menu' };
    return null;
  }
  function queryModalItems(root) {
    return Array.from(root.querySelectorAll(MODAL_ITEM_SELECTOR))
      .filter(el => el.offsetParent !== null);
  }
  // Covers dialogs that render their scrollable list as plain, unclassed
  // `<div>` rows with click handlers on nested elements, none of which
  // MODAL_ITEM_SELECTOR matches (e.g. Deck Tracker's "Add Tracker Preset"
  // and "Create Custom Tracker" dialogs) - "direct-child spans of a row"
  // reliably isolates the real click targets for that specific shape.
  // Scoped to genuinely scrollable containers only, so this can't
  // accidentally sweep up unrelated spans from some other 'plain' dialog
  // shape that isn't built this way.
  function queryScrollableListItems(root) {
    const scrollable = findScrollableDescendant(root);
    if (!scrollable) return [];
    const items = [];
    Array.from(scrollable.children).forEach((row) => {
      if (row.tagName !== 'DIV') return;
      Array.from(row.children)
        .filter((c) => c.tagName === 'SPAN')
        .forEach((s) => items.push(s));
    });
    return items.filter((el) => el.offsetParent !== null);
  }
  // The category sidebar is Underscript's `TabManager` output - direct
  // `.tabLabel` children of the `.tabbedView.left` element itself. Sorted
  // by actual rendered position (top-to-bottom, then left-to-right as a
  // tiebreak) rather than DOM order, since Underscript's own CSS
  // (`.tabLabel.end { order: 1 }`) can reposition a tab (e.g. "Plugins")
  // visually without touching DOM order at all.
  function queryCategoryItems(tabbedRoot) {
    return Array.from(tabbedRoot.querySelectorAll(':scope > .tabLabel'))
      .filter(el => el.offsetParent !== null)
      .sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return ra.left - rb.left;
      });
  }
  // The whole tab system is pure CSS - exactly one `.tabContent` is ever
  // visible at a time.
  function queryActiveTabContent(tabbedRoot) {
    return Array.from(tabbedRoot.querySelectorAll(':scope > .tabContent'))
      .find(el => el.offsetParent !== null) || null;
  }
  // Groups by Underscript's own real DOM structure instead of guessing
  // from pixel positions: every registered setting, regardless of
  // SettingType, renders as exactly one `.flex-start` div, so that's the
  // row boundary with zero ambiguity for anything Underscript's own
  // settings framework rendered (which includes Wizascript's own settings
  // too, since `plugin.settings().add()` routes through the same
  // machinery).
  function queryFieldRows(root) {
    const flexRows = Array.from(root.querySelectorAll('.flex-start'))
      .filter((row) => row.offsetParent !== null)
      .map((row) => Array.from(row.querySelectorAll(MODAL_ITEM_SELECTOR)).filter((el) => el.offsetParent !== null))
      .filter((items) => items.length);
    // A nested tab-of-tabs bar (the "Plugins" category's own per-plugin
    // sub-tabs) isn't wrapped in `.flex-start` at all, since it's
    // TabManager output, not a setting row - surfaced here as one-item
    // rows of their own so they stay reachable.
    const bareLabels = Array.from(root.querySelectorAll('.tabLabel'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => [el]);
    const rows = [...bareLabels, ...flexRows];
    if (rows.length) return rows;
    // Fallback for any 'tabbed'-shaped content that ISN'T built from
    // Underscript's own setting-row markup.
    return buildRowGrid(queryModalItems(root));
  }
  // Clicking a `.tabLabel` is a native `<label for="...">` click - toggles
  // the associated (hidden) radio input, which Underscript's own CSS
  // reacts to on its own.
  function enterCategory() {
    const cat = categoryItems[categoryIndex];
    if (!cat) return;
    triggerElementClick(cat);
    modalPane = 'fields';
    fieldGrid = null; fieldRow = 0; fieldCol = 0;
    if (fieldSubmenu) { fieldSubmenu.onCancel && fieldSubmenu.onCancel(); fieldSubmenu = null; }
  }
  function findModalDismissButton(root) {
    const byAttr = root.querySelector('[data-dismiss="modal"], .close');
    if (byAttr) return byAttr;
    const buttons = Array.from(root.querySelectorAll('button'));
    return buttons.find(b => /close|cancel|^no$/i.test((b.textContent || '').trim())) || null;
  }

  /* ---------- highlight / submenu state ---------- */
  let activeSubmenu = null;
  let currentHighlightedEl = null;

  function findDropdownMenuNear(toggleEl) {
    const wrap = toggleEl.closest('.dropdown, .btn-group, li');
    if (!wrap) return [];
    return Array.from(wrap.querySelectorAll('.dropdown-menu a'))
      .filter(a => a.offsetParent !== null);
  }
  function currentFocusedEl() {
    // The mulligan modal is its own top-level mode, structurally like
    // OSK/select-picker/slider rather than part of matchPhase.
    if (mulliganGrid && mulliganGrid.length) {
      return (mulliganGrid[mulliganRow] || [])[mulliganCol] || null;
    }
    // Generic dialog/menu nav is next in priority - a modal can open on
    // top of a match (e.g. Concede) just as easily as out of one.
    if (modalKind === 'tabbed') {
      if (modalPane === 'categories') return categoryItems[categoryIndex] || null;
      if (fieldSubmenu) return fieldSubmenu.items[fieldSubmenu.index] || null;
      return (fieldGrid && fieldGrid[fieldRow] || [])[fieldCol] || null;
    }
    if (modalGrid && modalGrid.length) {
      return (modalGrid[modalRow] || [])[modalCol] || null;
    }
    // Match-mode states take priority over chrome nav - they're mutually
    // exclusive anyway (no navbar/footer exists during a match).
    if (matchPhase === 'placing' && placingGrid && placingGrid.length) {
      return (placingGrid[placingRow] || [])[placingCol] || null;
    }
    if (matchPhase === 'resolve' && resolveGrid && resolveGrid.length) {
      return (resolveGrid[resolveRow] || [])[resolveCol] || null;
    }
    if (document.getElementById('handCards') && matchSubState === 'board-nav' && boardItems.length) {
      return boardItems[boardIndex] || null;
    }
    if (document.getElementById('handCards') && matchSubState === 'hand-nav' && handItems.length) {
      return handItems[handIndex] || null;
    }
    if (activeSubmenu) return activeSubmenu.items[activeSubmenu.index] || null;
    const state = chromeStates[chromeIndex];
    if (!state || state.type !== 'group') return null;
    const g = state.group;
    const idx = itemIndexByGroupName[g.name] || 0;
    return g.items[idx] || null;
  }
  function setHighlight(el) {
    if (!el) return;
    el.style.outline = `${getHighlightThickness()}px solid ${getHighlightColor()}`;
    el.style.outlineOffset = '2px';
  }
  function clearHighlight(el) {
    if (!el) return;
    el.style.outline = '';
    el.style.outlineOffset = '';
  }
  function refreshHighlight() {
    // The outline highlight itself is opt-in to the d-pad, globally - by
    // default the page stays in "free roam," with players specifically
    // opting in for d-pad control via actually pressing it. Baking the
    // gate into refreshHighlight() itself (rather than repeating the same
    // check at every one of its ~20 call sites) means every call site
    // gets "never highlight unless the d-pad is what actually moved the
    // focus" for free. Click/activate logic all reads currentFocusedEl()/
    // fieldGrid/resolveGrid directly and doesn't depend on whether a box
    // is drawn, so this is purely visual.
    if (navInputMethod !== 'dpad') {
      if (currentHighlightedEl) { clearHighlight(currentHighlightedEl); currentHighlightedEl = null; }
      return;
    }
    const el = currentFocusedEl();
    if (el === currentHighlightedEl) return;
    if (currentHighlightedEl) clearHighlight(currentHighlightedEl);
    if (el) setHighlight(el);
    currentHighlightedEl = el;
  }

  /* ---------- widget-type detection ---------- */
  // A readOnly <input>/<textarea> can never accept typed text by
  // definition, so it can never legitimately need the on-screen keyboard
  // (this script's own controller-keybind/preset capture widgets are
  // readOnly type:'text' inputs, click-to-capture rather than click-to-
  // type).
  function isTextInput(el) {
    if (!el) return false;
    if (el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type);
    }
    return !!el.isContentEditable;
  }
  function isSlider(el) {
    return !!el && el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'range';
  }
  function isNativeSelect(el) {
    return !!el && el.tagName === 'SELECT';
  }

  // Real caret positioning within existing contenteditable text. Scoped
  // specifically to el.isContentEditable: Patch Maker's `.uc-li-text` and
  // `.uc-section-label` are real `contenteditable` elements, meaning
  // their rendered text is genuine DOM text nodes these point-to-position
  // APIs can resolve into - a plain `<input>`/`<textarea>`'s internal
  // value text is NOT exposed as normal DOM nodes, so these wouldn't give
  // a meaningful result there.
  // caretRangeFromPoint is the WebKit/Blink (Chrome) API; the standards-
  // track caretPositionFromPoint (Firefox, newer Chromium) is the
  // fallback. `el.contains(range.startContainer)` guards against
  // snapping the caret into an unrelated element.
  function placeCaretAtPoint(el, cx, cy) {
    if (!el || !el.isContentEditable) return;
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(cx, cy);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(cx, cy);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (range && el.contains(range.startContainer)) {
      const sel = pageWindow.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      console.log('[Wizascript Controller] caret repositioned in', el, 'at', cx, cy);
    }
  }

  // Caret step/edge-jump helpers for the OSK: while the OSK is open, L2/R2
  // single-tap steps the real caret left/right by one character, and a
  // double-tap of either jumps straight to the field's start/end. Handles
  // both a real contenteditable field (via the Selection/Range API and
  // the non-standard-but-universally-supported Selection.modify()) and a
  // plain <input>/<textarea> (via selectionStart/selectionEnd).
  function firstTextNode(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    return walker.nextNode();
  }
  function lastTextNode(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let last = null, node;
    while ((node = walker.nextNode())) last = node;
    return last;
  }
  function setOskCaretEdge(toStart) {
    if (!oskTarget) return;
    if (oskTarget.isContentEditable) {
      const node = toStart ? firstTextNode(oskTarget) : lastTextNode(oskTarget);
      const range = document.createRange();
      if (node) range.setStart(node, toStart ? 0 : node.textContent.length);
      else range.selectNodeContents(oskTarget);
      range.collapse(true);
      const sel = pageWindow.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const pos = toStart ? 0 : oskTarget.value.length;
      oskTarget.setSelectionRange(pos, pos);
      scrollFieldToCaret(oskTarget);
    }
  }
  function stepOskCaret(dir) {
    if (!oskTarget) return;
    if (oskTarget.isContentEditable) {
      const sel = pageWindow.getSelection();
      if (!sel.rangeCount || !oskTarget.contains(sel.anchorNode)) { setOskCaretEdge(dir < 0); return; }
      sel.modify('move', dir < 0 ? 'left' : 'right', 'character');
      // Safety net: if the browser's selection ever drifted outside the
      // target, snap back to the nearer edge instead of leaving the caret
      // somewhere unrelated.
      if (!oskTarget.contains(sel.focusNode)) setOskCaretEdge(dir < 0);
    } else {
      const cur = oskTarget.selectionStart == null ? oskTarget.value.length : oskTarget.selectionStart;
      const next = Math.max(0, Math.min(oskTarget.value.length, cur + dir));
      oskTarget.setSelectionRange(next, next);
      scrollFieldToCaret(oskTarget);
    }
  }

  /* ---------- on-screen keyboard control ---------- */
  let oskOpen = false, oskTarget = null, oskRow = 0, oskCol = 0, oskShift = false, oskPage = 'letters';
  // "Paused" state, toggled by R1 while the OSK is open. Paused hides the
  // OSK panel and stops it from consuming input - WITHOUT closing it, so
  // oskTarget stays set and the field keeps real DOM focus/caret position
  // - freeing d-pad up for the Primary-relay's own navigation (Patch
  // Maker move-entry, UC TV channel guide, etc.) while still mid-edit.
  let oskPaused = false;
  let lastL2TapTime = 0, lastR2TapTime = 0;
  const DOUBLE_TAP_WINDOW_MS = 400;
  let activeRows = KEY_PAGES.letters;
  buildGrid(activeRows);

  function renderOskLabels() {
    activeRows.forEach((row, r) => row.forEach((label, c) => {
      oskRowEls[r][c].textContent = displayLabel(label, oskShift);
    }));
  }
  function updateOskHighlight() {
    activeRows.forEach((row, r) => row.forEach((label, c) => {
      const active = r === oskRow && c === oskCol;
      oskRowEls[r][c].style.border = active ? '2px solid #0f0' : '2px solid transparent';
      oskRowEls[r][c].style.background = active ? '#0a4d0a' : '#232326';
    }));
  }
  function openOsk(target) {
    oskTarget = target;
    // Explicit real .focus() call, not left to ride on the preceding
    // synthetic click alone - a synthetic (untrusted) mousedown/click
    // dispatched via `dispatchEvent()` isn't reliably treated as a "real"
    // focus-worthy interaction by the browser the way a genuine user
    // click is.
    target.focus();
    oskOpen = true;
    oskPaused = false; // every fresh OSK session starts unpaused
    oskRow = 0; oskCol = 0; oskShift = false; oskPage = 'letters';
    activeRows = KEY_PAGES.letters;
    buildGrid(activeRows);
    oskEl.style.display = 'block';
    positionPanelNear(oskEl, target);
    cursor.style.display = 'block'; // cursor stays live for hover-to-type
    updateOskHighlight();
    console.log('[Wizascript Controller] OSK opened for', target);
  }
  // Always blurs the real target on close, regardless of field type -
  // Patch Maker's saveState() (and similar save-on-blur logic elsewhere)
  // is wired to each field's real `blur` event, not to Enter specifically,
  // so closing without blurring would silently skip that save.
  function closeOsk() {
    oskOpen = false;
    oskPaused = false; // fully closing always clears paused too
    oskEl.style.display = 'none';
    if (oskTarget) oskTarget.blur();
    oskTarget = null;
    console.log('[Wizascript Controller] OSK closed');
  }
  function dispatchEnterKey(el) {
    el.focus();
    const scope = el.closest('form') || el.closest('.chat-box') || el.parentElement;
    const submitEl = scope && scope.querySelector('input[type="submit"]');
    if (submitEl) {
      submitEl.click();
      return;
    }
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, view: pageWindow };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }
  // A hidden mirror <span> with the field's own font metrics copied over
  // measures the real pixel width of the text up to the caret, then nudges
  // `scrollLeft` just enough to keep that point within the field's
  // visible width - real keystrokes get this scroll-follows-caret
  // behavior from the browser for free, but execCommand('insertText'/
  // 'delete', ...) and direct setSelectionRange() calls don't reliably
  // trigger it, so this script has to keep it in sync explicitly.
  // Deliberately scoped to plain `<input>`/`<textarea>` only, not
  // contenteditable (no selectionStart/scrollLeft there).
  let scrollMirrorEl = null;
  function measureTextWidth(el, text) {
    if (!scrollMirrorEl) {
      scrollMirrorEl = document.createElement('span');
      Object.assign(scrollMirrorEl.style, {
        position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', top: '-9999px', left: '-9999px'
      });
      document.body.appendChild(scrollMirrorEl);
    }
    const cs = getComputedStyle(el);
    scrollMirrorEl.style.font = cs.font;
    scrollMirrorEl.style.letterSpacing = cs.letterSpacing;
    scrollMirrorEl.style.textTransform = cs.textTransform;
    scrollMirrorEl.textContent = text;
    return scrollMirrorEl.getBoundingClientRect().width;
  }
  function scrollFieldToCaret(el) {
    if (!el || el.isContentEditable) return;
    if (typeof el.selectionEnd !== 'number') return; // e.g. type="number" has no selection API
    const pos = el.selectionEnd;
    const caretX = measureTextWidth(el, el.value.slice(0, pos));
    const visibleWidth = el.clientWidth;
    const margin = 12;
    if (caretX - el.scrollLeft > visibleWidth - margin) {
      el.scrollLeft = caretX - visibleWidth + margin;
    } else if (caretX - el.scrollLeft < margin) {
      el.scrollLeft = Math.max(0, caretX - margin);
    }
  }
  function typeChar(el, ch) {
    el.focus();
    const info = keyInfo(ch);
    const base = { bubbles: true, cancelable: true, key: ch, code: info.code, keyCode: info.keyCode, which: info.keyCode, view: pageWindow };
    el.dispatchEvent(new KeyboardEvent('keydown', base));
    el.dispatchEvent(new KeyboardEvent('keypress', base));
    document.execCommand('insertText', false, ch);
    el.dispatchEvent(new KeyboardEvent('keyup', base));
    scrollFieldToCaret(el);
  }
  function typeBackspace(el) {
    el.focus();
    const base = { bubbles: true, cancelable: true, key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, view: pageWindow };
    el.dispatchEvent(new KeyboardEvent('keydown', base));
    document.execCommand('delete');
    el.dispatchEvent(new KeyboardEvent('keyup', base));
    scrollFieldToCaret(el);
  }
  function pressKey(label) {
    if (!oskTarget) return;
    if (label === '␣') { typeChar(oskTarget, ' '); return; }
    const ch = oskShift ? label.toUpperCase() : label;
    typeChar(oskTarget, ch);
  }

  /* ---------- slider focus control ---------- */
  let sliderTarget = null;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(pageWindow.HTMLInputElement.prototype, 'value').set;
  function openSlider(el) {
    sliderTarget = el;
    setHighlight(el);
    cursor.style.display = 'none';
    console.log('[Wizascript Controller] slider focused', el, 'value=', el.value, 'min=', el.min, 'max=', el.max, 'step=', el.step);
  }
  function closeSlider() {
    if (sliderTarget) clearHighlight(sliderTarget);
    sliderTarget = null;
  }
  function adjustSlider(dir) {
    if (!sliderTarget) return;
    const el = sliderTarget;
    const step = parseFloat(el.step) || 1;
    const min = el.min !== '' ? parseFloat(el.min) : -Infinity;
    const max = el.max !== '' ? parseFloat(el.max) : Infinity;
    let val = parseFloat(el.value) || 0;
    val = Math.max(min, Math.min(max, val + dir * step));
    nativeValueSetter.call(el, String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function setSliderValueFromPointer(el, clientX) {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const min = el.min !== '' ? parseFloat(el.min) : 0;
    const max = el.max !== '' ? parseFloat(el.max) : 100;
    const step = parseFloat(el.step) || 1;
    let frac = (clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    let val = min + frac * (max - min);
    val = Math.round(val / step) * step;
    val = Math.max(min, Math.min(max, val));
    nativeValueSetter.call(el, String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- native select picker control ---------- */
  let selectTarget = null, selectOptions = [], selectIndex = 0;
  function openSelectPicker(el) {
    selectTarget = el;
    selectOptions = Array.from(el.options);
    selectIndex = Math.max(0, selectOptions.findIndex(o => o.selected));

    const selCs = getComputedStyle(el);
    const selBg = selCs.backgroundColor;
    selectEl.style.background = (selBg && selBg !== 'rgba(0, 0, 0, 0)') ? selBg : '#000';
    selectEl.style.border = `${selCs.borderTopWidth} ${selCs.borderTopStyle} ${selCs.borderTopColor}`;
    selectEl.style.borderRadius = selCs.borderRadius;
    selectEl.style.fontFamily = selCs.fontFamily;
    selectEl.style.fontSize = selCs.fontSize;

    renderSelectOptions();
    selectEl.style.display = 'block';
    positionPanelNear(selectEl, el);
    updateSelectHighlight();
    cursor.style.display = 'block'; // cursor stays live for hover-to-select
    console.log('[Wizascript Controller] select picker opened', el, selectOptions.map(o => o.text));
  }
  function closeSelectPicker() {
    selectEl.style.display = 'none';
    selectTarget = null;
  }
  function confirmSelectPicker() {
    if (!selectTarget) return;
    const opt = selectOptions[selectIndex];
    if (opt) {
      selectTarget.value = opt.value;
      selectTarget.dispatchEvent(new Event('input', { bubbles: true }));
      selectTarget.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeSelectPicker();
  }

  /* ---------- submenu open/close ---------- */
  function activateHighlighted(button) {
    const el = currentFocusedEl();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    // Patch Maker's "Reset Data" needs its own double-press handling
    // instead of a plain click - checked and handled BEFORE the generic
    // dispatchClick below, which would otherwise fire a plain detail-less
    // click first.
    if (isPatchMakerResetButton(el)) { activatePatchMakerResetButton(el, cx, cy); return; }
    dispatchClick(el, cx, cy, button === 2 ? 2 : 0);
    // The controller preset picker (settings.js) is a fully custom
    // floating menu, not part of Underscript's own settings DOM - the
    // click above just opened it (synchronously, so it's already live by
    // this line if it opened). Trap the d-pad inside it via fieldSubmenu
    // rather than falling through to any of the generic handling below,
    // which would leave the fields-pane grid navigating underneath it.
    const openPresetMenu = getPresetMenuState();
    if (openPresetMenu) {
      fieldSubmenu = {
        items: openPresetMenu.rows,
        index: openPresetMenu.activeIndex,
        onConfirm: (item) => { if (item) triggerElementClick(item); },
        onCancel: () => openPresetMenu.close(),
        isAlive: () => !!getPresetMenuState()
      };
      return;
    }
    if (isNativeSelect(el)) { openSelectPicker(el); return; }
    if (isSlider(el)) { openSlider(el); return; }
    // `.uc-section-label` is only `contenteditable` for CUSTOM sections,
    // so isTextInput() correctly returns false for a non-custom one -
    // meaning it (and `.uc-card-item`, never contenteditable at all)
    // never goes through openOsk()'s own explicit `.focus()` call below,
    // and relies entirely on an explicit focus here instead, since
    // synthetic events don't reliably trigger a real input's native
    // click->focus behavior.
    if (el.matches && el.matches('.uc-section-label, .uc-card-item')) {
      el.focus();
      return;
    }
    // readOnly text-shaped inputs (this package's own controller-keybind/
    // preset capture widgets - click-to-capture, not click-to-type) need
    // a REAL explicit .focus() call to enter their own 'focus'-triggered
    // capture state, same "synthetic events don't reliably trigger
    // default browser actions" gap as above.
    if (el.readOnly && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      el.focus();
      return;
    }
    if (isTextInput(el)) {
      openOsk(el);
      if (el.isContentEditable) placeCaretAtPoint(el, cx, cy);
      return;
    }
    if (!activeSubmenu && el.classList.contains('dropdown-toggle')) {
      const items = findDropdownMenuNear(el);
      if (items.length) {
        activeSubmenu = { toggle: el, items, index: 0 };
        refreshHighlight();
      }
    }
  }
  function closeSubmenu() {
    if (!activeSubmenu) return;
    const toggle = activeSubmenu.toggle;
    activeSubmenu = null;
    const rect = toggle.getBoundingClientRect();
    dispatchClick(toggle, rect.left + rect.width / 2, rect.top + rect.height / 2, 0);
    refreshHighlight();
  }

  /* ---------- cursor / click plumbing ---------- */
  let x = pageWindow.innerWidth / 2, y = pageWindow.innerHeight / 2;
  let usingController = false;
  const BASE_SPEED = 24;
  const WHEEL_DELTA = 100;
  function dz(v) { return Math.abs(v) < 0.15 ? 0 : v; }

  function findRealScrollable(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    const root = document.scrollingElement || document.documentElement;
    if (root && root.scrollHeight > root.clientHeight) return root;
    return null;
  }
  // findRealScrollable() only ever looks UPWARD from a given element
  // through its ancestors - correct for "scroll whatever contains the
  // thing I'm focused on," but blind to a scrollable area that sits
  // elsewhere in the same dialog, as a SIBLING of whatever's currently
  // focused. This fallback searches the WHOLE dialog for its first
  // genuinely scrollable descendant, used only when walking up from the
  // focused item didn't already find one.
  function findScrollableDescendant(root) {
    if (!root) return null;
    const all = root.querySelectorAll('*');
    for (const node of all) {
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
  }
  // Shared by both the Channel Guide and the Settings dialog's fields
  // pane: after the right stick free-scrolls a list (see the ry-driven
  // reanchor blocks at each use site), the very next d-pad press should
  // pick up wherever the list visually IS now, not wherever the old
  // selection index used to point (which may well have scrolled off
  // screen by then - a d-pad move applied to a stale, off-screen index
  // and then `scrollIntoView`'d back into place is exactly what produced
  // the "d-pad send me back to the top" bug this exists to fix).
  // `rowEls` is an ordered top-to-bottom array of row elements;
  // `containerEl` is the actual scrollable viewport (its own
  // getBoundingClientRect() IS the visible area, since it's the element
  // with overflow-y:auto/scroll). Returns the index of the first row
  // still at least partially visible within that viewport.
  function topVisibleRowIndex(rowEls, containerEl) {
    if (!rowEls.length) return 0;
    if (!containerEl) return 0;
    const containerTop = containerEl.getBoundingClientRect().top;
    for (let i = 0; i < rowEls.length; i++) {
      if (rowEls[i] && rowEls[i].getBoundingClientRect().bottom > containerTop + 1) return i;
    }
    return rowEls.length - 1;
  }
  function fire(el, type, ctor, clientX, clientY, button, buttons) {
    const opts = {
      bubbles: true, cancelable: true, view: pageWindow,
      clientX, clientY, button: button || 0, buttons: buttons || 0
    };
    if (ctor === PointerEvent) { opts.pointerId = 1; opts.isPrimary = true; opts.pointerType = 'mouse'; }
    el.dispatchEvent(new ctor(type, opts));
  }
  function dispatchClick(el, cx, cy, button) {
    if (button === 2) {
      fire(el, 'pointerdown', PointerEvent, cx, cy, 2, 2);
      fire(el, 'mousedown', MouseEvent, cx, cy, 2, 2);
      fire(el, 'pointerup', PointerEvent, cx, cy, 2, 0);
      fire(el, 'mouseup', MouseEvent, cx, cy, 2, 0);
      fire(el, 'contextmenu', MouseEvent, cx, cy, 2, 0);
      return;
    }
    fire(el, 'pointerdown', PointerEvent, cx, cy, 0, 1);
    fire(el, 'mousedown', MouseEvent, cx, cy, 0, 1);
    fire(el, 'pointerup', PointerEvent, cx, cy, 0, 0);
    fire(el, 'mouseup', MouseEvent, cx, cy, 0, 0);
    fire(el, 'click', MouseEvent, cx, cy, 0, 0);
  }

  // Patch Maker's "Reset Data" button expects a real double-click
  // (`e.detail === 2`), not a separate `dblclick` listener - our
  // fire()/dispatchClick() never sets `detail` (defaults to 0), so no
  // synthetic click this script produces could satisfy `=== 2` on its
  // own. Reuses the same double-tap-window pattern as the OSK's L2/R2
  // edge-jump: the first press dispatches an ordinary detail:1 click
  // (harmless no-op against the real check, but still gives real click
  // feedback), and a second press within DOUBLE_TAP_WINDOW_MS dispatches
  // a click with `detail: 2` explicitly set. Identified by matching on
  // its own rendered text rather than any class/id (it has neither).
  function isPatchMakerResetButton(el) {
    return !!el && el.tagName === 'BUTTON' && el.textContent && el.textContent.trim() === 'Reset Data';
  }
  let lastResetBtnPressTime = 0;
  function activatePatchMakerResetButton(el, cx, cy) {
    const now = performance.now();
    const isConfirmPress = now - lastResetBtnPressTime < DOUBLE_TAP_WINDOW_MS;
    const detail = isConfirmPress ? 2 : 1;
    fire(el, 'pointerdown', PointerEvent, cx, cy, 0, 1);
    fire(el, 'mousedown', MouseEvent, cx, cy, 0, 1);
    fire(el, 'pointerup', PointerEvent, cx, cy, 0, 0);
    fire(el, 'mouseup', MouseEvent, cx, cy, 0, 0);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: pageWindow, clientX: cx, clientY: cy, button: 0, buttons: 0, detail }));
    lastResetBtnPressTime = isConfirmPress ? 0 : now; // reset after a completed pair so a 3rd press starts fresh
    console.log('[Wizascript Controller] Reset Data pressed, detail =', detail, isConfirmPress ? '(confirmed - resetting)' : '(press again to confirm)');
  }

  /* ---------- in-match action shortcuts ----------
     endTurnBtn / btn-config / both .btn-dustpile buttons are always
     present in the match HUD (just sometimes `disabled`, which a
     synthetic click already respects same as a real one). The concede
     button only exists in the DOM once the settings modal (a
     dynamically-created bootstrap-dialog) is actually open. */
  function triggerElementClick(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
  }
  // Prefers Underscript's OWN surrender mechanism (its custom overlay
  // menu's "Surrender" entry, `top: true` so it's always the first item)
  // over the old two-step native-UI dance - sends the surrender straight
  // over UC's own game socket, no confirm-dialog hunting needed.
  // Underscript's own `canSurrender()` guard (turn >= 5) is left as-is,
  // not worked around - clicking it before turn 5 just quietly does
  // nothing, which is Underscript's own intended behavior.
  // Falls back to the old native two-step flow (open Settings, poll for
  // the confirm dialog's own surrender button) only when Underscript's
  // menu never produces a "Surrender" entry at all.
  function triggerConcede() {
    const menu = document.querySelector('.menu-backdrop');
    const wasMenuOpen = !!(menu && getComputedStyle(menu).display !== 'none');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));

    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~0.5s at 60fps
    (function poll() {
      const items = Array.from(document.querySelectorAll('.menu-body li[role="button"]'));
      const surrenderLi = items.find((li) => /surrender/i.test((li.textContent || '').trim()));
      if (surrenderLi) {
        triggerElementClick(surrenderLi);
        console.log('[Wizascript Controller] concede: used Underscript\'s own Surrender menu entry');
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) { requestAnimationFrame(poll); return; }
      console.log('[Wizascript Controller] concede: no Surrender entry found in Underscript\'s menu, falling back to the native flow');
      if (!wasMenuOpen) document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
      triggerConcedeNative();
    })();
  }
  function triggerConcedeNative() {
    const existing = document.querySelector('.btn-danger[onclick*="askSurrender"]');
    if (existing) { triggerElementClick(existing); return; }

    const configBtn = document.getElementById('btn-config');
    if (!configBtn) {
      console.log('[Wizascript Controller] concede: settings button not found (not in a match?)');
      return;
    }
    triggerElementClick(configBtn);

    // The settings modal's content does not mount synchronously with the
    // click - poll across a few animation frames instead of assuming
    // it's there on the very next line.
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~0.5s at 60fps
    (function poll() {
      const btn = document.querySelector('.btn-danger[onclick*="askSurrender"]');
      if (btn) { triggerElementClick(btn); return; }
      attempts++;
      if (attempts < MAX_ATTEMPTS) requestAnimationFrame(poll);
      else console.log('[Wizascript Controller] concede: gave up waiting for the surrender button after opening settings');
    })();
    // Leaves the resulting "are you sure?" confirmation dialog for the
    // generic modal handler to d-pad-navigate (or, worst case, the free
    // cursor), same as any other bootstrap-dialog.
  }

  const drag = { left: null, right: null };
  function beginPress(side, button) {
    cursor.style.display = 'none';
    const hitEl = document.elementFromPoint(x, y);
    cursor.style.display = 'block';
    if (!hitEl) return;
    drag[side] = { downEl: hitEl };
    if (button === 2) {
      fire(hitEl, 'pointerdown', PointerEvent, x, y, 2, 2);
      fire(hitEl, 'mousedown', MouseEvent, x, y, 2, 2);
    } else {
      fire(hitEl, 'pointerdown', PointerEvent, x, y, 0, 1);
      fire(hitEl, 'mousedown', MouseEvent, x, y, 0, 1);
    }
  }
  function continuePress(side, button) {
    if (!drag[side]) return;
    cursor.style.display = 'none';
    const hitEl = document.elementFromPoint(x, y);
    cursor.style.display = 'block';
    if (!hitEl) return;
    if (button === 2) {
      fire(hitEl, 'pointermove', PointerEvent, x, y, 2, 2);
      fire(hitEl, 'mousemove', MouseEvent, x, y, 2, 2);
    } else {
      fire(hitEl, 'pointermove', PointerEvent, x, y, 0, 1);
      fire(hitEl, 'mousemove', MouseEvent, x, y, 0, 1);
    }
  }
  function endPress(side, button) {
    const state = drag[side];
    drag[side] = null;
    if (!state) return;
    cursor.style.display = 'none';
    const hitEl = document.elementFromPoint(x, y);
    cursor.style.display = 'block';
    if (!hitEl) return;
    if (button === 2) {
      fire(hitEl, 'pointerup', PointerEvent, x, y, 2, 0);
      fire(hitEl, 'mouseup', MouseEvent, x, y, 2, 0);
      if (hitEl === state.downEl) fire(hitEl, 'contextmenu', MouseEvent, x, y, 2, 0);
    } else {
      fire(hitEl, 'pointerup', PointerEvent, x, y, 0, 0);
      fire(hitEl, 'mouseup', MouseEvent, x, y, 0, 0);
      if (hitEl === state.downEl) fire(hitEl, 'click', MouseEvent, x, y, 0, 0);
    }
  }

  /* ---------- curated hover-CSS engine ---------- */
  function collectHoverRules() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      let cssRules;
      try { cssRules = sheet.cssRules; } catch (e) { continue; }
      if (!cssRules) continue;
      for (const rule of cssRules) {
        if (!rule.selectorText || !rule.selectorText.includes(':hover')) continue;
        for (const part of rule.selectorText.split(',')) {
          const trimmed = part.trim();
          if (!trimmed.includes(':hover')) continue;
          const base = trimmed.replace(/:hover/g, '').trim();
          if (base) rules.push({ selector: base, style: rule.style });
        }
      }
    }
    return rules;
  }
  const hoverRules = collectHoverRules();
  const hoverStyleMap = new Map();
  function resolveHoverStyle(el) {
    const finalProps = new Map();
    for (const { selector, style } of hoverRules) {
      try { if (!el.matches(selector)) continue; } catch (e) { continue; }
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        finalProps.set(prop, [style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
      }
    }
    if (!finalProps.size) return;
    const originalProps = Array.from(finalProps.keys()).map(prop =>
      [prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    hoverStyleMap.set(el, {
      finalProps: Array.from(finalProps.entries()).map(([p, [v, pr]]) => [p, v, pr]),
      originalProps
    });
  }
  [navbarGroup, footbarGroup].filter(Boolean).forEach(g => {
    g.container.querySelectorAll('a').forEach(item => {
      resolveHoverStyle(item);
      item.querySelectorAll('img').forEach(resolveHoverStyle);
    });
  });
  console.log(`[Wizascript Controller] resolved hover styles for ${hoverStyleMap.size} curated element(s)`);

  function findHoverTarget(el) {
    if (!el) return null;
    if (hoverStyleMap.has(el)) return el;
    const link = el.closest && el.closest('a');
    if (link && hoverStyleMap.has(link)) return link;
    return null;
  }
  function applyCuratedHover(el) {
    const entry = hoverStyleMap.get(el);
    if (!entry) return;
    for (const [prop, val, pr] of entry.finalProps) el.style.setProperty(prop, val, pr);
  }
  function revertCuratedHover(el) {
    const entry = hoverStyleMap.get(el);
    if (!entry) return;
    for (const [prop, val, pr] of entry.originalProps) {
      if (val) el.style.setProperty(prop, val, pr); else el.style.removeProperty(prop);
    }
  }
  let hoverActiveEl = null;
  function setHoverTarget(target) {
    if (target === hoverActiveEl) return;
    if (hoverActiveEl) revertCuratedHover(hoverActiveEl);
    if (target) applyCuratedHover(target);
    hoverActiveEl = target;
  }
  let lastHitEl = null;
  function updateHover(el, cx, cy) {
    if (el !== lastHitEl) {
      if (lastHitEl) {
        fire(lastHitEl, 'pointerout', PointerEvent, cx, cy, 0, 0);
        fire(lastHitEl, 'mouseout', MouseEvent, cx, cy, 0, 0);
        fire(lastHitEl, 'pointerleave', PointerEvent, cx, cy, 0, 0);
        fire(lastHitEl, 'mouseleave', MouseEvent, cx, cy, 0, 0);
      }
      if (el) {
        fire(el, 'pointerover', PointerEvent, cx, cy, 0, 0);
        fire(el, 'mouseover', MouseEvent, cx, cy, 0, 0);
        fire(el, 'pointerenter', PointerEvent, cx, cy, 0, 0);
        fire(el, 'mouseenter', MouseEvent, cx, cy, 0, 0);
      }
      lastHitEl = el;
    }
    if (el) {
      fire(el, 'pointermove', PointerEvent, cx, cy, 0, 0);
      fire(el, 'mousemove', MouseEvent, cx, cy, 0, 0);
    }
    const focused = currentFocusedEl();
    setHoverTarget(findHoverTarget(focused || el));
  }

  /* ---------- mouse/controller exclusivity ----------
     Any real, trusted mouse movement hands control back to the mouse, so
     the two input methods don't fight each other. */
  document.addEventListener('mousemove', (e) => {
    if (!e.isTrusted) return;
    if (usingController) {
      console.log('[Wizascript Controller] real mouse movement detected -> forcing usingController OFF');
    }
    usingController = false;
    document.documentElement.style.cursor = '';
    cursor.style.display = 'none';
    // A real mouse taking over should also let go of whatever the d-pad
    // had highlighted, instead of leaving a stale outline glued to an
    // element the player is no longer paying attention to.
    if (currentHighlightedEl) { clearHighlight(currentHighlightedEl); currentHighlightedEl = null; }
  }, true);

  /* ---------- main loop ---------- */
  let dpadHeld = { up: false, down: false, left: false, right: false };
  let btnHeld = {};
  let shortcutBtnHeld = {}; // dedicated held-state for R1/Circle's own global meanings, kept separate from whatever any mode branch does with the shared btnHeld object
  // Held-state for the remappable hardware shortcuts, keyed by action key
  // rather than button number - the bound button can change at runtime
  // (user remaps it in settings), so tracking by number would leave a
  // stale entry under the old number and never arm under the new one.
  let shortcutHeldByAction = {};
  function shortcutJustPressed(btnFn, actionKey) {
    const boundBtn = getBoundShortcutButton(actionKey);
    const isDown = boundBtn !== null && !!btnFn(boundBtn);
    const wasDown = !!shortcutHeldByAction[actionKey];
    shortcutHeldByAction[actionKey] = isDown;
    return isDown && !wasDown;
  }
  // Dedicated held-state for the Wizascript-keybind relay below, reset to
  // all-false every frame the relay button isn't held, so a fresh press
  // always starts clean. `controlDown` tracks whether the synthetic
  // Control keydown is currently "logically" held on Wizascript's behalf -
  // decoupled from the physical button so the channel guide can stay open
  // (and Control stay synthetically down) after the physical button is
  // released. `left`/`right`/`up`/`down`/`0` are gone - guide navigation
  // now lives in its own independent mode section with its own edge
  // trackers (guideDpadHeld/guideBtn0Held) below.
  let keybindRelayHeld = { primary: false, controlDown: false, actions: {} };
  // Tracks whether any real action fired during the current Controller
  // Primary hold - false all the way through means it was a bare tap,
  // which either cycles a focused Patch Maker entry's category forward by
  // one (if one is focused) or toggles the channel guide open/closed
  // (everywhere else).
  let primaryHoldHadAction = false;
  // UC TV channel guide state - back to a HOLD design (see the "Channel
  // Guide" relay section below), but now gated on its own dedicated,
  // separately remappable button (default Unbound) rather than Controller
  // Primary. Holding Primary AND holding the guide button are fully
  // independent physical gestures now, so Previous/Next Channel (a
  // Primary+<button> combo) can never collide with the guide's own d-pad
  // navigation no matter what either is bound to - the round-B tap-toggle
  // design is retired; this only needed a dedicated button, not a new
  // gesture. `guideMatchIndex`/`guidePlayerIndex` replace the old flat
  // `guideSelectedIndex`: up/down now moves between MATCHES, left/right
  // alternates between that match's two players, instead of flattening
  // every player span into one list where both axes did the same thing.
  let guideMatchIndex = -1, guidePlayerIndex = 0, guideSelectedEl = null;
  // Edge-state for the guide's own d-pad/X navigation, tracked separately
  // from every other d-pad consumer (dpadHeld/keybindRelayHeld).
  let guideDpadHeld = { up: false, down: false, left: false, right: false };
  let guideBtn0Held = false;
  // Armed the moment the right stick free-scrolls the guide list - see
  // the ry handling below and topVisibleRowIndex()'s own comment. While
  // true, the list is considered "unfocused" (no highlighted match/
  // player - it wouldn't mean anything once scrolled off screen), and
  // the next d-pad press re-anchors to whatever's now topmost-visible
  // instead of moving from the old, possibly off-screen match index.
  let guideNeedsReanchor = false;
  let leftHeldSince = 0, rightHeldSince = 0, lastPageTurnTime = 0;
  let dpadText = '';
  // The controller equivalent of Wizascript's real "double-tap Primary"
  // shortcut - relays the same real-world SIGNAL a keyboard double-tap
  // produces and lets Wizascript's own already-working double-tap
  // detector do the rest, rather than reimplementing "open the settings
  // panel" here. Matches packages/core/keybinds.js's real default Primary
  // (Control, matched via e.key since it's a native modifier at its
  // shipped default) and its DOUBLE_TAP_WINDOW_MS (400ms, keydown-to-
  // keydown). A keydown while Primary is already "held" is treated as OS
  // key-repeat and ignored by that real listener, so a real release has
  // to land between the two dispatched taps for the second to register.
  //
  // KNOWN LIMITATION: this only works while the real Primary Key setting
  // is still at its shipped default (Control). If the user has remapped
  // it away from Control via Wizascript's own real Keybinds settings,
  // matching there switches to a strict `e.code` check against whatever
  // they remapped it to - this relay has no way to know that without
  // reading keybinds.js's own GM-stored value directly, which it
  // deliberately doesn't reach into (that's a private implementation
  // detail of another package, not something this one should couple to).
  function openWizascriptSettings() {
    const base = { key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, bubbles: true };
    document.dispatchEvent(new KeyboardEvent('keydown', base));
    requestAnimationFrame(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', base));
      requestAnimationFrame(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', base));
        requestAnimationFrame(() => {
          document.dispatchEvent(new KeyboardEvent('keyup', base));
        });
      });
    });
    console.log('[Wizascript Controller] relayed a real Primary (Control) double-tap for Wizascript settings');
  }

  function frame() {
    try {
      // Debug HUD visibility follows its own toggle every frame,
      // independent of (and checked before) the Controller Support gate
      // right below - so flipping "Enable Debug Text" off hides it
      // immediately even if Controller Support was just turned off in the
      // same moment, rather than leaving a stale readout on screen.
      hud.style.display = isDebugTextEnabled() ? 'block' : 'none';

      // Master gate: while Controller Support is off, skip gamepad
      // polling and every DOM read/write below entirely. If it was
      // actively driving things a moment ago (user just flipped it off),
      // clean up once instead of leaving a stuck cursor/hidden native
      // pointer/open OSK behind.
      if (!isControllerSupportEnabled()) {
        if (usingController) {
          usingController = false;
          document.documentElement.style.cursor = '';
          cursor.style.display = 'none';
          if (oskOpen) closeOsk();
        }
        return;
      }

      // Diagnostic - logs raw per-pad state (throttled, only when
      // something's actually pressed/moved) whether or not the merge
      // below ends up finding anything usable.
      logRawGamepadStateIfChanged();

      // Merged across every connected pad instead of only ever reading
      // slot 0 - see getMergedGamepad() in gamepad.js.
      const gp = getMergedGamepad();
      if (!gp) return;

      const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]);
      const rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
      const up = gp.buttons[12] && gp.buttons[12].pressed;
      const down = gp.buttons[13] && gp.buttons[13].pressed;
      const left = gp.buttons[14] && gp.buttons[14].pressed;
      const right = gp.buttons[15] && gp.buttons[15].pressed;
      const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;

      const anyStick = lx || ly || rx || ry;
      const anyButton = gp.buttons.some(b => b.pressed);

      // Tracks which kind of directional input most recently drove
      // navigation - used by the resolve/choice modal to decide whether
      // ITS synthetic outline should be showing at all.
      if (anyStick) navInputMethod = 'stick';
      else if (up || down || left || right) navInputMethod = 'dpad';

      if (anyStick || anyButton) {
        if (!usingController) {
          usingController = true;
          document.documentElement.style.cursor = 'none';
          if (!oskOpen && !sliderTarget && !selectTarget) cursor.style.display = cursorRestingDisplay();
        }
      }

      // Edge-triggered log of the MERGED/CALIBRATED state this loop is
      // actually acting on, plus the on-screen indicator flash - the
      // missing half of the diagnostic picture beyond the raw per-pad dump
      // above.
      logMergedInputEdges(gp, usingController, anyStick);

      if (!usingController) return;

      /* ---------- global in-match hardware shortcuts ----------
         Run right after the usingController gate so they always fire
         every frame regardless of which mode branch is about to handle
         the rest of the frame - every match-mode/modal/OSK branch below
         ends in `return`, so anything living further down would silently
         go dead the instant one of those branches claims the frame. */
      // R1 toggles the OSK's "paused" state whenever the OSK is open
      // (instead of its usual Underscript-menu toggle) - reuses
      // Underscript's own built-in "Open Menu" hotkey (a synthetic Escape
      // keyup) when the OSK isn't open, rather than reaching into
      // Underscript's closures directly.
      if (btn(5) && !shortcutBtnHeld[5]) {
        if (oskOpen) {
          oskPaused = !oskPaused;
          oskEl.style.display = oskPaused ? 'none' : 'block';
          if (!oskPaused && oskTarget) { positionPanelNear(oskEl, oskTarget); updateOskHighlight(); }
          console.log('[Wizascript Controller] OSK', oskPaused ? 'paused' : 'resumed');
        } else {
          document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
        }
      }
      // While paused, Circle closes the OSK entirely (same real
      // blur-then-clear as the OSK's own Circle binding) without first
      // needing to un-pause via R1.
      if (btn(1) && !shortcutBtnHeld[1] && oskOpen && oskPaused) closeOsk();
      // The 8 shortcuts below are remappable via "Keybinds - Controller"
      // > "— In-Game Inputs —" (see settings.js). Edge-triggering is
      // done by shortcutJustPressed(), which reads the CURRENT bound
      // button every frame instead of a hardcoded number - shortcutBtnHeld
      // stays reserved for R1/button-5 and Circle/button-1 only, which
      // are deliberately still fixed (R1 doubles as the OSK-pause toggle
      // using the exact same physical button unconditionally).
      if (shortcutJustPressed(btn, 'openSettings')) triggerElementClick(document.getElementById('btn-config'));
      // Guarded on !oskOpen since L3/R3 (their default buttons) are ALSO
      // the OSK's own local symbols-toggle/send bindings while it's open.
      if (shortcutJustPressed(btn, 'yourDustpile') && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(true)"]'));
      if (shortcutJustPressed(btn, 'opponentDustpile') && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(false)"]'));
      if (shortcutJustPressed(btn, 'endTurn')) triggerElementClick(document.getElementById('endTurnBtn'));
      if (shortcutJustPressed(btn, 'openWizascriptSettings') && !oskOpen) openWizascriptSettings();
      if (shortcutJustPressed(btn, 'concede')) triggerConcede();
      if (shortcutJustPressed(btn, 'goHome')) pageWindow.location.href = 'https://undercards.net/';
      // Deck Tracker's own "Add Tracker Preset" picker (packages/deck-
      // tracker/index.js) otherwise only opens via a real mouse click on
      // its floating button (`#dt-add-tracker-button`) - defaults to ZL
      // (button 6), free in every existing preset (nothing else defaults
      // there). Guarded on !oskOpen for the same reason as the dustpile
      // checks above (shared default-button space with the OSK's own
      // local bindings while it's open).
      if (shortcutJustPressed(btn, 'openDeckTrackerPresets') && !oskOpen) triggerElementClick(document.getElementById('dt-add-tracker-button'));
      shortcutBtnHeld = { 1: btn(1), 5: btn(5) };

      /* ---------- Controller Primary relay ----------
         Rather than hand-rolling double-tap/hold-alone timing again the
         way the hardware-shortcut R2 default does for just one action,
         Primary relays REAL, continuous Control press/release state
         straight onto `document` - a genuine keydown the instant it goes
         down, a genuine keyup the instant it comes back up. Confirmed
         from Wizascript's real keybinds.js: hold-alone (250ms),
         double-tap (400ms between keydowns), and every Primary+<key>
         combo are ALL just consequences of genuine Control press/release
         timing on Wizascript's own end, not something this relay needs
         to reimplement per feature.

         While Primary is held, the CONTROLLER_ACTIONS table (see
         settings.js) drives every Primary+<button> combo generically -
         `context` decides which subset applies this frame
         (channelSwitch/patchMaker/default/always), matching the exact
         priority order Wizascript's own UC TV/Notepad/Patch Maker
         bindings expect. Actions sharing both the same bound button AND
         the same dispatch code are de-duped so holding one button
         doesn't fire the same key event twice in one frame.

         The UC TV channel guide is NOT part of this relay any more - it
         has its own dedicated, separately remappable hold button (see the
         "Channel Guide" section right after this one). The synthetic
         Control keydown/keyup dispatch below is shared between the two
         (`keybindRelayHeld.controlDown` tracks whichever of "Primary
         physically held" / "Channel Guide button physically held" is
         true), so holding EITHER keeps Control logically down, and
         holding both at once then releasing only one doesn't send a
         stray keyup and desync Wizascript's own real primaryHeld
         tracking in keybinds.js. */
      if (!oskOpen || oskPaused) {
        const primaryBtn = getControllerPrimaryButton();
        const l1Down = (primaryBtn !== null && btn(primaryBtn)) || (oskOpen && oskPaused);
        const viaPause = oskOpen && oskPaused;
        const primaryBase = { key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, bubbles: true };
        const guideBtnForRelay = getChannelGuideButton();
        const guideDownForRelay = guideBtnForRelay !== null && btn(guideBtnForRelay);

        if (l1Down) {
          if (!keybindRelayHeld.primary) primaryHoldHadAction = false;
        } else if (keybindRelayHeld.primary) {
          // A bare Controller Primary tap (nothing else fired during the
          // hold) while a Patch Maker `.uc-li-text` entry is focused
          // cycles the entry's category forward by one - reproduced
          // directly against the DOM (matching cycleCategory()'s own
          // known effect: swap the class off PATCH_MAKER_CYCLE_ORDER on
          // the entry's `<li>`, then force a real saveState() via
          // blur()+focus(), since that private closure is only reachable
          // through the field's own blur handler) rather than trying to
          // trigger Wizascript's own Cycle Category keybind, which this
          // relay has no way to invoke directly. Every other bare tap is
          // a no-op now that the channel guide has its own button.
          if (!primaryHoldHadAction) {
            const tapFocusEl = document.activeElement;
            if (tapFocusEl && tapFocusEl.matches && tapFocusEl.matches('.uc-li-text')) {
              const li = tapFocusEl.closest('li');
              if (li) {
                const PATCH_MAKER_CYCLE_ORDER = ['none', 'other', 'buff', 'rework', 'nerf'];
                const curIdx = PATCH_MAKER_CYCLE_ORDER.findIndex((c) => li.classList.contains(c));
                const nextCat = PATCH_MAKER_CYCLE_ORDER[((curIdx === -1 ? 0 : curIdx) + 1) % PATCH_MAKER_CYCLE_ORDER.length];
                li.classList.remove(...PATCH_MAKER_CYCLE_ORDER);
                li.classList.add(nextCat);

                let savedRange = null;
                const sel = pageWindow.getSelection();
                if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
                tapFocusEl.blur(); // real saveState() runs inside Patch Maker's own blur handler
                tapFocusEl.focus();
                if (savedRange) {
                  try {
                    const sel2 = pageWindow.getSelection();
                    sel2.removeAllRanges();
                    sel2.addRange(savedRange);
                  } catch (e) {
                    // Range can go stale if blur's own sanitizeText()
                    // actually changed the text - not fatal, only the
                    // exact caret position resets.
                  }
                }
                console.log('[Wizascript Controller] Patch Maker: bare Controller Primary tap - cycled entry category directly to "' + nextCat + '"');
              }
            }
          }
        }

        // Shared reconciliation - see the comment above this block for
        // why Primary and the Channel Guide button both feed into the
        // same controlDown tracker instead of each dispatching their own
        // independent keydown/keyup pair.
        const controlShouldBeDown = l1Down || guideDownForRelay;
        if (controlShouldBeDown && !keybindRelayHeld.controlDown) {
          document.dispatchEvent(new KeyboardEvent('keydown', primaryBase));
          keybindRelayHeld.controlDown = true;
        } else if (!controlShouldBeDown && keybindRelayHeld.controlDown) {
          document.dispatchEvent(new KeyboardEvent('keyup', primaryBase));
          keybindRelayHeld.controlDown = false;
        }

        if (l1Down) {
          const relaySecondary = (code, key) => {
            const opts = { key, code, bubbles: true };
            document.dispatchEvent(new KeyboardEvent('keydown', opts));
            document.dispatchEvent(new KeyboardEvent('keyup', opts));
          };

          const pmFocusForContext = document.activeElement;
          const inPatchMakerFieldForContext = !!(pmFocusForContext && pmFocusForContext.matches &&
            pmFocusForContext.matches('.uc-li-text, .uc-section-label, .uc-card-item'));
          const nextActionHeld = {};
          const codesFiredThisFrame = new Set();
          CONTROLLER_ACTIONS.forEach((action) => {
            let applies;
            if (action.context === 'always') applies = true;
            else if (action.context === 'channelSwitch') applies = !inPatchMakerFieldForContext;
            else if (action.context === 'patchMaker') applies = inPatchMakerFieldForContext;
            else /* 'default' */ applies = !inPatchMakerFieldForContext;

            const boundBtn = applies ? getBoundButton(action.key) : null;
            const isDown = boundBtn !== null && btn(boundBtn);
            nextActionHeld[action.key] = isDown;
            if (isDown && !keybindRelayHeld.actions[action.key]) {
              const sig = action.dispatch.code;
              if (!codesFiredThisFrame.has(sig)) {
                codesFiredThisFrame.add(sig);
                relaySecondary(action.dispatch.code, action.dispatch.key);
                primaryHoldHadAction = true;
              }
            }
          });
          keybindRelayHeld.actions = nextActionHeld;

          hud.textContent = inPatchMakerFieldForContext
            ? `Patch Maker (${viaPause ? 'OSK paused' : 'Primary held'})\ntap Primary alone = cycle category   move entry-section-card — see Settings > Keybinds - Controller${viaPause ? `\nR1: resume typing   ${btnLabel(1)}: close` : ''}`
            : `Wizascript keybind relay (${viaPause ? 'OSK paused' : 'Primary held'})\nchannel / notepad redo-undo-toggle-reset — see Settings > Keybinds - Controller${viaPause ? `\nR1: resume typing   ${btnLabel(1)}: close` : ''}`;
        } else {
          keybindRelayHeld.actions = {};
        }

        keybindRelayHeld.primary = l1Down;
        if (l1Down) return;
      }

      /* ---------- Channel Guide (dedicated hold button) ----------
         Back to a HOLD design (per request), but no longer sharing
         Controller Primary at all - a separate, independently
         remappable button (default Unbound, see settings.js's
         getChannelGuideButton()/setChannelGuideButton()) that the user
         must explicitly bind. Holding it relays the same real synthetic
         Control press/release Wizascript's own UC TV channel guide
         already reacts to (packages/uc-tv/channel-guide.js's
         onPrimaryAlone/onPrimaryRelease via packages/core/keybinds.js's
         real 250ms hold-alone/release model - see the shared
         controlShouldBeDown reconciliation above), just gated on a
         different physical button - so it can never collide with any
         Primary+<button> combo (including Previous/Next Channel)
         regardless of what either is bound to, without needing any
         guide-specific exclusion logic in CONTROLLER_ACTIONS at all.

         The guide has no keyboard nav of its own - each match is one
         `row` <div> containing 1-2 plain `<span>` "playerEl" elements
         (one per player) with only click/mouseenter/mouseleave
         listeners. Up/Down moves between MATCHES; Left/Right alternates
         between that match's players (clamped, not wrapped - a match
         with only one listed player just ignores Left/Right). Whichever
         player span is currently selected gets a real mouseenter/
         mouseleave pair (matching the guide's own hover-underline
         styling) and X dispatches a real click on it - unchanged from
         before, only the navigation scheme changed. */
      if (!oskOpen || oskPaused) {
        const guideBtn = getChannelGuideButton();
        const guideDown = guideBtn !== null && btn(guideBtn);

        if (guideDown) {
          const guideEl = document.getElementById('uctv-guide-overlay');
          if (!guideEl) {
            // Real gap between "button held" and "overlay actually
            // mounted" - keybinds.js's own 250ms hold-alone delay plus
            // showChannelGuide()'s async fetch. Matches the ORIGINAL
            // pre-toggle design: keep claiming the frame (below) so the
            // free cursor doesn't flicker back on for a fraction of a
            // second, same as holding Primary always used to do
            // regardless of what it was about to show.
            hud.textContent = `UC TV Guide loading…\nrelease ${buttonToDisplay(guideBtn)} to cancel`;
          } else {
            const playerSpans = Array.from(guideEl.querySelectorAll('span')).filter((el) => el.style.cursor === 'pointer');
            const matches = [];
            const rows = [];
            const rowIndex = new Map();
            playerSpans.forEach((el) => {
              const row = el.parentElement;
              if (!rowIndex.has(row)) { rowIndex.set(row, matches.length); matches.push([]); rows.push(row); }
              matches[rowIndex.get(row)].push(el);
            });

            if (!matches.length) {
              guideMatchIndex = -1;
              guidePlayerIndex = 0;
              guideSelectedEl = null;
              guideNeedsReanchor = false;
              hud.textContent = `UC TV Guide\nno matches shown\nrelease ${buttonToDisplay(guideBtn)} to close`;
            } else {
              // Right stick free-scrolls the list independently of the
              // d-pad selection - lets you fly straight to the bottom of
              // a long list instead of walking there one match at a
              // time. Any nonzero tilt drops the current highlight (a
              // highlighted match/player wouldn't mean anything once
              // it's scrolled off screen) and arms guideNeedsReanchor,
              // so the very next d-pad press picks up at whatever's now
              // topmost-visible instead of jumping back to the old index.
              if (ry !== 0) {
                guideEl.scrollTop += ry * 30;
                if (guideSelectedEl) {
                  guideSelectedEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                  guideSelectedEl = null;
                }
                guideMatchIndex = -1;
                guideNeedsReanchor = true;
              }

              const dpadPressed = (up && !guideDpadHeld.up) || (down && !guideDpadHeld.down) ||
                (left && !guideDpadHeld.left) || (right && !guideDpadHeld.right);

              if (guideNeedsReanchor && !dpadPressed) {
                // Scrolled, but no fresh d-pad press has landed yet -
                // stay unfocused (no highlighted row) rather than
                // guessing at one.
                guideDpadHeld = { up, down, left, right };
                guideBtn0Held = btn(0);
                hud.textContent = `UC TV Guide\n(scrolled - press ↑↓←→ to resume navigating)\nrelease ${buttonToDisplay(guideBtn)} to close`;
                return;
              }

              let justReanchored = false;
              if (guideNeedsReanchor && dpadPressed) {
                guideMatchIndex = topVisibleRowIndex(rows, guideEl);
                guidePlayerIndex = 0;
                guideNeedsReanchor = false;
                justReanchored = true;
              }

              if (guideMatchIndex < 0 || guideMatchIndex >= matches.length) { guideMatchIndex = 0; guidePlayerIndex = 0; }
              if (!justReanchored) {
                if (up && !guideDpadHeld.up) { guideMatchIndex = Math.max(0, guideMatchIndex - 1); guidePlayerIndex = 0; }
                if (down && !guideDpadHeld.down) { guideMatchIndex = Math.min(matches.length - 1, guideMatchIndex + 1); guidePlayerIndex = 0; }
              }

              const playersInMatch = matches[guideMatchIndex];
              guidePlayerIndex = Math.min(guidePlayerIndex, playersInMatch.length - 1);
              if (!justReanchored) {
                if (left && !guideDpadHeld.left) guidePlayerIndex = Math.max(0, guidePlayerIndex - 1);
                if (right && !guideDpadHeld.right) guidePlayerIndex = Math.min(playersInMatch.length - 1, guidePlayerIndex + 1);
              }

              const sel = playersInMatch[guidePlayerIndex];
              if (sel !== guideSelectedEl) {
                if (guideSelectedEl) guideSelectedEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                sel.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                sel.scrollIntoView({ block: 'nearest' });
                guideSelectedEl = sel;
              }
              if (btn(0) && !guideBtn0Held) sel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

              hud.textContent = `UC TV Guide\nmatch ${guideMatchIndex + 1}/${matches.length}${playersInMatch.length > 1 ? `   player ${guidePlayerIndex + 1}/${playersInMatch.length}` : ''}\n↑/↓ match   ←/→ player   ${btnLabel(0)} jump   release ${buttonToDisplay(guideBtn)} to close`;
            }
          }
          guideDpadHeld = { up, down, left, right };
          guideBtn0Held = btn(0);
          return;
        } else {
          guideMatchIndex = -1;
          guidePlayerIndex = 0;
          guideSelectedEl = null;
          guideNeedsReanchor = false;
        }
      }

      /* ---------- Notepad pen-size / lightness sliders ----------
         The drawing Notepad is a floating overlay entirely independent of
         match/modal state, so none of the mode branches below know it
         exists. Its brush-size slider and its two HSL lightness sliders
         are all real `<input type="range">` elements, so once one of
         them becomes sliderTarget the existing slider-adjustment block
         further below already handles it correctly. The actual gap is
         narrower than a whole new nav mode: nothing ever CALLS
         openSlider() on these two, since they sit outside both places
         that currently do (the generic-modal grid's activateHighlighted,
         and the out-of-match free-cursor hit-test at the very bottom of
         this function, which never runs while a match/mulligan/modal has
         already claimed the frame). This hit-tests the free cursor's own
         last-known position against these specific sliders every frame,
         this early, before any mode below can early-return past it. */
      if (!oskOpen && !sliderTarget && !selectTarget && btn(0)) {
        cursor.style.display = 'none';
        const notepadHitEl = document.elementFromPoint(x, y);
        cursor.style.display = 'block';
        if (notepadHitEl && isSlider(notepadHitEl) && notepadHitEl.closest('.wizascript-notepad')) {
          openSlider(notepadHitEl);
          return;
        }
      }

      if (oskOpen && !oskPaused) {
        // Keep the free cursor live so a key can be hovered+pressed
        // directly instead of only being reachable via d-pad. Hover only
        // overrides oskRow/oskCol on frames where the stick actually
        // moved so it doesn't fight d-pad browsing while the cursor is
        // just resting over some key.
        const oskSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * oskSpeedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * oskSpeedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = 'block';

        if (lx || ly) {
          hoverKey:
          for (let r = 0; r < oskRowEls.length; r++) {
            for (let c = 0; c < oskRowEls[r].length; c++) {
              const kr = oskRowEls[r][c].getBoundingClientRect();
              if (x >= kr.left && x <= kr.right && y >= kr.top && y <= kr.bottom) {
                if (oskRow !== r || oskCol !== c) { oskRow = r; oskCol = c; updateOskHighlight(); }
                break hoverKey;
              }
            }
          }
        }

        const row = activeRows[oskRow];
        if (up && !dpadHeld.up) { oskRow = Math.max(0, oskRow - 1); oskCol = Math.min(oskCol, activeRows[oskRow].length - 1); updateOskHighlight(); }
        if (down && !dpadHeld.down) { oskRow = Math.min(activeRows.length - 1, oskRow + 1); oskCol = Math.min(oskCol, activeRows[oskRow].length - 1); updateOskHighlight(); }
        if (left && !dpadHeld.left) { oskCol = (oskCol - 1 + row.length) % row.length; updateOskHighlight(); }
        if (right && !dpadHeld.right) { oskCol = (oskCol + 1) % row.length; updateOskHighlight(); }
        dpadHeld = { up, down, left, right };

        if (btn(0) && !btnHeld[0]) pressKey(activeRows[oskRow][oskCol]);
        if (btn(2) && !btnHeld[2] && oskTarget) typeBackspace(oskTarget);
        if (btn(3) && !btnHeld[3] && oskTarget) typeChar(oskTarget, ' ');
        // L1 keeps its local meaning here (Shift toggle) - the global
        // Primary-held relay above is explicitly guarded with `!oskOpen`
        // so it never reaches this branch at all while the keyboard is
        // open.
        if (btn(4) && !btnHeld[4]) { oskShift = !oskShift; renderOskLabels(); }
        // L2/R2: real caret navigation. Single tap steps the caret one
        // character left/right; a tap within DOUBLE_TAP_WINDOW_MS of the
        // previous tap of the SAME button jumps straight to the field's
        // start/end instead.
        if (btn(6) && !btnHeld[6]) {
          const now = performance.now();
          if (now - lastL2TapTime < DOUBLE_TAP_WINDOW_MS) setOskCaretEdge(true);
          else stepOskCaret(-1);
          lastL2TapTime = now;
        }
        if (btn(7) && !btnHeld[7]) {
          const now = performance.now();
          if (now - lastR2TapTime < DOUBLE_TAP_WINDOW_MS) setOskCaretEdge(false);
          else stepOskCaret(1);
          lastR2TapTime = now;
        }
        if (btn(10) && !btnHeld[10]) {
          oskPage = oskPage === 'letters' ? 'symbols' : 'letters';
          activeRows = KEY_PAGES[oskPage];
          buildGrid(activeRows);
          oskRow = 0; oskCol = 0;
          if (oskTarget) positionPanelNear(oskEl, oskTarget);
          updateOskHighlight();
        }
        if (btn(11) && !btnHeld[11] && oskTarget) dispatchEnterKey(oskTarget);
        // Circle also blurs the real target on close so any save-on-blur
        // handler actually fires when the user closes the keyboard this
        // way instead of using R3/send.
        if (btn(1) && !btnHeld[1]) closeOsk();
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3), 4: btn(4), 6: btn(6), 7: btn(7), 10: btn(10), 11: btn(11) };

        hud.textContent = `on-screen keyboard [${oskPage}]\nrow ${oskRow + 1}/${activeRows.length} col ${oskCol + 1}/${row.length}${oskShift ? ' [SHIFT]' : ''}`;
        return;
      }

      if (selectTarget) {
        // Same free-cursor treatment as the OSK above - hover a row to
        // highlight it, X confirms whatever's currently highlighted.
        const selSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * selSpeedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * selSpeedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = 'block';

        if (lx || ly) {
          for (let i = 0; i < selectRowEls.length; i++) {
            const rr = selectRowEls[i].getBoundingClientRect();
            if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
              if (selectIndex !== i) { selectIndex = i; updateSelectHighlight(); }
              break;
            }
          }
        }

        // Right stick scroll-wheels through long option lists - selectEl
        // itself is the scroll container, so this scrolls it directly.
        if (ry !== 0) selectEl.scrollTop += ry * 20;

        if (up && !dpadHeld.up) { selectIndex = Math.max(0, selectIndex - 1); updateSelectHighlight(); selectRowEls[selectIndex].scrollIntoView({ block: 'nearest' }); }
        if (down && !dpadHeld.down) { selectIndex = Math.min(selectOptions.length - 1, selectIndex + 1); updateSelectHighlight(); selectRowEls[selectIndex].scrollIntoView({ block: 'nearest' }); }
        dpadHeld = { up, down, left, right };
        if (btn(0) && !btnHeld[0]) confirmSelectPicker();
        if (btn(1) && !btnHeld[1]) {
          closeSelectPicker();
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          return;
        }
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
        hud.textContent = `select list\n${selectOptions[selectIndex] ? selectOptions[selectIndex].text : ''}\nD-Pad/cursor: browse   ${btnLabel(0)} confirm   ${btnLabel(1)} cancel`;
        return;
      }

      if (sliderTarget) {
        const speedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * speedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * speedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';

        const now = performance.now();
        const REPEAT_INITIAL_DELAY = 400, REPEAT_INTERVAL = 120;
        if (left) {
          if (!dpadHeld.left) { leftHeldSince = now; adjustSlider(-1); lastPageTurnTime = now; }
          else if (now - leftHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) { adjustSlider(-1); lastPageTurnTime = now; }
        } else leftHeldSince = 0;
        if (right) {
          if (!dpadHeld.right) { rightHeldSince = now; adjustSlider(1); lastPageTurnTime = now; }
          else if (now - rightHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) { adjustSlider(1); lastPageTurnTime = now; }
        } else rightHeldSince = 0;
        dpadHeld = { up, down, left, right };

        if (btn(0)) {
          cursor.style.display = 'block';
          setSliderValueFromPointer(sliderTarget, x);
        } else {
          cursor.style.display = 'none';
        }

        if (btn(1) && !btnHeld[1]) {
          closeSlider();
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          return;
        }
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
        hud.textContent = `slider focused\nvalue: ${sliderTarget.value}\nleft/right = fine-tune   ${btnLabel(0)} hold = drag   ${btnLabel(1)} = done`;
        return;
      }

      /* ---------- mulligan modal ----------
         Has its own custom DOM and isn't picked up by the match-mode
         branch below - a top-level mode in its own right, structurally
         like OSK/select-picker/slider, since it can appear before
         `#handCards` even exists. The trailing Confirm button is folded
         into the SAME grid rather than handled as a special case - it
         sits visually below the cards, so buildRowGrid() naturally puts
         it in its own last row. */
      const mulliganHost = document.querySelector('.mulligan');
      if (!mulliganHost && mulliganGrid) {
        mulliganGrid = null;
        refreshHighlight();
      }
      if (mulliganHost) {
        const mulSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * mulSpeedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * mulSpeedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = cursorRestingDisplay();

        const mulliganCards = Array.from(mulliganHost.querySelectorAll(':scope > .card'))
          .filter(el => el.offsetParent !== null);
        const confirmBtn = document.querySelector('.bootstrap-dialog-footer-buttons .btn-primary')
          || document.querySelector('.modal-footer .btn-primary');
        const mulliganItems = confirmBtn ? [...mulliganCards, confirmBtn] : mulliganCards;

        if (!mulliganItems.length) {
          hud.textContent = 'mulligan (nothing navigable found)';
          return;
        }
        if (!mulliganGrid || !elArraysEqual(gridFlat(mulliganGrid), mulliganItems)) {
          mulliganGrid = buildRowGrid(mulliganItems);
          mulliganRow = 0; mulliganCol = 0;
        }
        mulliganRow = Math.min(mulliganRow, mulliganGrid.length - 1);
        mulliganCol = Math.min(mulliganCol, mulliganGrid[mulliganRow].length - 1);

        if (lx || ly) {
          hoverMulligan:
          for (let r = 0; r < mulliganGrid.length; r++) {
            for (let c = 0; c < mulliganGrid[r].length; c++) {
              const rr = mulliganGrid[r][c].getBoundingClientRect();
              if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                mulliganRow = r; mulliganCol = c;
                break hoverMulligan;
              }
            }
          }
        }
        if (ry !== 0) {
          const scrollable = findRealScrollable(mulliganGrid[mulliganRow][mulliganCol] || mulliganItems[0]);
          if (scrollable) scrollable.scrollTop += ry * 30;
        }

        if (up && !dpadHeld.up) mulliganRow = Math.max(0, mulliganRow - 1);
        if (down && !dpadHeld.down) mulliganRow = Math.min(mulliganGrid.length - 1, mulliganRow + 1);
        mulliganCol = Math.min(mulliganCol, mulliganGrid[mulliganRow].length - 1);
        if (left && !dpadHeld.left) mulliganCol = (mulliganCol - 1 + mulliganGrid[mulliganRow].length) % mulliganGrid[mulliganRow].length;
        if (right && !dpadHeld.right) mulliganCol = (mulliganCol + 1) % mulliganGrid[mulliganRow].length;
        if ((up && !dpadHeld.up) || (down && !dpadHeld.down) || (left && !dpadHeld.left) || (right && !dpadHeld.right)) {
          const selEl = mulliganGrid[mulliganRow][mulliganCol];
          if (selEl) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        dpadHeld = { up, down, left, right };
        refreshHighlight();

        // Cursor-only card-hover restoration: hovering one with the free
        // cursor fires the same real hover events UC's own tribe/keyword
        // tooltips listen for. Deliberately cursor-only - d-pad browsing
        // here still only gets the outline box.
        if (navInputMethod !== 'dpad') {
          updateHover(mulliganGrid[mulliganRow][mulliganCol], x, y);
        }

        if (btn(0) && !btnHeld[0]) {
          const el = mulliganGrid[mulliganRow][mulliganCol];
          const r = el.getBoundingClientRect();
          dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
          console.log('[Wizascript Controller] mulligan item clicked', el);
        }
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
        const focusedIsConfirm = mulliganGrid[mulliganRow][mulliganCol] === confirmBtn;
        hud.textContent = `mulligan\nrow ${mulliganRow + 1}/${mulliganGrid.length}, col ${mulliganCol + 1}/${mulliganGrid[mulliganRow].length}\n${btnLabel(0)} ${focusedIsConfirm ? 'confirm' : 'toggle swap'}`;
        return;
      }

      /* ---------- generic Underscript modal / menu navigation ----------
         Runs AFTER the mulligan check (so mulligan keeps first claim on
         its own modal) and BEFORE match-mode (so a modal opened
         mid-match, e.g. Concede's confirm dialog, takes priority over
         hand/board nav). */
      const modalInfo = queryModalRoot();
      // Self-heal against a trapped field submenu (the preset dropdown)
      // getting closed some way OTHER than our own confirm/cancel
      // handling below - a real mouse click outside it, or the real
      // Escape key, both handled entirely inside settings.js. Without
      // this, fieldSubmenu would keep pointing at detached, already-
      // removed row elements and silently eat every future d-pad press
      // in this pane.
      if (fieldSubmenu && fieldSubmenu.isAlive && !fieldSubmenu.isAlive()) fieldSubmenu = null;
      if (!modalInfo && modalKind) {
        modalGrid = null; modalKind = null;
        modalPane = 'categories'; categoryItems = []; categoryIndex = 0;
        fieldGrid = null; fieldRow = 0; fieldCol = 0;
        if (fieldSubmenu) { fieldSubmenu.onCancel && fieldSubmenu.onCancel(); fieldSubmenu = null; }
        refreshHighlight();
      }
      if (modalInfo && modalInfo.kind !== 'tabbed' && modalKind === 'tabbed') {
        modalPane = 'categories'; categoryItems = []; categoryIndex = 0;
        fieldGrid = null; fieldRow = 0; fieldCol = 0;
        if (fieldSubmenu) { fieldSubmenu.onCancel && fieldSubmenu.onCancel(); fieldSubmenu = null; }
      }
      if (modalInfo && modalInfo.kind === 'tabbed' && modalKind !== 'tabbed') {
        modalPane = 'categories'; fieldGrid = null; fieldRow = 0; fieldCol = 0;
        lastKnownActiveCategoryIdx = -1;
        if (fieldSubmenu) { fieldSubmenu.onCancel && fieldSubmenu.onCancel(); fieldSubmenu = null; }
      }
      if (modalInfo) {
        const { root, kind } = modalInfo;
        modalKind = kind;
        const modSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * modSpeedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * modSpeedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = cursorRestingDisplay();

        /* ---------- tabbed (Settings-shaped) dialog ---------- */
        if (kind === 'tabbed') {
          const { tabbedRoot } = modalInfo;
          const liveCategories = queryCategoryItems(tabbedRoot);
          if (!elArraysEqual(categoryItems, liveCategories)) {
            const prevCat = categoryItems[categoryIndex];
            categoryItems = liveCategories;
            const keep = prevCat ? categoryItems.indexOf(prevCat) : -1;
            categoryIndex = keep >= 0 ? keep : Math.min(categoryIndex, Math.max(0, categoryItems.length - 1));
          }
          // Self-heal categoryIndex against whichever tab is ACTUALLY
          // showing, but EDGE-TRIGGERED off a change in the checked radio
          // since last frame, not "does it currently differ from
          // categoryIndex" - so simply d-pad-browsing to a
          // not-yet-entered category (a deliberate look-before-committing,
          // same as hovering) isn't stomped back to the actually-open tab.
          if (categoryItems.length) {
            const activeIdx = categoryItems.findIndex((label) => {
              const radio = label.previousElementSibling;
              return radio && radio.tagName === 'INPUT' && radio.checked;
            });
            if (activeIdx >= 0) {
              if (activeIdx !== lastKnownActiveCategoryIdx) categoryIndex = activeIdx;
              lastKnownActiveCategoryIdx = activeIdx;
            }
          }
          const activeContent = queryActiveTabContent(tabbedRoot);
          const liveFieldRows = activeContent ? queryFieldRows(activeContent) : [];
          const liveFieldsFlat = liveFieldRows.flat();
          if (!fieldGrid || !elArraysEqual(gridFlat(fieldGrid), liveFieldsFlat)) {
            fieldGrid = liveFieldRows;
            fieldRow = 0; fieldCol = 0;
            fieldNeedsReanchor = false;
          }
          if (fieldGrid.length) {
            fieldRow = Math.min(fieldRow, fieldGrid.length - 1);
            fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
          }

          if (lx || ly) {
            if (modalPane === 'categories') {
              for (let i = 0; i < categoryItems.length; i++) {
                const rr = categoryItems[i].getBoundingClientRect();
                if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) { categoryIndex = i; break; }
              }
            } else {
              hoverField:
              for (let r = 0; r < fieldGrid.length; r++) {
                for (let c = 0; c < fieldGrid[r].length; c++) {
                  const rr = fieldGrid[r][c].getBoundingClientRect();
                  if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) { fieldRow = r; fieldCol = c; break hoverField; }
                }
              }
            }
          }
          if (ry !== 0) {
            const scrollEl = modalPane === 'categories'
              ? categoryItems[categoryIndex]
              : (fieldGrid[fieldRow] || [])[fieldCol];
            const scrollable = findRealScrollable(scrollEl || activeContent || root);
            if (scrollable) scrollable.scrollTop += ry * 30;
            // Only the fields pane suffers from the stale-index bug this
            // guards against (the categories sidebar is short enough to
            // never need scrolling in practice) - see fieldNeedsReanchor's
            // own comment above.
            if (modalPane === 'fields') fieldNeedsReanchor = true;
          }

          if (modalPane === 'categories') {
            if (up && !dpadHeld.up && categoryItems.length) categoryIndex = Math.max(0, categoryIndex - 1);
            if (down && !dpadHeld.down && categoryItems.length) categoryIndex = Math.min(categoryItems.length - 1, categoryIndex + 1);
            if (right && !dpadHeld.right) enterCategory();
            dpadHeld = { up, down, left, right };
            refreshHighlight();

            if (btn(0) && !btnHeld[0]) enterCategory();
            // isControllerCaptureActive() can't actually be true while
            // browsing categories (a capture widget only exists as a row
            // INSIDE a category's own fields pane), but the guard is kept
            // explicit here anyway rather than relying on that being true
            // by construction - Cancel closing a dialog must never be
            // able to race a capture widget waiting on this same press.
            if (btn(1) && !btnHeld[1] && !isControllerCaptureActive()) {
              // Categories is the "outermost" pane for a tabbed dialog -
              // Circle here closes the whole dialog, matching the
              // fields-pane Circle backing out ONE level at a time
              // (fields -> categories -> closed).
              const dismiss = findModalDismissButton(root);
              if (dismiss) triggerElementClick(dismiss);
              else document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            hud.textContent = `settings: categories (${categoryItems.length ? categoryIndex + 1 : 0}/${categoryItems.length})\n${btnLabel(0)}/→ open category   ${btnLabel(1)} close dialog`;
          } else if (fieldSubmenu) {
            // Trapped inside a custom, non-native floating widget a field
            // row opened (currently just the controller preset picker) -
            // up/down move the highlighted row WITHIN the widget, confirm
            // picks it, cancel/left backs out without touching it. Field-
            // grid navigation and the generic activate/back handling below
            // are both skipped entirely while this is set, same shape as
            // the capture-widget guard just below it.
            if (up && !dpadHeld.up) fieldSubmenu.index = (fieldSubmenu.index - 1 + fieldSubmenu.items.length) % fieldSubmenu.items.length;
            if (down && !dpadHeld.down) fieldSubmenu.index = (fieldSubmenu.index + 1) % fieldSubmenu.items.length;
            // Edge-detect against the PREVIOUS frame's held state before
            // dpadHeld/btnHeld get overwritten below with this frame's.
            const wasLeftOrB1Held = dpadHeld.left || btnHeld[1];
            dpadHeld = { up, down, left, right };
            refreshHighlight();

            if (btn(0) && !btnHeld[0]) {
              const item = fieldSubmenu.items[fieldSubmenu.index];
              fieldSubmenu.onConfirm(item);
              fieldSubmenu = null;
            } else if ((btn(1) || left) && !wasLeftOrB1Held) {
              fieldSubmenu.onCancel();
              fieldSubmenu = null;
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            const idx = fieldSubmenu ? fieldSubmenu.index + 1 : 0;
            const total = fieldSubmenu ? fieldSubmenu.items.length : 0;
            hud.textContent = `settings: submenu (${idx}/${total})\n${btnLabel(0)} select   ←/${btnLabel(1)} cancel`;
          } else {
            // This whole d-pad-movement block (fieldRow/fieldCol, and the
            // "left at column 0 backs out to categories" case) is
            // suppressed while a capture widget is active - without this,
            // a d-pad press meant to be CAPTURED as a binding (e.g.
            // rebinding Previous/Next Channel, which default to
            // D-Left/D-Right) would also move the field grid's own
            // selection instead of ever reaching the capture widget's own
            // getMergedGamepad() read.
            if (!isControllerCaptureActive()) {
              if (fieldGrid.length) {
                const dpadPressed = (up && !dpadHeld.up) || (down && !dpadHeld.down) ||
                  (left && !dpadHeld.left) || (right && !dpadHeld.right);
                if (fieldNeedsReanchor) {
                  // The list moved out from under fieldRow/fieldCol via
                  // the right stick - the first press after that just
                  // re-anchors to whatever's now topmost-visible, rather
                  // than moving from the stale index (which is what used
                  // to yank the scroll position back to wherever that
                  // stale row happened to be).
                  if (dpadPressed) {
                    const rowAnchors = fieldGrid.map((r) => r[0]);
                    const scrollableNow = findRealScrollable(rowAnchors[fieldRow] || activeContent || root) || activeContent || root;
                    fieldRow = topVisibleRowIndex(rowAnchors, scrollableNow);
                    fieldCol = 0;
                    fieldNeedsReanchor = false;
                  }
                } else {
                  if (up && !dpadHeld.up) fieldRow = Math.max(0, fieldRow - 1);
                  if (down && !dpadHeld.down) fieldRow = Math.min(fieldGrid.length - 1, fieldRow + 1);
                  fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
                  if (right && !dpadHeld.right) fieldCol = Math.min(fieldGrid[fieldRow].length - 1, fieldCol + 1);
                  if (left && !dpadHeld.left) {
                    if (fieldCol > 0) fieldCol -= 1;
                    else modalPane = 'categories';
                  }
                  if (dpadPressed) {
                    const selEl = fieldGrid[fieldRow] && fieldGrid[fieldRow][fieldCol];
                    if (selEl) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                  }
                }
              } else if (left && !dpadHeld.left) {
                modalPane = 'categories';
              }
            }
            dpadHeld = { up, down, left, right };
            refreshHighlight();

            // Suppressed entirely while a capture widget is actively
            // waiting for its next press - this generic confirm/back
            // handling runs unconditionally every frame regardless of
            // what currently has real DOM focus, so without this guard,
            // pressing B/A/X to bind THOSE exact buttons would also
            // re-activate or back out of the very widget trying to
            // capture them. btnHeld itself still updates unconditionally
            // below so edge-state stays in sync with the physical button.
            if (!isControllerCaptureActive()) {
              if (btn(0) && !btnHeld[0]) activateHighlighted(0);
              if (btn(3) && !btnHeld[3]) activateHighlighted(2);
              if (btn(1) && !btnHeld[1]) modalPane = 'categories';
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            const fieldPos = fieldGrid.length ? `row ${fieldRow + 1}/${fieldGrid.length}, col ${fieldCol + 1}/${fieldGrid[fieldRow].length}` : '(empty)';
            hud.textContent = `settings: fields ${fieldPos}\n${btnLabel(0)} activate   ${btnLabel(3)} alt-activate   ←/${btnLabel(1)} back to categories`;
          }
          return;
        }

        /* ---------- 'plain' dialog / 'menu' overlay - flat grid ---------- */
        const modalItems = kind === 'plain'
          ? [...queryModalItems(root), ...queryScrollableListItems(root)]
          : queryModalItems(root);
        if (!modalItems.length) {
          hud.textContent = `${kind === 'menu' ? 'underscript menu' : 'dialog'} (nothing navigable found)`;
          return;
        }
        if (!modalGrid || !elArraysEqual(gridFlat(modalGrid), modalItems)) {
          // Underscript's own overlay menu never lays list items side by
          // side (`.menu-body li { width: 80%; margin: 5px auto; }`) -
          // every `<li role="button">` is already its own row on its
          // own, so 'menu' skips buildRowGrid()'s Y-clustering entirely
          // rather than risk it merging adjacent tightly-packed items
          // into one row. A 'plain' BootstrapDialog can still
          // legitimately have side-by-side buttons (Yes/No), so it keeps
          // using real clustering.
          modalGrid = kind === 'menu' ? modalItems.map((el) => [el]) : buildRowGrid(modalItems);
          modalRow = 0; modalCol = 0;
        }
        modalRow = Math.min(modalRow, modalGrid.length - 1);
        modalCol = Math.min(modalCol, modalGrid[modalRow].length - 1);

        if (lx || ly) {
          hoverModal:
          for (let r = 0; r < modalGrid.length; r++) {
            for (let c = 0; c < modalGrid[r].length; c++) {
              const rr = modalGrid[r][c].getBoundingClientRect();
              if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                modalRow = r; modalCol = c;
                break hoverModal;
              }
            }
          }
        }
        if (ry !== 0) {
          const scrollable = findRealScrollable(modalGrid[modalRow][modalCol] || modalItems[0]) || findScrollableDescendant(root);
          if (scrollable) scrollable.scrollTop += ry * 30;
        }

        if (up && !dpadHeld.up) modalRow = Math.max(0, modalRow - 1);
        if (down && !dpadHeld.down) modalRow = Math.min(modalGrid.length - 1, modalRow + 1);
        modalCol = Math.min(modalCol, modalGrid[modalRow].length - 1);
        if (left && !dpadHeld.left) modalCol = (modalCol - 1 + modalGrid[modalRow].length) % modalGrid[modalRow].length;
        if (right && !dpadHeld.right) modalCol = (modalCol + 1) % modalGrid[modalRow].length;
        if ((up && !dpadHeld.up) || (down && !dpadHeld.down) || (left && !dpadHeld.left) || (right && !dpadHeld.right)) {
          const selEl = modalGrid[modalRow][modalCol];
          if (selEl) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        dpadHeld = { up, down, left, right };
        refreshHighlight();

        if (btn(0) && !btnHeld[0]) activateHighlighted(0);
        if (btn(3) && !btnHeld[3]) activateHighlighted(2);
        // Same explicit isControllerCaptureActive() guard as the
        // categories-pane Circle-close above - can't actually be true
        // here either (no capture widgets live outside our own "Keybinds
        // - Controller" tabbed category), kept for the same reason.
        if (btn(1) && !btnHeld[1] && !isControllerCaptureActive()) {
          // The custom Underscript menu always closes via Escape (its own
          // built-in hotkey). A BootstrapDialog is less certain, so try
          // an actual visible dismiss button first and only fall back to
          // a synthetic Escape.
          if (kind === 'menu') {
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
          } else {
            const dismiss = findModalDismissButton(root);
            if (dismiss) triggerElementClick(dismiss);
            else document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
          }
        }
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
        hud.textContent = `${kind === 'menu' ? 'underscript menu' : 'dialog'}\nrow ${modalRow + 1}/${modalGrid.length}, col ${modalCol + 1}/${modalGrid[modalRow].length}\n${btnLabel(0)} activate   ${btnLabel(3)} alt-activate   ${btnLabel(1)} close`;
        return;
      }

      /* ---------- match mode (hand-nav / play / post-play targeting) ----------
         Runs instead of chrome group-nav whenever `#handCards` exists.
         Cursor movement stays live throughout, so a controller user can
         always fall back to point-and-click on anything this scaffold
         doesn't yet drive directly. */
      const handHost = document.getElementById('handCards');
      if (!handHost && matchPhase !== 'hand') {
        // Match ended/left abruptly - don't leave stale placing/resolve
        // state referencing detached nodes.
        matchPhase = 'hand'; placingGrid = null; placingCard = null;
        resolveGrid = null; matchSubState = 'hand-nav'; pendingAttacker = null;
      }
      if (handHost) {
        const mSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * mSpeedMult));
        y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * mSpeedMult));
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = cursorRestingDisplay();

        if (matchPhase === 'placing' && anyStick) {
          // Moving either stick backs out of an in-progress placement,
          // same as it already closes an open chrome dropdown submenu on
          // stick movement - 'placing' is match-mode's equivalent of
          // that cancelable sub-menu. 'resolve' deliberately does NOT
          // get this treatment.
          cancelPlacingDrag('stick movement');
          matchSubState = 'neutral';
          hud.textContent = 'placement cancelled (stick moved)';
          return;
        }
        if (matchPhase === 'placing') {
          const activeEls = Array.from(document.querySelectorAll('.ui-droppable-active'));
          if (!activeEls.length) {
            matchPhase = 'hand';
            refreshHighlight();
          } else {
            if (!placingGrid || !elArraysEqual(gridFlat(placingGrid), activeEls)) {
              placingGrid = buildRowGrid(activeEls);
              placingRow = 0; placingCol = 0;
            }
            placingRow = Math.min(placingRow, placingGrid.length - 1);
            placingCol = Math.min(placingCol, placingGrid[placingRow].length - 1);

            if (lx || ly) {
              hoverSlot:
              for (let r = 0; r < placingGrid.length; r++) {
                for (let c = 0; c < placingGrid[r].length; c++) {
                  const rr = placingGrid[r][c].getBoundingClientRect();
                  if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                    placingRow = r; placingCol = c;
                    break hoverSlot;
                  }
                }
              }
            }
            if (up && !dpadHeld.up) placingRow = Math.max(0, placingRow - 1);
            if (down && !dpadHeld.down) placingRow = Math.min(placingGrid.length - 1, placingRow + 1);
            placingCol = Math.min(placingCol, placingGrid[placingRow].length - 1);
            if (left && !dpadHeld.left) placingCol = (placingCol - 1 + placingGrid[placingRow].length) % placingGrid[placingRow].length;
            if (right && !dpadHeld.right) placingCol = (placingCol + 1) % placingGrid[placingRow].length;
            dpadHeld = { up, down, left, right };
            refreshHighlight();

            // Keep the live drag hovering over whatever's currently
            // selected so UC's own `ui-droppable-hover dropping` feedback
            // stays in sync with the highlight.
            const targetSlot = placingGrid[placingRow][placingCol];
            const tr = targetSlot.getBoundingClientRect();
            const tcx = tr.left + tr.width / 2, tcy = tr.top + tr.height / 2;
            fire(targetSlot, 'pointermove', PointerEvent, tcx, tcy, 0, 1);
            fire(targetSlot, 'mousemove', MouseEvent, tcx, tcy, 0, 1);

            if (btn(0) && !btnHeld[0]) {
              fire(targetSlot, 'pointerup', PointerEvent, tcx, tcy, 0, 0);
              fire(targetSlot, 'mouseup', MouseEvent, tcx, tcy, 0, 0);
              console.log('[Wizascript Controller] card dropped on', targetSlot);
              placingCard = null; placingGrid = null;
              matchPhase = 'hand';
              refreshHighlight();
            } else if (btn(1) && !btnHeld[1]) {
              cancelPlacingDrag('circle button');
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            hud.textContent = `placing card\nslot row ${placingRow + 1}/${placingGrid.length}, col ${placingCol + 1}/${placingGrid[placingRow].length}\n${btnLabel(0)} drop here   ${btnLabel(1)} cancel`;
            return;
          }
        }

        // Live-detect post-play resolution state every frame - not gated
        // on "did we just play a card", since it's just as valid for
        // these to be driven by an opponent's effect or a triggered
        // ability. `.select-card-option.target` (discovery-style "choose
        // 1 of N") takes priority since a discovery choice's option nodes
        // also carry a plain `.target` class and would otherwise
        // double-match.
        const choiceEls = Array.from(document.querySelectorAll('.select-card-option.target'));
        const targetEls = choiceEls.length ? [] : Array.from(document.querySelectorAll('.target:not(.select-card-option)'));
        const resolveEls = choiceEls.length ? choiceEls : targetEls;

        if (resolveEls.length) {
          matchPhase = 'resolve';
          resolveKind = choiceEls.length ? 'choice' : 'target';
          if (!resolveGrid || !elArraysEqual(gridFlat(resolveGrid), resolveEls)) {
            resolveGrid = buildRowGrid(resolveEls);
            resolveRow = 0; resolveCol = 0;
          }
          resolveRow = Math.min(resolveRow, resolveGrid.length - 1);
          resolveCol = Math.min(resolveCol, resolveGrid[resolveRow].length - 1);

          if (lx || ly) {
            hoverTarget:
            for (let r = 0; r < resolveGrid.length; r++) {
              for (let c = 0; c < resolveGrid[r].length; c++) {
                const rr = resolveGrid[r][c].getBoundingClientRect();
                if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                  resolveRow = r; resolveCol = c;
                  break hoverTarget;
                }
              }
            }
          }
          if (ry !== 0) {
            const scrollable = findRealScrollable(resolveGrid[resolveRow][resolveCol] || resolveEls[0]);
            if (scrollable) scrollable.scrollTop += ry * 30;
          }

          if (up && !dpadHeld.up) resolveRow = Math.max(0, resolveRow - 1);
          if (down && !dpadHeld.down) resolveRow = Math.min(resolveGrid.length - 1, resolveRow + 1);
          resolveCol = Math.min(resolveCol, resolveGrid[resolveRow].length - 1);
          if (left && !dpadHeld.left) resolveCol = (resolveCol - 1 + resolveGrid[resolveRow].length) % resolveGrid[resolveRow].length;
          if (right && !dpadHeld.right) resolveCol = (resolveCol + 1) % resolveGrid[resolveRow].length;
          if ((up && !dpadHeld.up) || (down && !dpadHeld.down) || (left && !dpadHeld.left) || (right && !dpadHeld.right)) {
            const selEl = resolveGrid[resolveRow][resolveCol];
            if (selEl) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
          dpadHeld = { up, down, left, right };
          refreshHighlight();

          if (navInputMethod !== 'dpad') {
            updateHover(resolveGrid[resolveRow][resolveCol], x, y);
          }

          if (btn(0) && !btnHeld[0]) {
            if (navInputMethod === 'dpad') {
              const el = resolveGrid[resolveRow][resolveCol];
              const r = el.getBoundingClientRect();
              dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
              console.log('[Wizascript Controller] resolve target confirmed (d-pad)', el);
            } else {
              // Cursor-driven confirm does a REAL hit-test at the
              // cursor's actual on-screen position instead of always
              // redirecting to the last d-pad-valid target - so clicking
              // anything OUTSIDE the valid-target set (e.g. the
              // attacking monster itself, trying to cancel) actually
              // clicks what the cursor is over.
              cursor.style.display = 'none';
              const hitEl = document.elementFromPoint(x, y);
              cursor.style.display = cursorRestingDisplay();
              if (hitEl) {
                dispatchClick(hitEl, x, y, 0);
                console.log('[Wizascript Controller] resolve target confirmed (cursor, real hit-test)', hitEl);
              }
            }
          }
          // Circle cancels an in-progress ATTACK specifically - per UC's
          // own convention, re-clicking the attacking monster deselects
          // rather than confirming. `pendingAttacker` is only ever set by
          // board-nav's own X-press attacker-click (not a spell/effect's
          // targeting prompt), and cleared whenever anything else happens
          // instead. Deliberately scoped to `resolveKind === 'target'` -
          // a discovery `'choice'` pick can't be un-picked once offered.
          if (resolveKind === 'target' && btn(1) && !btnHeld[1]) {
            if (pendingAttacker) {
              const r = pendingAttacker.getBoundingClientRect();
              dispatchClick(pendingAttacker, r.left + r.width / 2, r.top + r.height / 2, 0);
              console.log('[Wizascript Controller] attack cancelled via Circle (re-clicked attacker)', pendingAttacker);
            } else {
              console.log('[Wizascript Controller] Circle pressed during target-resolve with no known attacker (likely a spell/effect target, not an attack) - no action taken');
            }
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `${resolveKind === 'choice' ? 'choose one' : 'select target'}\nrow ${resolveRow + 1}/${resolveGrid.length}, col ${resolveCol + 1}/${resolveGrid[resolveRow].length}\n${btnLabel(0)} confirm${resolveKind === 'target' ? `   ${btnLabel(1)} cancel attack` : ''}`;
          return;
        } else if (matchPhase === 'resolve') {
          // The resolve set emptied out (choice made, or the window timed
          // out) - hand control back to hand-nav.
          matchPhase = 'hand';
          resolveGrid = null;
          matchSubState = 'hand-nav';
          pendingAttacker = null;
          refreshHighlight();
        }

        // matchPhase === 'hand'
        const liveHand = queryHandCards();
        if (!elArraysEqual(handItems, liveHand)) {
          const prevCard = handItems[handIndex];
          handItems = liveHand;
          const keep = prevCard ? handItems.indexOf(prevCard) : -1;
          handIndex = keep >= 0 ? keep : Math.min(handIndex, Math.max(0, handItems.length - 1));
        }

        // Moving either stick is the only way to fall through to the
        // free cursor from hand/board-nav, matching how navbar/footbar
        // chrome nav already works - up/down is fully spoken for by the
        // hand<->board toggle. Also cancels an in-progress 'placing' drag,
        // since 'placing' is match-mode's equivalent of the chrome
        // dropdown submenu that stick-movement already closes. 'resolve'
        // deliberately does NOT get this treatment.
        if (anyStick && (matchSubState === 'hand-nav' || matchSubState === 'board-nav')) matchSubState = 'neutral';

        if (matchSubState === 'hand-nav' && handItems.length) {
          if (left && !dpadHeld.left) handIndex = (handIndex - 1 + handItems.length) % handItems.length;
          if (right && !dpadHeld.right) handIndex = (handIndex + 1) % handItems.length;
          if (up && !dpadHeld.up) matchSubState = 'board-nav';
          dpadHeld = { up, down, left, right };
          refreshHighlight();

          if (btn(0) && !btnHeld[0]) {
            const card = handItems[handIndex];
            if (card && card.classList.contains('canPlay')) {
              beginCardDrag(card);
            } else {
              console.log('[Wizascript Controller] card not playable, ignoring', card);
            }
          }
          // Circle drops to the free cursor, mirroring board-nav's
          // existing Circle -> hand-nav one-step-back convention (and
          // up/down's existing hand<->board toggle) - treating O as a
          // cancel button wherever possible.
          if (btn(1) && !btnHeld[1]) matchSubState = 'neutral';
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `hand (${handIndex + 1}/${handItems.length})\n${btnLabel(0)} play   ↑ board   ${btnLabel(1)} free cursor`;
        } else if (matchSubState === 'board-nav') {
          // Board-nav is a flat left/right list even though buildRowGrid
          // can return multiple rows (front/back) - up/down is spoken
          // for by the hand<->board toggle here. queryBoardMonsterCards()
          // already collapses to just "your" row.
          const liveBoard = queryBoardMonsterCards();
          if (!elArraysEqual(boardItems, liveBoard)) {
            const prevMonster = boardItems[boardIndex];
            boardItems = liveBoard;
            const keep = prevMonster ? boardItems.indexOf(prevMonster) : -1;
            boardIndex = keep >= 0 ? keep : Math.min(boardIndex, Math.max(0, boardItems.length - 1));
          }
          if (left && !dpadHeld.left && boardItems.length) boardIndex = (boardIndex - 1 + boardItems.length) % boardItems.length;
          if (right && !dpadHeld.right && boardItems.length) boardIndex = (boardIndex + 1) % boardItems.length;
          if (down && !dpadHeld.down) matchSubState = 'hand-nav';
          if (btn(1) && !btnHeld[1]) matchSubState = 'hand-nav';
          dpadHeld = { up, down, left, right };
          refreshHighlight();

          if (btn(0) && !btnHeld[0]) {
            const monster = boardItems[boardIndex];
            // Attacking is NOT drag-based, unlike playing a hand card - a
            // plain click puts UC into its own attack-target-selection
            // state, which then marks valid targets with the same
            // `.target` class already handled generically by the
            // 'resolve' branch above.
            if (monster) {
              const r = monster.getBoundingClientRect();
              dispatchClick(monster, r.left + r.width / 2, r.top + r.height / 2, 0);
              pendingAttacker = monster;
              console.log('[Wizascript Controller] monster clicked to select as attacker', monster);
            }
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `board (${boardItems.length ? boardIndex + 1 : 0}/${boardItems.length})\n${btnLabel(0)} select attacker   ↓/${btnLabel(1)} hand`;
        } else {
          refreshHighlight();
          if (up && !dpadHeld.up && handItems.length) matchSubState = 'hand-nav';
          dpadHeld = { up, down, left, right };

          // Free-cursor click passthrough, same behavior as the
          // out-of-match neutral state.
          if (btn(0) && !btnHeld[0]) {
            cursor.style.display = 'none';
            const hitEl = document.elementFromPoint(x, y);
            cursor.style.display = 'block';
            if (hitEl) beginPress('left', 0);
          } else if (btn(0) && drag.left) {
            continuePress('left', 0);
          } else if (!btn(0) && drag.left) {
            endPress('left', 0);
          }

          // Triangle does the same right-click passthrough the
          // out-of-match chrome branch already has further down.
          if (btn(3) && !btnHeld[3]) {
            cursor.style.display = 'none';
            const hitEl = document.elementFromPoint(x, y);
            cursor.style.display = 'block';
            if (hitEl) beginPress('right', 2);
          } else if (btn(3) && drag.right) {
            continuePress('right', 2);
          } else if (!btn(3) && drag.right) {
            endPress('right', 2);
          }

          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };

          // Cursor-only card-hover restoration for the general in-match
          // free-cursor case (any card on the board or in hand).
          cursor.style.display = 'none';
          const hoverEl = document.elementFromPoint(x, y);
          cursor.style.display = cursorRestingDisplay();
          updateHover(hoverEl, x, y);

          hud.textContent = `free cursor (in match)\n↑ = hand nav (${handItems.length} cards)   ${btnLabel(3)} inspect`;
        }
        return;
      }

      const speedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
      x = Math.max(0, Math.min(pageWindow.innerWidth, x + lx * BASE_SPEED * speedMult));
      y = Math.max(0, Math.min(pageWindow.innerHeight, y + ly * BASE_SPEED * speedMult));
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';

      if (ry !== 0) {
        cursor.style.display = 'none';
        const under = document.elementFromPoint(x, y);
        cursor.style.display = 'block';
        const scrollable = findRealScrollable(under || document.body);
        if (scrollable) scrollable.scrollTop += ry * 30;
      }

      // Any stick movement drops group-nav (navbar/footbar) back to
      // neutral automatically, so the cursor is immediately click-ready.
      // This also closes any dropdown submenu that was entered.
      if (anyStick) {
        if (activeSubmenu) closeSubmenu();
        if (chromeStates[chromeIndex] && chromeStates[chromeIndex].type === 'group') {
          chromeIndex = chromeStates.findIndex(s => s.type === 'neutral');
          refreshHighlight();
        }
      }

      const state = chromeStates[chromeIndex];
      if (activeSubmenu) {
        if (up && !dpadHeld.up) {
          activeSubmenu.index = (activeSubmenu.index - 1 + activeSubmenu.items.length) % activeSubmenu.items.length;
          refreshHighlight();
        }
        if (down && !dpadHeld.down) {
          activeSubmenu.index = (activeSubmenu.index + 1) % activeSubmenu.items.length;
          refreshHighlight();
        }
        dpadText = `submenu (${activeSubmenu.index + 1}/${activeSubmenu.items.length})`;
      } else if (state && state.type === 'group') {
        if (up && !dpadHeld.up) { chromeIndex = Math.max(0, chromeIndex - 1); refreshHighlight(); }
        if (down && !dpadHeld.down) { chromeIndex = Math.min(chromeStates.length - 1, chromeIndex + 1); refreshHighlight(); }
        const g = state.group;
        if (left && !dpadHeld.left) {
          itemIndexByGroupName[g.name] = ((itemIndexByGroupName[g.name] || 0) - 1 + g.items.length) % g.items.length;
          refreshHighlight();
        }
        if (right && !dpadHeld.right) {
          itemIndexByGroupName[g.name] = ((itemIndexByGroupName[g.name] || 0) + 1) % g.items.length;
          refreshHighlight();
        }
        dpadText = `${g.name} (${(itemIndexByGroupName[g.name] || 0) + 1}/${g.items.length})`;
      } else {
        if (up && !dpadHeld.up) { chromeIndex = Math.max(0, chromeIndex - 1); refreshHighlight(); }
        if (down && !dpadHeld.down) { chromeIndex = Math.min(chromeStates.length - 1, chromeIndex + 1); refreshHighlight(); }
        const now = performance.now();
        const REPEAT_INITIAL_DELAY = 400, REPEAT_INTERVAL = 150;
        function tryPageTurn(dir) {
          cursor.style.display = 'none';
          const under = document.elementFromPoint(x, y);
          cursor.style.display = 'block';
          if (under) {
            under.dispatchEvent(new WheelEvent('wheel', {
              bubbles: true, cancelable: true, clientX: x, clientY: y,
              deltaY: dir * WHEEL_DELTA, deltaMode: 0
            }));
          }
          lastPageTurnTime = now;
        }
        if (left) {
          if (!dpadHeld.left) { leftHeldSince = now; tryPageTurn(-1); }
          else if (now - leftHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) tryPageTurn(-1);
        } else leftHeldSince = 0;
        if (right) {
          if (!dpadHeld.right) { rightHeldSince = now; tryPageTurn(1); }
          else if (now - rightHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) tryPageTurn(1);
        } else rightHeldSince = 0;
        dpadText = 'neutral (left/right = page turn, hold to repeat)';
      }
      dpadHeld = { up, down, left, right };

      if (btn(0) && !btnHeld[0]) {
        if (currentFocusedEl()) {
          activateHighlighted(0);
        } else {
          cursor.style.display = 'none';
          const hitEl = document.elementFromPoint(x, y);
          cursor.style.display = 'block';
          if (hitEl) {
            if (isNativeSelect(hitEl)) openSelectPicker(hitEl);
            else if (isSlider(hitEl)) openSlider(hitEl);
            else if (isPatchMakerResetButton(hitEl)) activatePatchMakerResetButton(hitEl, x, y);
            else if (hitEl.readOnly && (hitEl.tagName === 'INPUT' || hitEl.tagName === 'TEXTAREA')) {
              dispatchClick(hitEl, x, y, 0);
              hitEl.focus();
            }
            else if (isTextInput(hitEl)) {
              dispatchClick(hitEl, x, y, 0);
              openOsk(hitEl);
              if (hitEl.isContentEditable) placeCaretAtPoint(hitEl, x, y);
            }
            else if (hitEl.matches && hitEl.matches('.uc-section-label, .uc-card-item')) {
              dispatchClick(hitEl, x, y, 0);
              hitEl.focus();
            }
            else beginPress('left', 0);
          }
        }
      } else if (btn(0) && drag.left) {
        continuePress('left', 0);
      } else if (!btn(0) && drag.left) {
        endPress('left', 0);
      }

      if (btn(3) && !btnHeld[3]) {
        if (currentFocusedEl()) {
          activateHighlighted(2);
        } else {
          cursor.style.display = 'none';
          const hitEl = document.elementFromPoint(x, y);
          cursor.style.display = 'block';
          if (hitEl) beginPress('right', 2);
        }
      } else if (btn(3) && drag.right) {
        continuePress('right', 2);
      } else if (!btn(3) && drag.right) {
        endPress('right', 2);
      }

      if (btn(1) && !btnHeld[1]) closeSubmenu();

      btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };

      cursor.style.display = 'none';
      const hitEl = document.elementFromPoint(x, y);
      cursor.style.display = cursorRestingDisplay();
      updateHover(hitEl, x, y);

      hud.textContent = `controller active\n${dpadText}\nchrome: ${chromeStates[chromeIndex] ? chromeStates[chromeIndex].type : '?'}`;
    } catch (err) {
      console.error('[Wizascript Controller] frame() error, loop continues:', err);
    } finally {
      requestAnimationFrame(frame);
    }
  }

  refreshHighlight();
  requestAnimationFrame(frame);
}
