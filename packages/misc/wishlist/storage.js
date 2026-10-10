// packages/misc/wishlist/storage.js
//
// Cosmetic Wishlist data, in GM storage (so Back up / Restore covers it):
//   wizascript.wishlist.items  { "<type>:<file>": { type, file, name, added, lastSeen? } }
//   wizascript.wishlist.state  { lastCheckAt, nextDailyAt, nextWeeklyAt, retryAt,
//                                checkingUntil, notified: { key: cycleId } }
//   wizascript.wishlist.owned  { "<type>:<file>": seenAt }  (1.6.1) things the
//                                shop showed as OWNED, so they can't be pinned
//
// An item's key is its type plus its image file name ("avatar:Flirt.png").
// Chat and match images carry no numeric id, but the Cosmetics Shop shows
// the same image for every item (owned ones too), so that's what we match on.

const ITEMS_KEY = "wizascript.wishlist.items";
const STATE_KEY = "wizascript.wishlist.state";
const OWNED_KEY = "wizascript.wishlist.owned";
const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = GM_getValue(key, null);
    if (!raw) return fallback;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  GM_setValue(key, JSON.stringify(value));
}

function emit() {
  listeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener's problem, not ours */ } });
}

export function getItems() {
  return read(ITEMS_KEY, {});
}

export function getItemList() {
  return Object.entries(getItems())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (a.added || 0) - (b.added || 0));
}

export function hasItems() {
  return Object.keys(getItems()).length > 0;
}

// Owned cosmetics, as last seen in the Cosmetics Shop. Cosmetics can't be
// sold or lost, so an entry is only dropped if the shop ever offers that
// item for sale again (then it wasn't really owned, e.g. another account).
export function isKnownOwned(key) {
  return !!read(OWNED_KEY, {})[key];
}

export function recordOwnership(shopItems, now = Date.now()) {
  const owned = read(OWNED_KEY, {});
  let changed = false;
  shopItems.forEach((i) => {
    if (i.owned && !owned[i.key]) { owned[i.key] = now; changed = true; }
    else if (!i.owned && owned[i.key]) { delete owned[i.key]; changed = true; }
  });
  if (changed) write(OWNED_KEY, owned);
}

export function isPinned(key) {
  return !!getItems()[key];
}

export function addItem({ key, type, file, name }) {
  const items = getItems();
  if (items[key]) return;
  items[key] = { type, file, name, added: Date.now() };
  write(ITEMS_KEY, items);
  emit();
}

export function removeItem(key) {
  const items = getItems();
  if (!items[key]) return;
  delete items[key];
  write(ITEMS_KEY, items);
  emit();
}

// fn(items) changes the object in place; saved and announced afterwards.
export function updateItems(fn) {
  const items = getItems();
  fn(items);
  write(ITEMS_KEY, items);
  emit();
}

export function onItemsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return read(STATE_KEY, {});
}

export function setState(patch) {
  write(STATE_KEY, { ...getState(), ...patch });
}
