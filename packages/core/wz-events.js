// packages/core/wz-events.js
//
// A tiny in-script signal board, so one plugin can tell another that
// something happened without importing it (e.g. Cosmetic Wishlist says
// "wishlistInShop" and Flowery Mode reacts). Listeners that throw don't
// stop the others. Nothing here touches the page.

const listeners = new Map(); // name -> [fn]

export function onWz(name, fn) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(fn);
}

export function emitWz(name, data) {
  (listeners.get(name) || []).slice().forEach((fn) => {
    try { fn(data); } catch (e) { /* a listener's problem */ }
  });
}
