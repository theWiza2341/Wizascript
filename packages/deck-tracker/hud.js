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
  getDefinition, isFavorited, getLayout, setLayout,
  activate, deactivate, getCount, setCount, onCountChange,
  createCustomPreset, getRetainedLayout, trackActiveLayout, forgetActiveLayout,
  getHudBehavior
} from "./registry.js";

const CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
const SPRITE_RATIO = "160 / 90";
const MIN_WIDTH = 90;
const MAX_WIDTH = 220;
const DEFAULT_WIDTH = 155;

// Simple cascade for freshly-spawned (non-favorited/non-retained)
// widgets, so adding several at once doesn't stack them exactly on top
// of each other. Deliberately basic - no real collision detection, just
// a small diagonal offset per spawn that wraps after a handful of
// slots, rather than marching off-screen indefinitely.
const CASCADE_STEP = 24;
const CASCADE_MAX_STEPS = 6;
const CASCADE_BASE = 20;
let cascadeIndex = 0;

function getNextCascadePosition() {
  const step = cascadeIndex % CASCADE_MAX_STEPS;
  cascadeIndex++;
  return {
    right: CASCADE_BASE + step * CASCADE_STEP,
    bottom: CASCADE_BASE + step * CASCADE_STEP
  };
}

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

function buildWidget({ id, name, sprite, initialCount, initialLabel, isLabelMode = false, savedLayout, showSaveButton = false }) {
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

  if (savedLayout) {
    widget.css({ left: savedLayout.left + 'px', top: savedLayout.top + 'px', right: 'auto', bottom: 'auto' });
  } else {
    const pos = getNextCascadePosition();
    widget.css({ bottom: pos.bottom + 'px', right: pos.right + 'px', left: 'auto', top: 'auto' });
  }

  const nameLine = $('<div>').css({
    fontWeight: 'bold', textAlign: 'center', width: '100%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }).text(name);

  const imageWrap = $('<div>').css({ position: 'relative', width: '100%' });
  let imageBox = spriteImage(sprite);

  // Star only exists on not-yet-saved ad-hoc trackers now, meaning
  // "Save as Preset" - it no longer represents or toggles favorited
  // status at all. Favoriting moved entirely to the picker's heart icon.
  let star = null;
  if (showSaveButton) {
    star = $('<span>').text('☆').attr('title', 'Save as Preset').css({
      position: 'absolute', top: '2px', right: '2px', cursor: 'pointer',
      color: '#eee', fontSize: '15px',
      background: 'rgba(0,0,0,0.55)', borderRadius: '50%', width: '18px', height: '18px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
    });
  }

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

  imageWrap.append(imageBox);
  if (star) imageWrap.append(star);
  imageWrap.append(closeBtn);

  const countEl = $('<div>').css({
    fontWeight: 'bold', width: '100%', textAlign: 'center',
    background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '2px 0'
  }).text(isLabelMode ? (initialLabel ?? '?') : ('×' + initialCount));

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

  if (star) star.on('mousedown', e => e.stopPropagation());
  closeBtn.on('mousedown', e => e.stopPropagation());

  // Used by event-driven presets (SAVE Tracker) to push updates into an
  // already-rendered widget in response to game events, independent of
  // registry's generic count system - that system assumes a number,
  // this is for arbitrary sprite/text changes.
  function setSprite(newSprite) {
    const fresh = spriteImage(newSprite);
    imageBox.replaceWith(fresh);
    imageBox = fresh;
  }

  function setLabel(text) {
    countEl.text(text);
  }

  return { widget, nameLine, countEl, imageWrap, star, closeBtn, resizeHandle, applySize, getWidth: () => width, ns, setSprite, setLabel };
}

// ---- shared drag/resize/click interaction wiring ----
// Always .off(parts.ns) before rebinding, so calling this a second time
// on the same widget (the ad-hoc -> saved-preset upgrade) replaces the
// previous bindings instead of stacking a duplicate set alongside them.

function bindInteractions(parts, { onLeftClick, onRightClick, onMiddleClick, isFavorited, persistLayout, id, trackRetain = false }) {
  const { widget, resizeHandle, applySize, getWidth, ns } = parts;

  widget.off(ns).off('contextmenu' + ns);
  $(document).off(ns);
  resizeHandle.off(ns);

  let dragging = false, dragMoved = false, startX, startY, offsetX, offsetY;

  widget.on('mousedown' + ns, function (e) {
    if (e.button === 1) {
      e.preventDefault();
      onMiddleClick?.();
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
      widget.css({ left: (e.clientX - offsetX) + 'px', top: (e.clientY - offsetY) + 'px', right: 'auto', bottom: 'auto' });
    }
  });

  $(document).on('mouseup' + ns, function () {
    if (!dragging) return;
    dragging = false;
    widget.css('cursor', 'grab');
    if (dragMoved) {
      const rect = widget[0].getBoundingClientRect();
      if (isFavorited()) {
        persistLayout({ left: rect.left, top: rect.top, width: getWidth() });
      }
      if (trackRetain) {
        trackActiveLayout(id, { left: rect.left, top: rect.top, width: getWidth() });
      }
    } else {
      onLeftClick?.();
    }
  });

  widget.on('contextmenu' + ns, function (e) {
    e.preventDefault();
    onRightClick?.();
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
    const rect = widget[0].getBoundingClientRect();
    if (isFavorited()) {
      persistLayout({ left: rect.left, top: rect.top, width: getWidth() });
    }
    if (trackRetain) {
      trackActiveLayout(id, { left: rect.left, top: rect.top, width: getWidth() });
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
  // Favorited layout takes priority; if not favorited, fall back to a
  // retained layout (from "Retain Unclosed Presets Between Matches")
  // so a preset that was merely left open - not favorited - still
  // reappears where it was.
  const savedLayout = favorited ? getLayout(id) : getRetainedLayout(id);
  const behavior = getHudBehavior(id);

  const parts = buildWidget({
    id,
    // The picker lists presets by their real name ("SAVE Tracker"), but
    // the on-screen widget itself can show something more directly
    // descriptive of what it's currently displaying, if the preset
    // supplies one.
    name: behavior?.widgetTitle ?? definition.name,
    sprite: behavior?.getInitialSprite ? behavior.getInitialSprite() : definition.sprite,
    initialCount: getCount(id),
    initialLabel: behavior?.getInitialLabel ? behavior.getInitialLabel() : undefined,
    isLabelMode: !!behavior,
    savedLayout,
    showSaveButton: false
  });

  // Records a baseline retained position/size the moment this spawns,
  // even if the user never touches it - satisfies "if you leave with
  // things open, they'll be remembered" without requiring a drag first.
  trackActiveLayout(id, { left: parts.widget[0].getBoundingClientRect().left, top: parts.widget[0].getBoundingClientRect().top, width: parts.getWidth() });

  parts.closeBtn.on('click', e => {
    e.stopPropagation();
    closeWidget(id);
  });

  const interactionCallbacks = behavior
    ? {
        onLeftClick: () => behavior.onLeftClick?.(id, parts),
        onRightClick: () => behavior.onRightClick?.(id, parts),
        onMiddleClick: () => behavior.onMiddleClick?.(id, parts)
      }
    : {
        onLeftClick: () => setCount(id, getCount(id) + 1),
        onRightClick: () => setCount(id, getCount(id) - 1),
        onMiddleClick: () => setCount(id, 0)
      };

  bindInteractions(parts, {
    ...interactionCallbacks,
    isFavorited: () => isFavorited(id),
    persistLayout: layout => setLayout(id, layout),
    id,
    trackRetain: true
  });

  // Event-driven presets (behavior !== null) manage their own display
  // via setSprite/setLabel in response to game events, not registry's
  // generic count system - no onCountChange subscription needed for them.
  const unsubscribe = behavior ? null : onCountChange(id, count => parts.countEl.text('×' + count));
  liveWidgets.set(id, { ...parts, unsubscribe });
  behavior?.onMount?.(id, parts);

  return parts.widget;
}

// (toggleFavorite removed - favoriting no longer happens on widgets,
// only in the picker's heart icon)

export function closeWidget(id) {
  const entry = liveWidgets.get(id);
  if (!entry) return;
  entry.unsubscribe?.();
  $(document).off(entry.ns);
  entry.widget.remove();
  deactivate(id);
  liveWidgets.delete(id);
  getHudBehavior(id)?.onUnmount?.(id);
  // Always clears, regardless of the "retain" setting's current value -
  // closing always means "don't bring this back."
  forgetActiveLayout(id);
}

export function isWidgetOpen(id) {
  return liveWidgets.has(id);
}

// Used by the picker when favoriting from the list - if the preset
// happens to be open on screen right now, snapshot its current
// position/size as the starting layout rather than leaving it unset.
export function getCurrentLayoutIfOpen(id) {
  const entry = liveWidgets.get(id);
  if (!entry) return null;
  const rect = entry.widget[0].getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: entry.getWidth() };
}

// ---- ad-hoc custom tracker (not yet saved as a preset) ----

export function spawnAdHocCustomTracker({ name, sprite, onRequestSaveAsPreset }) {
  const tempId = `adhoc:${Date.now().toString(36)}`;
  let count = 0;

  const parts = buildWidget({
    id: tempId, name, sprite, initialCount: 0, savedLayout: null, showSaveButton: true
  });

  function setLocalCount(next) {
    count = Math.max(0, next);
    parts.countEl.text('×' + count);
  }

  bindInteractions(parts, {
    onLeftClick: () => setLocalCount(count + 1),
    onRightClick: () => setLocalCount(count - 1),
    onMiddleClick: () => setLocalCount(0),
    isFavorited: () => false,
    persistLayout: () => {}, // can't persist layout until this is a real saved preset
    id: tempId,
    trackRetain: false // no real registry id yet - nothing meaningful to retain
  });

  parts.closeBtn.on('click', e => {
    e.stopPropagation();
    $(document).off(parts.ns);
    parts.widget.remove();
  });

  // Star here means "Save as Preset" ONLY - it does not favorite the
  // preset. Favoriting is now an entirely separate, deliberate action
  // done later from the picker's heart icon, so a freshly-saved preset
  // does not silently end up auto-loading every match just because it
  // was saved.
  parts.star.on('click', e => {
    e.stopPropagation();
    onRequestSaveAsPreset(name, sprite, (savedName, description) => {
      const definition = createCustomPreset({ name: savedName, description, sprite });

      activate(definition.id, { initialCount: count });
      const rect = parts.widget[0].getBoundingClientRect();
      // Not favorited by default - just record where it currently sits
      // so IF the user later favorites it from the picker, there's a
      // sensible starting layout rather than nothing at all. This write
      // is harmless even if never favorited (setLayout no-ops unless
      // the id is already marked favorited).
      setLayout(definition.id, { left: rect.left, top: rect.top, width: parts.getWidth() });

      // Rebind the SAME DOM node to real, registry-backed behavior
      // rather than tearing it down - avoids a visual flicker right
      // after saving.
      parts.widget.attr('id', widgetElementId(definition.id));
      parts.closeBtn.off('click').on('click', e2 => {
        e2.stopPropagation();
        closeWidget(definition.id);
      });

      bindInteractions(parts, {
        onLeftClick: () => setCount(definition.id, getCount(definition.id) + 1),
        onRightClick: () => setCount(definition.id, getCount(definition.id) - 1),
        onMiddleClick: () => setCount(definition.id, 0),
        isFavorited: () => isFavorited(definition.id),
        persistLayout: layout => setLayout(definition.id, layout),
        id: definition.id,
        trackRetain: true
      });

      const unsubscribe = onCountChange(definition.id, c => parts.countEl.text('×' + c));
      liveWidgets.set(definition.id, { ...parts, unsubscribe });

      // Nothing left to save - remove the star entirely rather than
      // leaving a now-meaningless icon behind.
      parts.star.remove();
    });
  });

  return parts.widget;
}
