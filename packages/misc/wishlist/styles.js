// packages/misc/wishlist/styles.js

const STYLE_ID = "wizascript-wishlist-style";

const CSS = `
.wz-wl-menu { position: fixed; z-index: 2147483000; min-width: 170px; max-width: 280px; background: #000; color: #fff;
  border: 1px solid #fff; font-size: 14px; user-select: none; box-shadow: 0 2px 8px rgba(0,0,0,.6); margin: 0; padding: 0; }
.wz-wl-menu header { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-bottom: 1px solid #555; }
.wz-wl-menu header img { width: 32px; height: 32px; object-fit: contain; flex: none; }
.wz-wl-menu header img.wz-wl-wide { width: 64px; object-fit: cover; }
.wz-wl-menu header small { display: block; color: #aaa; font-size: 11px; }
.wz-wl-menu li { list-style: none; padding: 4px 10px; cursor: pointer; }
.wz-wl-menu li:hover { background: #333; }
.wz-wl-menu li.wz-wl-on { color: #ff6; }
.wz-wl-menu li.wz-wl-off { color: #888; cursor: default; }
.wz-wl-menu li.wz-wl-off:hover { background: transparent; }

.wz-wl-shop-pin { outline: 3px solid #ff6 !important; outline-offset: 2px; border-radius: 4px; }
.wz-wl-shop-star { position: absolute; margin: -6px 0 0 -6px; color: #ff6; font-size: 18px; line-height: 1;
  text-shadow: 0 0 3px #000; pointer-events: none; z-index: 1; }
.wz-wl-shop-target { animation: wz-wl-pulse 1s ease-in-out 3; }
@keyframes wz-wl-pulse { 50% { outline-color: #fff; outline-offset: 6px; } }

.wz-wl-toast-row { display: flex; align-items: center; gap: 6px; margin: 3px 0; text-align: left; }
.wz-wl-toast-row img { height: 28px; width: 28px; object-fit: contain; flex: none; }
.wz-wl-toast-row img.wz-wl-wide { width: 56px; object-fit: cover; }

.wz-wl-list { flex-basis: 100%; margin-top: 4px; }
.wz-wl-list-empty { color: #aaa; font-style: italic; padding: 4px 0; white-space: normal; }
.wz-wl-row { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.wz-wl-row img { height: 32px; width: 32px; object-fit: contain; flex: none; }
.wz-wl-row img.wz-wl-wide { width: 64px; object-fit: cover; }
.wz-wl-row-text { flex: 1; min-width: 0; line-height: 1.2; }
.wz-wl-row-text small { display: block; color: #aaa; }
.wz-wl-row button { flex: none; background: #300; color: #fff; border: 1px solid #a55; border-radius: 3px;
  padding: 0 8px; line-height: 20px; cursor: pointer; }
.wz-wl-row button:hover, .wz-wl-row button:focus { background: #622; }
.wz-wl-status { flex-basis: 100%; color: #ccc; margin-top: 4px; white-space: normal; }
`;

export function injectWishlistStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}
