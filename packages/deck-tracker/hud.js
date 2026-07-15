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
  getDefinition,
  activate, deactivate, getCount, setCount, onCountChange,
  createCustomPreset, getSavedPosition, setSavedPosition, clearSavedPosition,
  markRetained, unmarkRetained, getHudBehavior
} from "./registry.js";

const CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
const SPRITE_RATIO = "160 / 90";
const MIN_WIDTH = 90;
const MAX_WIDTH = 220;
const DEFAULT_WIDTH = 155;
const COMPACT_DEFAULT_WIDTH = 120;

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

// Position persistence is now handled unconditionally by registry.js's
// getSavedPosition/setSavedPosition/clearSavedPosition - always
// persisted (not session-only), decoupled entirely from favorited
// status and the retain setting, cleared only on explicit close.


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

function buildWidget({ id, name, sprite, initialCount, initialLabel, isLabelMode = false, savedLayout, showSaveButton = false, showImage = true, contentMode = null, initialListItems = [], onRemoveListItem = null, firstItemLabel = 'next' }) {
  const elId = widgetElementId(id);
  $(`#${elId}`).remove();

  const ns = `.dt-widget-${Math.random().toString(36).slice(2)}`;
  let width = savedLayout?.width || (showImage ? DEFAULT_WIDTH : COMPACT_DEFAULT_WIDTH);

  const widget = $(`<div id="${elId}">`).addClass('dt-tracker-widget').css({
    position: 'fixed', zIndex: 8, width: width + 'px',
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

  // Generic, mode-independent - created up front so every content mode
  // (image/compact/list) can reference it without ordering issues.
  const resizeHandle = $('<div>').css({
    position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px',
    cursor: 'nwse-resize', background: 'transparent'
  });

  // ---- list mode (Change of Winds Tracker): a small ordered list of
  // known cards instead of a sprite or plain text. Entirely separate
  // from the image/compact paths above/below - shares only the outer
  // chrome (name line, close button, resize handle, drag/favorite via
  // bindInteractions).
  if (contentMode === "list") {
    widget.append(nameLine);

    const closeBtnList = $('<span>').text('×').css({
      position: 'absolute', top: '-8px', left: '-8px', cursor: 'pointer',
      color: '#eee', fontSize: '15px', fontWeight: 'bold',
      background: 'rgba(180,30,30,0.75)', borderRadius: '50%', width: '18px', height: '18px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
    });
    closeBtnList.on('mousedown', e => e.stopPropagation());
    widget.append(closeBtnList);

    const listBody = $('<div>').css({
      width: '100%', maxHeight: '150px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '3px'
    });

    function renderListItems(items) {
      listBody.empty();
      if (!items.length) {
        listBody.append($('<div>').css({
          fontSize: '11px', color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '4px 0'
        }).text('No known cards yet'));
        return;
      }
      items.forEach((item, idx) => {
        const row = $('<div>').css({
          fontSize: '12px', padding: '3px 6px', background: 'rgba(255,255,255,0.06)',
          borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }).attr('title', 'Right-click to remove this card');

        row.append(
          $('<span>').css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }).text(item.name),
          $('<span>').css({ fontSize: '10px', color: '#777', flexShrink: 0, marginLeft: '6px' }).text(idx === 0 ? firstItemLabel : `+${idx}`)
        );
        row.on('mouseenter', () => row.css('background', 'rgba(255,255,255,0.12)'));
        row.on('mouseleave', () => row.css('background', 'rgba(255,255,255,0.06)'));
        row.on('mousedown', e => e.stopPropagation()); // don't let clicking a row start a widget drag
        row.on('contextmenu', e => {
          e.preventDefault();
          e.stopPropagation(); // don't also trigger the widget's own contextmenu handler
          onRemoveListItem?.(item);
        });
        listBody.append(row);
      });
    }
    renderListItems(initialListItems);

    widget.append(listBody, resizeHandle);
    $('body').append(widget);

    function applySizeList(newWidth) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      widget.css('width', width + 'px');
      nameLine.css('fontSize', Math.round(width * 0.105) + 'px');
      listBody.css('fontSize', Math.round(width * 0.09) + 'px');
      return width;
    }
    applySizeList(width);

    return {
      widget, nameLine, imageWrap: null, star: null, closeBtn: closeBtnList, resizeHandle,
      applySize: applySizeList, getWidth: () => width, ns,
      setSprite: () => {}, setLabel: () => {},
      setListItems: renderListItems
    };
  }

  // Compact presets (Curve Tracker) skip the image area entirely - no
  // card sprite makes sense for a pure number, and the widget stays
  // deliberately smaller as a result. The close button attaches
  // directly to the widget itself instead of an image wrapper, since
  // `widget`'s own `position: fixed` already establishes a valid
  // containing block for an absolutely-positioned child.
  let imageWrap = null;
  let imageBox = null;
  let star = null;

  if (showImage) {
    imageWrap = $('<div>').css({ position: 'relative', width: '100%' });
    imageBox = spriteImage(sprite);

    // Star only exists on not-yet-saved ad-hoc trackers now, meaning
    // "Save as Preset" - it no longer represents or toggles favorited
    // status at all. Favoriting moved entirely to the picker's heart icon.
    if (showSaveButton) {
      star = $('<span>').text('☆').attr('title', 'Save as Preset').css({
        position: 'absolute', top: '2px', right: '2px', cursor: 'pointer',
        color: '#eee', fontSize: '15px',
        background: 'rgba(0,0,0,0.55)', borderRadius: '50%', width: '18px', height: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
      });
    }
  }

  const closeBtn = $('<span>').text('×').css({
    position: 'absolute', top: '2px', left: '2px', cursor: 'pointer',
    color: '#eee', fontSize: '15px', fontWeight: 'bold',
    background: 'rgba(180,30,30,0.75)', borderRadius: '50%', width: '18px', height: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
  });

  if (showImage) {
    imageWrap.append(imageBox);
    if (star) imageWrap.append(star);
    imageWrap.append(closeBtn);
  } else {
    widget.css('position', 'fixed'); // already set above; explicit for clarity as the containing block
    closeBtn.css({ top: '-8px', left: '-8px' });
    widget.append(closeBtn);
  }

  const countEl = $('<div>').css({
    fontWeight: 'bold', width: '100%', textAlign: 'center',
    background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '2px 0'
  });
  if (isLabelMode) {
    countEl.html(initialLabel ?? '?');
  } else {
    countEl.text('×' + initialCount);
  }

  function applySize(newWidth) {
    width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
    widget.css('width', width + 'px');
    nameLine.css('fontSize', Math.round(width * 0.105) + 'px');
    countEl.css('fontSize', Math.round(width * 0.14) + 'px');
    return width;
  }
  applySize(width);

  if (showImage) {
    widget.append(nameLine, imageWrap, countEl, resizeHandle);
  } else {
    widget.append(nameLine, countEl, resizeHandle);
  }
  $('body').append(widget);

  if (star) star.on('mousedown', e => e.stopPropagation());
  closeBtn.on('mousedown', e => e.stopPropagation());

  // Used by event-driven presets (SAVE Tracker) to push updates into an
  // already-rendered widget in response to game events, independent of
  // registry's generic count system - that system assumes a number,
  // this is for arbitrary sprite/text changes. No-op in compact mode,
  // since there's no image to swap.
  function setSprite(newSprite) {
    if (!showImage || !imageBox) return;
    const fresh = spriteImage(newSprite);
    imageBox.replaceWith(fresh);
    imageBox = fresh;
  }

  // Renders as HTML rather than plain text, so a preset can style part
  // of its label (e.g. Curve Tracker coloring the "G" the same gold
  // used elsewhere in the suite). Only ever called by first-party
  // built-in presets with fixed templates - never raw user input.
  function setLabel(html) {
    countEl.html(html);
  }

  return { widget, nameLine, countEl, imageWrap, star, closeBtn, resizeHandle, applySize, getWidth: () => width, ns, setSprite, setLabel };
}

// ---- shared drag/resize/click interaction wiring ----
// Always .off(parts.ns) before rebinding, so calling this a second time
// on the same widget (the ad-hoc -> saved-preset upgrade) replaces the
// previous bindings instead of stacking a duplicate set alongside them.

function bindInteractions(parts, { onLeftClick, onRightClick, onMiddleClick, id, trackRetain = false }) {
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
      const layout = { left: rect.left, top: rect.top, width: getWidth() };
      if (trackRetain) {
        setSavedPosition(id, layout);
        markRetained(id);
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
    const layout = { left: rect.left, top: rect.top, width: getWidth() };
    if (trackRetain) {
      setSavedPosition(id, layout);
      markRetained(id);
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
  // Position is always remembered regardless of favorited/retain-
  // setting status - those two only control whether something auto-
  // appears, not where it appears once it does. Falls back to cascade
  // only if this preset has genuinely never been positioned before.
  const savedLayout = getSavedPosition(id);
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
    showSaveButton: false,
    showImage: !behavior?.compact,
    contentMode: behavior?.listMode ? "list" : null,
    initialListItems: behavior?.getInitialListItems ? behavior.getInitialListItems() : [],
    onRemoveListItem: behavior?.onRemoveListItem ? item => behavior.onRemoveListItem(id, item) : null,
    firstItemLabel: behavior?.firstItemLabel ?? 'next'
  });

  // Records a baseline position the moment this spawns, even if the
  // user never touches it - satisfies "always remembered" without
  // requiring a drag first.
  const baselineRect = { left: parts.widget[0].getBoundingClientRect().left, top: parts.widget[0].getBoundingClientRect().top, width: parts.getWidth() };
  setSavedPosition(id, baselineRect);
  markRetained(id);

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
  // Always clears, unconditionally - closing always means "don't
  // bring this back" AND "forget where it was," per the user's
  // explicit spec: position only ever resets on an explicit close.
  clearSavedPosition(id);
  unmarkRetained(id);
}

// Used on game-end - snapshot the keys first, since closeWidget mutates
// liveWidgets as it runs and iterating a Map while deleting from it
// directly would skip entries.
export function closeAllWidgets() {
  [...liveWidgets.keys()].forEach(id => closeWidget(id));
}

export function isWidgetOpen(id) {
  return liveWidgets.has(id);
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
      // Position is always remembered now, regardless of favorited
      // status - this records where it currently sits the moment it
      // becomes a real preset.
      setSavedPosition(definition.id, { left: rect.left, top: rect.top, width: parts.getWidth() });

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
