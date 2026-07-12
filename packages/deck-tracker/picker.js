// "Add Tracker Preset" dialog - lists known presets (favorited first),
// with search, plus a Custom Tracker row pinned below the scrollable
// list. Custom is deliberately NOT favoritable/sortable alongside the
// rest - it's the option meant to be reached for constantly, so it
// shouldn't have to compete with scrolling or filtering.

import { getAvailablePresets, isFavorited, setFavorited, setLayout } from "./registry.js";
import { getCurrentLayoutIfOpen } from "./hud.js";

function buildPresetRow(preset, onAdd, onDelete) {
  const row = $('<div>').css({
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  }).on('mouseenter', function () { $(this).css('background', 'rgba(255,255,255,0.08)'); })
    .on('mouseleave', function () { $(this).css('background', ''); });

  // Favoriting now happens ONLY here (not on the widget itself) - a
  // heart, deliberately distinct from the widget's "Save as Preset"
  // star, so saving a preset never silently favorites it too.
  const heart = $('<span>').text(preset.favorited ? '♥' : '♡').css({
    color: preset.favorited ? '#e74c3c' : '#777', fontSize: '18px',
    flexShrink: 0, width: '20px', textAlign: 'center', cursor: 'pointer'
  }).attr('title', 'Favorite - always auto-load at match start');

  heart.on('click', e => {
    e.stopPropagation();
    const nowFavorited = !isFavorited(preset.id);
    setFavorited(preset.id, nowFavorited);
    if (nowFavorited) {
      // If it happens to be open right now, snapshot its current
      // position/size as the starting layout rather than leaving it
      // unset - mirrors what favoriting from the widget used to do.
      const currentLayout = getCurrentLayoutIfOpen(preset.id);
      if (currentLayout) setLayout(preset.id, currentLayout);
    }
    heart.text(nowFavorited ? '♥' : '♡').css('color', nowFavorited ? '#e74c3c' : '#777');
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

  const actions = $('<div>').css({ display: 'flex', gap: '4px', flexShrink: 0 });

  const addBtn = $('<button>').text('+').css({
    width: '28px', height: '28px', lineHeight: '1', fontSize: '16px', fontWeight: 'bold',
    background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px',
    cursor: 'pointer', flexShrink: 0
  });
  addBtn.on('click', e => {
    e.stopPropagation();
    onAdd(preset.id);
    addBtn.text('✓').css('background', '#1a8f4c');
    setTimeout(() => addBtn.text('+').css('background', '#2ecc71'), 800);
  });
  actions.append(addBtn);

  // Only user-created presets get a delete button at all - built-in
  // presets structurally can never show one, rather than relying on a
  // runtime check to block deletion after the fact.
  if (preset.custom) {
    const delBtn = $('<button>').text('−').attr('title', 'Double-click to permanently delete this preset').css({
      width: '28px', height: '28px', lineHeight: '1', fontSize: '16px', fontWeight: 'bold',
      background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px',
      cursor: 'pointer', flexShrink: 0
    });
    delBtn.on('click', e => {
      e.stopPropagation();
      if (e.detail !== 2) return; // double-click required, matches patch-maker's custom-section delete
      onDelete(preset.id);
      row.remove();
    });
    actions.append(delBtn);
  }

  row.append(heart, info, actions);
  return row;
}

function renderList(container, term, onAdd, onDelete) {
  container.empty();
  const all = getAvailablePresets();
  const filtered = term ? all.filter(p => p.name.toLowerCase().includes(term.toLowerCase())) : all;

  if (!filtered.length) {
    container.append($('<div>').text('No presets found.').css({
      padding: '12px', color: '#777', fontStyle: 'italic', textAlign: 'center'
    }));
    return;
  }

  filtered.sort((a, b) => b.favorited - a.favorited).forEach(p => container.append(buildPresetRow(p, onAdd, onDelete)));
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

export function openPresetPicker({ onAddPreset, onCreateAdHoc, onDeletePreset }) {
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

  searchInput.on('input', function () { renderList(listContainer, $(this).val(), onAddPreset, onDeletePreset); });
  wrapper.append(searchInput, listContainer, customRow);
  renderList(listContainer, '', onAddPreset, onDeletePreset);

  dialogRef = BootstrapDialog.show({
    title: 'Add Tracker Preset',
    message: wrapper,
    cssClass: 'mono',
    onshown: () => searchInput.trigger('focus'),
    buttons: [{ label: 'Close', cssClass: 'btn-primary', action: dialog => dialog.close() }]
  });
  return dialogRef;
}
