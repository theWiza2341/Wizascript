// packages/card-maker/gallery/keybox.js
//
// The key button (⚿) at the bottom left of the Card Gallery, and its box
// (1.8.0; before that, Redeem Key was a setting on the Card Maker tab). The
// same module is bundled into the gallery website, so both are 1:1.
//
// The box takes either:
//  - a gallery key (review or contest judging), checked with the server and
//    kept in GM storage (not readable by the page, never in backups), or
//  - a device code (WZL-XXXX-XXXX) made on a linked device with "Link another
//    device", which links this install to the same Undercards account.

import { h, button } from "./dom.js";
import { reviewWhoami } from "./api.js";
import { isDeviceCode, redeemDeviceCode, linkedAccount } from "../../core/account.js";

export const REVIEW_KEY = "wizascript.cardMaker.galleryReview";
export const REVIEW_WHO = "wizascript.cardMaker.galleryReviewWho";
export const ROLE_NAMES = { owner: "owner", reviewer: "reviewer", judge: "judge" };
export const reviewerKey = () => { try { return String(GM_getValue(REVIEW_KEY, "") || ""); } catch (e) { return ""; } };
export const reviewerWho = () => { try { return JSON.parse(GM_getValue(REVIEW_WHO, "null")); } catch (e) { return null; } };
export const keyLabel = () => { const who = reviewerKey() && reviewerWho(); return who ? `Key: ${who.name} (${ROLE_NAMES[who.role] || "reviewer"})` : "Redeem Key"; };

// Who to tell when the stored key changes (the panel, the button, the site's nav).
const listeners = [];
export const onKeyChange = (fn) => { listeners.push(fn); };
const changed = () => listeners.slice().forEach((f) => { try { f(); } catch (e) { /* a listener's problem */ } });

export function forgetKey() {
  if (!reviewerKey()) return false;
  GM_deleteValue(REVIEW_KEY);
  GM_deleteValue(REVIEW_WHO);
  changed();
  return true;
}
// Checks a key with the server and keeps it. Resolves to who it belongs to.
export async function redeemKey(raw) {
  const k = typeof raw === "string" ? raw.trim() : "";
  if (!k) throw new Error("Enter the key or code you were given.");
  let me;
  try { me = await reviewWhoami(k); } catch (e) {
    throw new Error(e && e.code === "not_admin" ? "That key isn't valid." : e && e.code === "key_expired" ? "That key has expired." : e && e.code === "rate_limited" ? "Too many wrong keys. Try again in an hour." : (e && e.message) || "Couldn't check the key.");
  }
  GM_setValue(REVIEW_KEY, k);
  GM_setValue(REVIEW_WHO, JSON.stringify({ name: me.name, role: me.role }));
  changed();
  return me;
}
// Once per page load: a stored key that was revoked or has expired is forgotten.
// onGone(message) says why.
export function recheckKey(onGone) {
  const k = reviewerKey();
  if (!k) return;
  reviewWhoami(k).then((me) => {
    GM_setValue(REVIEW_WHO, JSON.stringify({ name: me.name, role: me.role }));
    changed();
  }, (e) => {
    if (e && (e.code === "key_expired" || e.code === "not_admin") && forgetKey()) {
      onGone(e.code === "key_expired" ? "Your gallery key has expired, so it was removed." : "Your gallery key was revoked, so it was removed.");
    }
  });
}

// The box's content. reviewWhere: where Review is ("in the top bar").
export function keyBox({ reviewWhere = "in the title bar" } = {}) {
  const wrap = h("div", { class: "wz-key-box" });
  const status = h("p", { class: "wz-key-status" });
  const show = (text, ok) => { status.textContent = text; status.style.color = ok ? "#7f7" : "#f77"; };
  function draw() {
    wrap.replaceChildren();
    const who = reviewerKey() && reviewerWho();
    const input = h("input", { type: "password", placeholder: "Key or code", autocomplete: "off", spellcheck: false });
    let busy = false;
    const submit = async () => {
      if (busy) return;
      busy = true; go.disabled = true; show("Checking…", true);
      try {
        if (isDeviceCode(input.value)) {
          const name = await redeemDeviceCode(input.value);
          draw();
          show(`Linked as ${name}.`, true);
        } else {
          const me = await redeemKey(input.value);
          draw();
          show(me.role === "judge" ? `Redeemed. You're judging as ${me.name}: press Review ${reviewWhere}.` : `Redeemed. You're reviewing as ${me.name}.`, true);
        }
      } catch (e) { show(e.message, false); }
      busy = false; go.disabled = false;
    };
    const go = button("Redeem", submit, { primary: true });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    if (who) {
      wrap.append(
        h("p", {}, "Active key: ", h("b", { text: who.name }), ` (${ROLE_NAMES[who.role] || "reviewer"}).`),
        h("p", { class: "dim", text: `Review is ${reviewWhere}.` }),
        h("p", {}, button("Remove key", () => { forgetKey(); draw(); show("Key removed.", true); }, { cls: "wz-key-danger" })));
    } else {
      wrap.append(h("p", { text: "Enter a key you were given to review gallery uploads or judge a contest." }));
    }
    const acct = linkedAccount();
    wrap.append(
      h("p", { class: "dim", text: acct ? `Linked as ${acct}. A device code (WZL-…) from another device would switch to its account.` : "Or a device code (WZL-XXXX-XXXX) from a device where your account is linked: Wizascript tab → Undercards Account → Link another device." }),
      h("div", { class: "wz-key-row" }, input, go), status);
    if (!who) setTimeout(() => input.focus(), 50);
  }
  draw();
  return wrap;
}

// A small box over `host` (the Card Maker window), styled like the website's
// dialogs. Returns close().
export function openKeyOverlay(host, { reviewWhere } = {}) {
  host.querySelectorAll(":scope > .wz-key-back").forEach((n) => n.remove());
  const close = () => { back.remove(); document.removeEventListener("keydown", esc, true); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const box = h("div", { class: "wz-key-dialog", role: "dialog", "aria-label": "Redeem Key" },
    h("div", { class: "wz-key-dhead" }, h("b", { text: "Redeem Key" })),
    keyBox({ reviewWhere }),
    h("div", { class: "wz-key-dfoot" }, button("Close", close)));
  const back = h("div", { class: "wz-key-back", onclick: (e) => { if (e.target === back) close(); } }, box);
  host.appendChild(back);
  document.addEventListener("keydown", esc, true);
  return close;
}

// The ⚿ button. Its title says the active key.
export function keyButton(onClick) {
  const b = h("button", { type: "button", class: "wz-key-btn", "aria-label": "Redeem Key", onclick: onClick }, h("span", { text: "⚿" }));
  const sync = () => { const who = reviewerKey() && reviewerWho(); b.title = keyLabel(); b.classList.toggle("on", !!who); };
  onKeyChange(sync);
  sync();
  return b;
}

export const KEYBOX_CSS = `
.wz-key-btn { position: absolute; left: 8px; bottom: 8px; z-index: 30; width: 30px; height: 30px; border-radius: 15px; padding: 0;
  background: #000; color: #bbb; border: 1px solid #666; font-size: 16px; line-height: 28px; cursor: pointer; opacity: .55; }
.wz-key-btn:hover, .wz-key-btn:focus-visible { opacity: 1; color: #fff; border-color: #fff; }
.wz-key-btn.on { color: #ffd84a; border-color: #ffd84a; opacity: .9; }
.wz-key-back { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; padding: 16px; }
.wz-key-dialog { width: min(440px, 100%); background: #0d0d0d; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 6px 24px rgba(0,0,0,.8); font-size: 14px; color: #fff; }
.wz-key-dhead { padding: 10px 14px; border-bottom: 1px solid #444; font-size: 18px; }
.wz-key-dialog > .wz-key-box { padding: 12px 14px; }
.wz-key-dfoot { display: flex; justify-content: flex-end; padding: 8px 14px; border-top: 1px solid #444; }
.wz-key-box p { margin: 0 0 10px; }
.wz-key-box .dim { color: #aaa; font-size: 13px; }
.wz-key-row { display: flex; gap: 6px; }
.wz-key-row input { flex: 1; min-width: 0; height: 28px; background: #222; color: #fff; border: 1px solid #666; border-radius: 3px; padding: 0 8px; font: 14px Arial, sans-serif; }
.wz-key-row input:focus { border-color: #8ea6e8; outline: none; }
.wz-key-box .wz-cm-btn, .wz-key-dfoot .wz-cm-btn { height: 28px; padding: 0 14px; }
.wz-key-status { min-height: 1.2em; margin-top: 8px !important; }
.wz-cm-btn.wz-key-danger { background: #6b2f2f; border-color: #bf6f6f; }
`;
