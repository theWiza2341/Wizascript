// packages/misc/card-tags/storage.js
//
// Persistence + CRUD for Card Tags - one GM-backed JSON blob holding a
// tag-definitions array ({id, name, color}[]) and a cardId -> [tagId]
// assignment map. Keying tag assignments by card id (not by page) means
// the same tags show up whether the card is seen in Crafting or in the
// Deck-building list.
//
// Deliberately pure data - no DOM here. Anything that needs to react to
// a tag change (the on-card indicator, the native search re-render)
// does so explicitly from the caller (menu.js), same separation
// deck-tracker/registry.js (data) keeps from hud.js (rendering).

const DATA_KEY = "wizascript.misc.cardTags.data";

export const DEFAULT_COLORS = ["#4dabf7", "#51cf66", "#ffa94d", "#ff6b6b", "#cc5de8", "#20c997", "#ffd43b"];

function genTagId() {
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyData() {
  return { tags: [], cardTags: {} };
}

function readData() {
  let raw;
  try {
    raw = GM_getValue(DATA_KEY, null);
  } catch (e) {
    console.warn("[CardTags] Failed to read storage key", DATA_KEY, e);
    return emptyData();
  }
  if (!raw) return emptyData();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("[CardTags] Failed to parse stored data, starting fresh.", e);
    return emptyData();
  }

  // One-time migration from the early console-test format, where `tags`
  // was a plain array of name strings and `cardTags` mapped
  // cardId -> [name, ...] instead of [tagId, ...].
  if (Array.isArray(parsed.tags) && parsed.tags.length && typeof parsed.tags[0] === "string") {
    const nameToId = {};
    const upgradedTags = parsed.tags.map((name, i) => {
      const id = genTagId();
      nameToId[name] = id;
      return { id, name, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
    });
    const upgradedCardTags = {};
    Object.keys(parsed.cardTags || {}).forEach(cardId => {
      const ids = (parsed.cardTags[cardId] || []).map(name => nameToId[name]).filter(Boolean);
      if (ids.length) upgradedCardTags[cardId] = ids;
    });
    const upgraded = { tags: upgradedTags, cardTags: upgradedCardTags };
    writeData(upgraded);
    return upgraded;
  }

  return {
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    cardTags: parsed.cardTags && typeof parsed.cardTags === "object" ? parsed.cardTags : {}
  };
}

function writeData(value) {
  try {
    GM_setValue(DATA_KEY, JSON.stringify(value));
  } catch (e) {
    console.warn("[CardTags] Failed to write storage key", DATA_KEY, e);
  }
}

let data = readData();

export function allTags() {
  return data.tags;
}

export function findTag(id) {
  return data.tags.find(t => t.id === id) || null;
}

export function createTag(name, color) {
  const tag = {
    id: genTagId(),
    name: name.trim(),
    color: color || DEFAULT_COLORS[data.tags.length % DEFAULT_COLORS.length]
  };
  data.tags.push(tag);
  writeData(data);
  return tag;
}

export function updateTag(id, patch) {
  const tag = findTag(id);
  if (!tag) return;
  Object.assign(tag, patch);
  writeData(data);
}

// Cascades: removes the tag definition itself, then strips it out of
// every card's assignment list (dropping the card's entry entirely once
// its list is empty, rather than leaving a dangling []).
export function deleteTag(id) {
  data.tags = data.tags.filter(t => t.id !== id);
  Object.keys(data.cardTags).forEach(cardId => {
    data.cardTags[cardId] = data.cardTags[cardId].filter(tagId => tagId !== id);
    if (!data.cardTags[cardId].length) delete data.cardTags[cardId];
  });
  writeData(data);
}

export function tagIdsForCard(cardId) {
  return data.cardTags[cardId] || [];
}

export function tagObjectsForCard(cardId) {
  return tagIdsForCard(cardId).map(findTag).filter(Boolean);
}

export function cardHasTag(cardId, tagId) {
  return tagIdsForCard(cardId).includes(tagId);
}

export function toggleCardTag(cardId, tagId) {
  const current = data.cardTags[cardId] || [];
  const has = current.includes(tagId);
  const next = has ? current.filter(t => t !== tagId) : [...current, tagId];
  if (next.length) {
    data.cardTags[cardId] = next;
  } else {
    delete data.cardTags[cardId];
  }
  writeData(data);
}

// Every card id that currently has at least one tag - used to redraw
// every on-card indicator after a grid re-render.
export function taggedCardIds() {
  return Object.keys(data.cardTags);
}

// ---- Sharing (see share.js) ----
//
// Shared form is by tag NAME, not id - ids are random per browser, while
// names are what players actually recognise. Card ids are Undercards'
// own card ids, so they mean the same card for everyone.

export function exportTags(tagIds) {
  const wanted = new Set(tagIds);
  return {
    format: 1,
    tags: data.tags.filter(t => wanted.has(t.id)).map(t => ({
      name: t.name,
      color: t.color,
      cards: Object.keys(data.cardTags).filter(cardId => data.cardTags[cardId].includes(t.id))
    }))
  };
}

// Additive merge: a shared tag whose name matches an existing one
// (ignoring case) adds its cards to that tag and keeps your colour;
// anything else becomes a new tag. Never removes anything.
// Returns { created: [names], merged: [names], cardsTagged: n }.
export function importTags(shared) {
  if (!shared || shared.format !== 1 || !Array.isArray(shared.tags)) {
    throw new Error("That code isn't a Card Tags code this version understands.");
  }
  const summary = { created: [], merged: [], cardsTagged: 0 };
  shared.tags.forEach(st => {
    const name = String(st && st.name || "").trim();
    if (!name) return;
    let tag = data.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (tag) {
      summary.merged.push(tag.name);
    } else {
      const color = /^#[0-9a-f]{3,8}$/i.test(st.color || "") ? st.color : DEFAULT_COLORS[data.tags.length % DEFAULT_COLORS.length];
      tag = { id: genTagId(), name, color };
      data.tags.push(tag);
      summary.created.push(name);
    }
    (Array.isArray(st.cards) ? st.cards : []).forEach(rawId => {
      const cardId = String(rawId);
      if (!/^[\w-]{1,32}$/.test(cardId)) return;
      const current = data.cardTags[cardId] || [];
      if (current.includes(tag.id)) return;
      data.cardTags[cardId] = [...current, tag.id];
      summary.cardsTagged++;
    });
  });
  writeData(data);
  return summary;
}
