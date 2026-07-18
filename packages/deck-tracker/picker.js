// "Add Tracker Preset" dialog - lists known presets (favorited first),
// with search, plus a Custom Tracker row pinned below the scrollable
// list. Custom is deliberately NOT favoritable/sortable alongside the
// rest - it's the option meant to be reached for constantly, so it
// shouldn't have to compete with scrolling or filtering.
//
// Two icons per row, both SVG (not text glyphs) for consistent
// rendering regardless of the user's system font/OS:
//  - heart: the ONLY place favoriting happens now (not on the widget)
//  - star: add-to-screen / remove-from-screen, and for custom presets
//    specifically, double-clicking it while filled permanently deletes
//    the preset (there's no separate delete button anymore)

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

  // ---- star: add / remove from screen, and (custom + double-click)
  // permanent delete. No separate delete button anymore. ----
  const starBtn = $('<span>').css({
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '4px', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', flexShrink: 0
  });

  let active = isWidgetOpen(preset.id);

  function renderStar() {
    starBtn.html(starIconSVG(active));
    if (active && preset.custom) {
      starBtn.attr('title', 'Double-click to permanently delete this preset');
    } else if (active) {
      starBtn.attr('title', 'Remove from screen');
    } else {
      starBtn.attr('title', 'Add to screen');
    }
  }
  renderStar();

  starBtn.on('click', e => {
    e.stopPropagation();

    if (!active) {
      onAdd(preset.id);
      active = true;
      renderStar();
      return;
    }

    if (preset.custom) {
      // Ignore single clicks entirely here - a lone click on an active
      // custom preset's star does nothing. This is deliberate: without
      // it, the first click of a genuine double-click would fire as a
      // single click first and could close the widget right before the
      // second click tries to delete it. Closing without deleting is
      // still always available via the widget's own close (x) button.
      if (e.detail !== 2) return;
      onDelete(preset.id);
      row.remove();
      return;
    }

    // Built-in preset, currently active - nothing to delete, so a
    // single click just removes it from screen.
    onCloseWidget(preset.id);
    active = false;
    renderStar();
  });

  row.append(heart, info, starBtn);
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
    'Adds the preset to your screen. Once active, the star fills in - click it again to remove it from screen. For your own custom presets specifically, double-clicking the filled star permanently deletes it (built-in presets can\'t be deleted this way).'
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
