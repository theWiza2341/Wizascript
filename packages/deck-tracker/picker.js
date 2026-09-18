// "Add Tracker Preset" dialog - lists known presets (favorited first),
// with search, plus a Custom Tracker row pinned below the scrollable
// list. Custom is deliberately NOT favoritable/sortable alongside the
// rest - it's the option meant to be reached for constantly, so it
// shouldn't have to compete with scrolling or filtering.
//
// Icons per row, all SVG (not text glyphs) for consistent rendering
// regardless of the user's system font/OS:
//  - heart: the ONLY place favoriting happens now (not on the widget)
//  - star: add-to-screen / remove-from-screen - same meaning for every
//    preset, built-in or custom
//  - trash (custom presets only): permanently deletes the preset.
//    Previously this lived as a hidden double-click on the star, and
//    ONLY worked while the preset happened to be active on screen -
//    a user report confirmed this was effectively undiscoverable and,
//    for an inactive custom preset, actually impossible. Now it's its
//    own always-visible control, independent of whether the preset is
//    currently on screen. Still double-click-to-confirm (no confirm()
//    messagebox), matching Patch Maker's destructive-control convention.

import { getAvailablePresets, isFavorited, setFavorited } from "./registry.js";
import { isWidgetOpen } from "./hud.js";

function heartIconSVG(filled) {
  const fill = filled ? '#e74c3c' : 'none';
  const stroke = filled ? '#e74c3c' : '#888';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round">
    <path d="M12 21s-6.716-4.35-9.428-8.06C.686 10.06 1.2 6.5 4.2 5.1 6.6 4 9 5 12 8c3-3 5.4-4 7.8-2.9 3 1.4 3.514 4.96 1.628 7.84C18.716 16.65 12 21 12 21z"/>
  </svg>`;
}

function starIconSVG(filled) {
  const fill = filled ? '#2ecc71' : 'none';
  const stroke = filled ? '#2ecc71' : '#888';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round">
    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.6 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"/>
  </svg>`;
}

function trashIconSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
  </svg>`;
}

function buildPresetRow(preset, onAdd, onCloseWidget, onDelete) {
  const row = $('<div>').css({
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  }).on('mouseenter', function () { $(this).css('background', 'rgba(255,255,255,0.08)'); })
    .on('mouseleave', function () { $(this).css('background', ''); });

  // ---- heart: favorite toggle, the only place this happens now ----
  const heart = $('<span>').css({
    width: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
  });
  function renderHeart() {
    heart.html(heartIconSVG(isFavorited(preset.id)));
  }
  renderHeart();
  heart.attr('title', 'Favorite - always auto-load at match start');
  heart.on('click', e => {
    e.stopPropagation();
    const nowFavorited = !isFavorited(preset.id);
    setFavorited(preset.id, nowFavorited);
    renderHeart();
  });

  const info = $('<div>').css({ flex: 1 });
  const nameLine = $('<div>').css({ fontWeight: 'bold', fontSize: '14px' }).text(preset.name);
  if (preset.soul) {
    nameLine.append($('<span>').text(` (${preset.soul})`).css({
      fontSize: '11px', fontWeight: 'normal', color: '#4a7aaa', marginLeft: '6px'
    }));
  }
  const descLine = $('<div>').css({ fontSize: '12px', color: '#aaa', marginTop: '2px' }).text(preset.description || '');
  info.append(nameLine, descLine);

  // ---- star: add / remove from screen. Same meaning for every preset
  // now, custom or built-in - no more overloaded double-click-to-delete
  // behavior (see the dedicated trash control below for that). ----
  const starBtn = $('<span>').css({
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '4px', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', flexShrink: 0
  });

  let active = isWidgetOpen(preset.id);

  function renderStar() {
    starBtn.html(starIconSVG(active));
    starBtn.attr('title', active ? 'Remove from screen' : 'Add to screen');
  }
  renderStar();

  starBtn.on('click', e => {
    e.stopPropagation();
    if (active) {
      onCloseWidget(preset.id);
    } else {
      onAdd(preset.id);
    }
    active = !active;
    renderStar();
  });

  row.append(heart, info, starBtn);

  // ---- trash: permanent delete, custom presets only. Always visible
  // regardless of whether the preset is currently active on screen -
  // deleting an inactive custom preset used to be impossible entirely,
  // since the old delete path only existed on the star AND only while
  // active. onDelete (handleDeletePreset in deck-tracker/index.js)
  // already closes the widget first if it happens to be open, so this
  // works correctly either way without checking `active` here. ----
  if (preset.custom) {
    const trashBtn = $('<span>').css({
      width: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
    }).html(trashIconSVG())
      .attr('title', 'Double-click to permanently delete this custom tracker')
      .on('click', e => {
        e.stopPropagation();
        if (e.detail !== 2) return; // require a real double-click, not a single stray click
        onDelete(preset.id);
        row.remove();
      });
    row.append(trashBtn);
  }

  return row;
}

function renderList(container, term, onAdd, onCloseWidget, onDelete) {
  container.empty();
  const all = getAvailablePresets();
  const filtered = term ? all.filter(p => p.name.toLowerCase().includes(term.toLowerCase())) : all;

  if (!filtered.length) {
    container.append($('<div>').text('No presets found.').css({
      padding: '12px', color: '#777', fontStyle: 'italic', textAlign: 'center'
    }));
    return;
  }

  filtered.sort((a, b) => b.favorited - a.favorited).forEach(p => container.append(buildPresetRow(p, onAdd, onCloseWidget, onDelete)));
}

function buildCustomRow(onCreateAdHoc) {
  const row = $('<div>').css({
    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 6px',
    marginTop: '8px', borderTop: '2px dashed rgba(255,255,255,0.25)', cursor: 'pointer'
  }).on('mouseenter', function () { $(this).css('background', 'rgba(255,255,255,0.08)'); })
    .on('mouseleave', function () { $(this).css('background', ''); });

  const info = $('<div>').css({ flex: 1 });
  info.append(
    $('<div>').css({ fontWeight: 'bold', fontSize: '14px' }).text('Custom Tracker'),
    $('<div>').css({ fontSize: '12px', color: '#aaa', marginTop: '2px' }).text('Build your own manual counter, named and tracked however you like.')
  );

  const addBtn = $('<button>').text('+').css({
    width: '28px', height: '28px', lineHeight: '1', fontSize: '16px', fontWeight: 'bold',
    background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px',
    cursor: 'pointer', flexShrink: 0
  }).on('click', e => {
    e.stopPropagation();
    onCreateAdHoc();
  });

  row.append(info, addBtn);
  return row;
}

function openHelpDialog() {
  const content = $('<div>').css({ fontSize: '13px', lineHeight: '1.5' });

  function section(title, body) {
    content.append(
      $('<div>').css({ fontWeight: 'bold', marginTop: '10px' }).text(title),
      $('<div>').css({ color: '#ccc', marginTop: '2px' }).html(body)
    );
  }

  section('Manual trackers (click counters)',
    'Left-click: +1 &nbsp;&nbsp; Right-click: -1 &nbsp;&nbsp; Middle-click: reset to 0.'
  );
  section('The heart (♥ / ♡)',
    'Favorites a preset - a favorited preset always auto-loads at the start of every match, in the same spot you left it.'
  );
  section('The star (★ / ☆)',
    'Adds the preset to your screen. Once active, the star fills in - click it again to remove it from screen. Same behavior for every preset, built-in or custom.'
  );
  section('The trash icon (custom presets only)',
    'Permanently deletes one of your own custom trackers - double-click to confirm, no popup. Shown next to every custom preset in this list whether or not it\'s currently on screen, so you can clean up an old one without adding it back first.'
  );
  section('Creating your own preset',
    'Use "Custom Tracker" below the list to build one - search for a card sprite (optional), name it, and create it. That gives you a plain counter on screen; click its own star to "Save as Preset," adding it to this list permanently.'
  );
  section('Position &amp; size',
    'Drag a tracker by its body to move it, or its bottom-right corner to resize it - it\'ll remember exactly where you left it until you close it.'
  );

  BootstrapDialog.show({
    title: 'Deck Tracker Help',
    message: content,
    cssClass: 'mono',
    buttons: [{ label: 'Got it', cssClass: 'btn-primary', action: dialog => dialog.close() }]
  });
}

export function openPresetPicker({ onAddPreset, onCreateAdHoc, onCloseWidget, onDeletePreset }) {
  const wrapper = $('<div>').css({ minWidth: '360px' });
  const searchInput = $('<input type="text" placeholder="Search presets...">').addClass('form-control').css({
    width: '100%', boxSizing: 'border-box', padding: '6px 8px', marginBottom: '8px', fontSize: '13px'
  });
  const listContainer = $('<div>').css({
    maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px'
  });

  let dialogRef = null;
  const customRow = buildCustomRow(() => {
    dialogRef?.close();
    onCreateAdHoc();
  });

  searchInput.on('input', function () { renderList(listContainer, $(this).val(), onAddPreset, onCloseWidget, onDeletePreset); });
  wrapper.append(searchInput, listContainer, customRow);

  renderList(listContainer, '', onAddPreset, onCloseWidget, onDeletePreset);

  dialogRef = BootstrapDialog.show({
    title: 'Add Tracker Preset',
    message: wrapper,
    cssClass: 'mono',
    onshown: () => searchInput.trigger('focus'),
    buttons: [
      // Deliberately does NOT close dialogRef - unlike the Custom
      // Tracker row above, help should stack on top and leave the
      // picker open underneath, since the user likely wants to keep
      // referring back to it while reading.
      { label: 'Help', cssClass: 'btn-default', action: () => openHelpDialog() },
      { label: 'Close', cssClass: 'btn-primary', action: dialog => dialog.close() }
    ]
  });
  return dialogRef;
}
