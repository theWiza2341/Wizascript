// Tracker widget rendering. Reads/writes through registry.js for all
// persisted state (favorite, layout, custom preset definitions) and
// session state (active instance counts) - this module owns DOM only.
//
// Two entry points:
//  - spawnPreset(id): a KNOWN preset (built-in or already-saved custom)
//  - spawnAdHocCustomTracker(...): a fresh custom tracker with no
//    registry id yet - only becomes a real saved preset once the user
//    hits its star and goes through the save-as-preset flow.

import {
  getDefinition, isFavorited, setFavorited, getLayout, setLayout,
  activate, deactivate, getCount, setCount, onCountChange,
  createCustomPreset
} from "./registry.js";

const CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
const SPRITE_RATIO = "160 / 90";
const MIN_WIDTH = 90;
const MAX_WIDTH = 220;
const DEFAULT_WIDTH = 162;

const liveWidgets = new Map(); // id -> { widget, ..., unsubscribe }

function widgetElementId(id) {
  return `dt-tracker-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function genericIcon() {
  return $('<div>').css({
    width: '100%', aspectRatio: SPRITE_RATIO, background: '#333', borderRadius: '3px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777'
  }).text('#');
}

function spriteImage(sprite) {
  if (!sprite) return genericIcon();
  return $('<img>').attr('src', `${CARD_IMAGE_BASE}${sprite}.png`).css({
    width: '100%', aspectRatio: SPRITE_RATIO, objectFit: 'cover', borderRadius: '3px',
    display: 'block', background: '#000'
  }).on('error', function () { $(this).replaceWith(genericIcon()); });
}

// ---- core widget factory ----
// A single stable jQuery-event namespace is generated ONCE here and
// carried in `parts.ns` for the widget's whole lifetime - including
// across the ad-hoc-to-saved-preset transition, where the SAME DOM
// node gets rebound with new closures. Without a stable namespace,
// each rebind would leak the previous call's document-level drag/
// resize listeners rather than replacing them.

function buildWidget({ id, name, sprite, favorited, initialCount, savedLayout }) {
  const elId = widgetElementId(id);
  $(`#${elId}`).remove();

  const ns = `.dt-widget-${Math.random().toString(36).slice(2)}`;
  let width = savedLayout?.width || DEFAULT_WIDTH;

  const widget = $(`<div id="${elId}">`).addClass('dt-tracker-widget').css({
    position: 'fixed', zIndex: 99999, width: width + 'px',
    background: '#1a1a1a', border: '2px solid #444', borderRadius: '6px',
    padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    color: 'white', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    userSelect: 'none', cursor: 'grab'
  });

  widget.css(savedLayout ? { left: savedLayout.left + 'px', top: savedLayout.top + 'px' } : { top: '120px', right: '20px' });

  const nameLine = $('<div>').css({
    fontWeight: 'bold', textAlign: 'center', width: '100%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }).text(name);

  const imageWrap = $('<div>').css({ position: 'relative', width: '100%' });
  const imageBox = spriteImage(sprite);

  const star = $('<span>').text(favorited ? '★' : '☆').css({
    position: 'absolute', top: '2px', right: '2px', cursor: 'pointer',
    color: favorited ? '#ffd700' : '#eee', fontSize: '15px',
    background: 'rgba(0,0,0,0.55)', borderRadius: '50%', width: '18px', height: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
  });

  const closeBtn = $('<span>').text('×').css({
    position: 'absolute', top: '2px', left: '2px', cursor: 'pointer',
    color: '#eee', fontSize: '15px', fontWeight: 'bold',
    background: 'rgba(180,30,30,0.75)', borderRadius: '50%', width: '18px', height: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
  });

  const resizeHandle = $('<div>').css({
    position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px',
    cursor: 'nwse-resize', background: 'transparent'
  });

  imageWrap.append(imageBox, star, closeBtn);

  const countEl = $('<div>').css({
    fontWeight: 'bold', width: '100%', textAlign: 'center',
    background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '2px 0'
  }).text('×' + initialCount);

  function applySize(newWidth) {
    width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
    widget.css('width', width + 'px');
    nameLine.css('fontSize', Math.round(width * 0.105) + 'px');
    countEl.css('fontSize', Math.round(width * 0.14) + 'px');
    return width;
  }
  applySize(width);

  widget.append(nameLine, imageWrap, countEl, resizeHandle);
  $('body').append(widget);

  star.on('mousedown', e => e.stopPropagation());
  closeBtn.on('mousedown', e => e.stopPropagation());

  return { widget, nameLine, countEl, imageWrap, star, closeBtn, resizeHandle, applySize, getWidth: () => width, ns };
}

// ---- shared drag/resize/click interaction wiring ----
// Always .off(parts.ns) before rebinding, so calling this a second time
// on the same widget (the ad-hoc -> saved-preset upgrade) replaces the
// previous bindings instead of stacking a duplicate set alongside them.

function bindInteractions(parts, { getCurrentCount, setCurrentCount, isFavorited, persistLayout }) {
  const { widget, resizeHandle, applySize, getWidth, ns } = parts;

  widget.off(ns).off('contextmenu' + ns);
  $(document).off(ns);
  resizeHandle.off(ns);

  let dragging = false, dragMoved = false, startX, startY, offsetX, offsetY;

  widget.on('mousedown' + ns, function (e) {
    if (e.button === 1) {
      e.preventDefault();
      setCurrentCount(0);
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
    widget.css('cursor', 'grabbing');
    e.preventDefault();
  });

  $(document).on('mousemove' + ns, function (e) {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) dragMoved = true;
    if (dragMoved) {
      widget.css({ left: (e.clientX - offsetX) + 'px', top: (e.clientY - offsetY) + 'px', right: 'auto' });
    }
  });

  $(document).on('mouseup' + ns, function () {
    if (!dragging) return;
    dragging = false;
    widget.css('cursor', 'grab');
    if (dragMoved) {
      if (isFavorited()) {
        const rect = widget[0].getBoundingClientRect();
        persistLayout({ left: rect.left, top: rect.top, width: getWidth() });
      }
    } else {
      setCurrentCount(getCurrentCount() + 1);
    }
  });

  widget.on('contextmenu' + ns, function (e) {
    e.preventDefault();
    setCurrentCount(getCurrentCount() - 1);
  });

  let resizing = false, resizeStartX, resizeStartWidth;

  resizeHandle.on('mousedown' + ns, function (e) {
    e.stopPropagation();
    e.preventDefault();
    resizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = getWidth();
  });

  $(document).on('mousemove' + ns + '-resize', function (e) {
    if (!resizing) return;
    applySize(resizeStartWidth + (e.clientX - resizeStartX));
  });

  $(document).on('mouseup' + ns + '-resize', function () {
    if (!resizing) return;
    resizing = false;
    if (isFavorited()) {
      const rect = widget[0].getBoundingClientRect();
      persistLayout({ left: rect.left, top: rect.top, width: getWidth() });
    }
  });
}

// ---- spawning a KNOWN preset (built-in or already-saved custom) ----

export function spawnPreset(id) {
  const definition = getDefinition(id);
  if (!definition) {
    console.warn('[DeckTracker] Unknown preset id:', id);
    return null;
  }
  if (liveWidgets.has(id)) return liveWidgets.get(id).widget; // already on screen

  activate(id);
  const favorited = isFavorited(id);
  const savedLayout = favorited ? getLayout(id) : null;

  const parts = buildWidget({
    id,
    name: definition.name,
    sprite: definition.sprite,
    favorited,
    initialCount: getCount(id),
    savedLayout
  });

  parts.star.on('click', e => {
    e.stopPropagation();
    toggleFavorite(id, parts);
  });
  parts.closeBtn.on('click', e => {
    e.stopPropagation();
    closeWidget(id);
  });

  bindInteractions(parts, {
    getCurrentCount: () => getCount(id),
    setCurrentCount: next => setCount(id, next),
    isFavorited: () => isFavorited(id),
    persistLayout: layout => setLayout(id, layout)
  });

  const unsubscribe = onCountChange(id, count => parts.countEl.text('×' + count));
  liveWidgets.set(id, { ...parts, unsubscribe });

  return parts.widget;
}

function toggleFavorite(id, parts) {
  if (isFavorited(id)) {
    setFavorited(id, false);
    parts.star.text('☆').css('color', '#eee');
  } else {
    setFavorited(id, true);
    parts.star.text('★').css('color', '#ffd700');
    const rect = parts.widget[0].getBoundingClientRect();
    setLayout(id, { left: rect.left, top: rect.top, width: parts.getWidth() });
  }
}

export function closeWidget(id) {
  const entry = liveWidgets.get(id);
  if (!entry) return;
  entry.unsubscribe?.();
  $(document).off(entry.ns);
  entry.widget.remove();
  deactivate(id);
  liveWidgets.delete(id);
}

export function isWidgetOpen(id) {
  return liveWidgets.has(id);
}

// ---- ad-hoc custom tracker (not yet saved as a preset) ----

export function spawnAdHocCustomTracker({ name, sprite, onRequestSaveAsPreset }) {
  const tempId = `adhoc:${Date.now().toString(36)}`;
  let count = 0;

  const parts = buildWidget({
    id: tempId, name, sprite, favorited: false, initialCount: 0, savedLayout: null
  });

  bindInteractions(parts, {
    getCurrentCount: () => count,
    setCurrentCount: next => { count = Math.max(0, next); parts.countEl.text('×' + count); },
    isFavorited: () => false,
    persistLayout: () => {} // can't persist layout until this is a real saved preset
  });

  parts.closeBtn.on('click', e => {
    e.stopPropagation();
    $(document).off(parts.ns);
    parts.widget.remove();
  });

  parts.star.on('click', e => {
    e.stopPropagation();
    onRequestSaveAsPreset(name, sprite, (savedName, description) => {
      const definition = createCustomPreset({ name: savedName, description, sprite });

      activate(definition.id, { initialCount: count });
      setFavorited(definition.id, true);
      const rect = parts.widget[0].getBoundingClientRect();
      setLayout(definition.id, { left: rect.left, top: rect.top, width: parts.getWidth() });

      // Rebind the SAME DOM node to real, registry-backed behavior
      // rather than tearing it down - avoids a visual flicker right
      // after saving.
      parts.widget.attr('id', widgetElementId(definition.id));
      parts.star.off('click').on('click', e2 => {
        e2.stopPropagation();
        toggleFavorite(definition.id, parts);
      });
      parts.closeBtn.off('click').on('click', e2 => {
        e2.stopPropagation();
        closeWidget(definition.id);
      });

      bindInteractions(parts, {
        getCurrentCount: () => getCount(definition.id),
        setCurrentCount: next => setCount(definition.id, next),
        isFavorited: () => isFavorited(definition.id),
        persistLayout: layout => setLayout(definition.id, layout)
      });

      const unsubscribe = onCountChange(definition.id, c => parts.countEl.text('×' + c));
      liveWidgets.set(definition.id, { ...parts, unsubscribe });

      parts.star.text('★').css('color', '#ffd700');
    });
  });

  return parts.widget;
}
