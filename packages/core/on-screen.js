// packages/core/on-screen.js
//
// Keeps a draggable widget fully inside the browser window, so its
// title bar / close button can never end up off-screen and out of reach
// (a player-reported bug on the Notepad and Card Tracker trackers).
// Tier List Maker's window does the same in its own window.js.
//
// keepOnScreen(el, margin): moves el back inside the window right now.
//   `margin` keeps that many px clear on every side - Card Tracker's ×
//   sits 8px outside its widget, so it passes 8. An element bigger than
//   the window is pinned to the top-left, so its header stays reachable.
// watchOnScreen(el, margin): also re-checks whenever the browser window
//   is resized (e.g. a widget placed on a big monitor, then the window
//   made smaller). Elements that leave the page are dropped automatically.

const watched = new Map(); // el -> margin
let listening = false;

function viewport() {
  return {
    w: document.documentElement.clientWidth || window.innerWidth,
    h: document.documentElement.clientHeight || window.innerHeight
  };
}

export function keepOnScreen(el, margin = 0) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return false; // hidden - nothing to fix
  const vp = viewport();
  const maxLeft = Math.max(margin, vp.w - r.width - margin);
  const maxTop = Math.max(margin, vp.h - r.height - margin);
  const left = Math.min(Math.max(r.left, margin), maxLeft);
  const top = Math.min(Math.max(r.top, margin), maxTop);
  if (Math.abs(left - r.left) < 0.5 && Math.abs(top - r.top) < 0.5) return false;
  el.style.left = left + "px";
  el.style.top = top + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  return true;
}

export function watchOnScreen(el, margin = 0) {
  if (!el) return;
  watched.set(el, margin);
  keepOnScreen(el, margin);
  if (listening) return;
  listening = true;
  window.addEventListener("resize", () => {
    watched.forEach((m, node) => {
      if (!node.isConnected) watched.delete(node);
      else keepOnScreen(node, m);
    });
  });
}
