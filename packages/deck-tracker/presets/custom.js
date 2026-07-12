// Custom tracker UI: the "Create Custom Tracker" sprite-search dialog
// and the "Save as Preset" dialog. Both are pure UI - they hand data
// back via callbacks rather than touching registry.js or hud.js
// directly, so this file only knows how to gather input, not what
// happens with it afterward.
//
// More presets are expected to be added over time (soul-tied ones,
// possibly more manual ones later) - this file deliberately only
// covers the Custom-tracker-specific UI, not a general "preset" concept,
// so adding e.g. presets/save-tracker.js later doesn't mean touching
// this file at all.

import { getAllCards } from "../../core/card-data.js";

const CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
const SPRITE_RATIO = "160 / 90";

function searchSpriteCards(term) {
  if (!term) return [];
  const t = term.toLowerCase();
  // Any card's image is fair game as a sprite - unlike true-hub-bridge's
  // deck filter, no rarity exclusion here. Just requires an .image to
  // actually render a thumbnail.
  return getAllCards()
    .filter(c => c.name && c.image && c.name.toLowerCase().includes(t))
    .slice(0, 20);
}

function buildSpriteResultRow(card, onPick) {
  const row = $('<div>').css({
    display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
    cursor: 'pointer', fontSize: '13px'
  }).on('mouseenter', function () { $(this).css('background', 'rgba(255,255,255,0.08)'); })
    .on('mouseleave', function () { $(this).css('background', ''); });

  const thumb = $('<img>').attr('src', `${CARD_IMAGE_BASE}${card.image}.png`).css({
    width: '28px', aspectRatio: SPRITE_RATIO, objectFit: 'cover', flexShrink: 0, background: '#111'
  }).on('error', function () {
    $(this).replaceWith($('<div>').css({ width: '28px', aspectRatio: SPRITE_RATIO, background: '#333', flexShrink: 0 }));
  });

  row.append(thumb, $('<span>').text(card.name));
  row.on('click', () => onPick(card));
  return row;
}

// ---- "Create Custom Tracker" dialog ----
// onCreate({ name, sprite }) fires when the user confirms. `sprite` is
// a card's `.image` string, or null if no sprite was picked.

export function openCustomTrackerBuilder({ onCreate }) {
  let selectedCard = null;

  const wrapper = $('<div>').css({ minWidth: '340px' });
  const spriteSearch = $('<input type="text" placeholder="Search for a card sprite (optional)...">')
    .addClass('form-control').css({ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '13px' });
  const spriteResults = $('<div>').css({
    maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px', marginTop: '4px', display: 'none'
  });
  const selectedPreview = $('<div>').css({
    display: 'none', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '6px',
    background: 'rgba(255,255,255,0.06)', borderRadius: '4px'
  });
  const nameInput = $('<input type="text" placeholder="Tracker name">').addClass('form-control')
    .css({ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '13px', marginTop: '10px' });

  spriteSearch.on('input', function () {
    const matches = searchSpriteCards($(this).val());
    spriteResults.empty();
    if (!matches.length) { spriteResults.hide(); return; }

    matches.forEach(card => spriteResults.append(buildSpriteResultRow(card, picked => {
      selectedCard = picked;
      nameInput.val(picked.name);
      selectedPreview.empty().css('display', 'flex').append(
        $('<img>').attr('src', `${CARD_IMAGE_BASE}${picked.image}.png`).css({ width: '28px', aspectRatio: SPRITE_RATIO, objectFit: 'cover' })
          .on('error', function () { $(this).replaceWith('(image unavailable)'); }),
        $('<span>').text(`Sprite: ${picked.name}`)
      );
      spriteResults.hide();
      spriteSearch.val('');
    })));
    spriteResults.show();
  });

  wrapper.append(spriteSearch, spriteResults, selectedPreview, nameInput);

  const dialog = BootstrapDialog.show({
    title: 'Create Custom Tracker',
    message: wrapper,
    cssClass: 'mono',
    buttons: [
      { label: 'Cancel', action: d => d.close() },
      {
        label: 'Create', cssClass: 'btn-success',
        action: d => {
          const name = nameInput.val().trim() || 'Untitled Tracker';
          d.close();
          onCreate({ name, sprite: selectedCard?.image || null });
        }
      }
    ]
  });
  setTimeout(() => spriteSearch.trigger('focus'), 100);
  return dialog;
}

// ---- "Save as Preset" dialog ----
// onSaved(name, description) fires when the user confirms.

export function openSaveAsPresetPrompt(defaultName, onSaved) {
  const wrapper = $('<div>').css({ minWidth: '320px' });
  const nameInput = $('<input type="text">').addClass('form-control').val(defaultName)
    .css({ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '13px', marginBottom: '8px' });

  // Explicit dark-theme styling - textarea doesn't inherit the same
  // look as .form-control's <input> the way it should.
  const descInput = $('<textarea placeholder="Short description (optional)">').addClass('form-control')
    .css({
      width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '13px',
      minHeight: '60px', resize: 'vertical',
      background: '#111', color: '#eee', border: '1px solid #444'
    });

  wrapper.append(
    $('<label>').css({ fontSize: '12px', color: '#aaa' }).text('Preset name'), nameInput,
    $('<label>').css({ fontSize: '12px', color: '#aaa', marginTop: '6px', display: 'block' }).text('Description'), descInput
  );

  return BootstrapDialog.show({
    title: 'Save as Preset',
    message: wrapper,
    cssClass: 'mono',
    buttons: [
      { label: 'Cancel', action: d => d.close() },
      {
        label: 'Save', cssClass: 'btn-success',
        action: d => {
          const name = nameInput.val().trim() || defaultName;
          const description = descInput.val().trim();
          d.close();
          onSaved(name, description);
        }
      }
    ]
  });
}
