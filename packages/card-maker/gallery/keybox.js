// packages/card-maker/gallery/keybox.js
//
// The key button (⚿) at the bottom left of the Card Gallery, and its box
// (1.7.4; before that, Redeem Key was a setting on the Card Maker tab). The
// same module is bundled into the gallery website, so both are 1:1.
//
// The box takes a gallery key (review or contest judging), checked with the
// server and kept in GM storage (not readable by the page, never in backups).
//
// Next to it, the 📱 button (1.7.4) links another device to the same
// Undercards account: Generate a code on a linked device, or Redeem a code
// (WZL-XXXX-XXXX) on the new one.

import { h, button } from "./dom.js";
import { reviewWhoami } from "./api.js";
import { isDeviceCode, redeemDeviceCode, linkedAccount, linkShare, setGalleryKeyBridge } from "../../core/account.js";

export const REVIEW_KEY = "wizascript.cardMaker.galleryReview";
export const REVIEW_WHO = "wizascript.cardMaker.galleryReviewWho";
export const ROLE_NAMES = { owner: "owner", reviewer: "reviewer", judge: "judge" };
export const reviewerKey = () => { try { return String(GM_getValue(REVIEW_KEY, "") || ""); } catch (e) { return ""; } };
export const reviewerWho = () => { try { return JSON.parse(GM_getValue(REVIEW_WHO, "null")); } catch (e) { return null; } };
export const keyLabel = () => { const who = reviewerKey() && reviewerWho(); return who ? `Key: ${who.name} (${ROLE_NAMES[who.role] || "reviewer"})` : "Redeem Key"; };

// Device codes carry the key along (core/account.js asks here).
setGalleryKeyBridge({ get: () => reviewerKey(), put: (k) => redeemKey(k) });

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
  if (!k) throw new Error("Enter the key you were given.");
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
    // Only a real change (renamed key, new role) redraws: an unchanged key
    // must not reset Review (e.g. the section the reviewer just opened).
    const who = JSON.stringify({ name: me.name, role: me.role });
    if (GM_getValue(REVIEW_WHO, "") === who) return;
    GM_setValue(REVIEW_WHO, who);
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
    const input = h("input", { type: "password", placeholder: "Key", autocomplete: "off", spellcheck: false });
    let busy = false;
    const submit = async () => {
      if (busy) return;
      busy = true; go.disabled = true; show("Checking…", true);
      try {
        if (isDeviceCode(input.value)) throw new Error("That's a device code: use the 📱 button next to this one.");
        const me = await redeemKey(input.value);
        draw();
        show(me.role === "judge" ? `Redeemed. You're judging as ${me.name}: press Review ${reviewWhere}.` : `Redeemed. You're reviewing as ${me.name}.`, true);
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
    wrap.append(h("div", { class: "wz-key-row" }, input, go), status);
    if (!who) setTimeout(() => input.focus(), 50);
  }
  draw();
  return wrap;
}

// A small box over `host` (the Card Maker window), styled like the website's
// dialogs. Returns close().
export function openOverlay(host, title, content) {
  host.querySelectorAll(":scope > .wz-key-back").forEach((n) => n.remove());
  const close = () => { back.remove(); document.removeEventListener("keydown", esc, true); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const box = h("div", { class: "wz-key-dialog", role: "dialog", "aria-label": title },
    h("div", { class: "wz-key-dhead" }, h("b", { text: title })),
    content,
    h("div", { class: "wz-key-dfoot" }, button("Close", close)));
  const back = h("div", { class: "wz-key-back", onclick: (e) => { if (e.target === back) close(); } }, box);
  host.appendChild(back);
  document.addEventListener("keydown", esc, true);
  return close;
}
export const openKeyOverlay = (host, { reviewWhere } = {}) => openOverlay(host, "Redeem Key", keyBox({ reviewWhere }));
export const DEVICE_TITLE = "Link a Mobile Account";
export const openDeviceOverlay = (host, opts) => openOverlay(host, DEVICE_TITLE, deviceBox(opts));

// ---- 📱 Link a Mobile Account -------------------------------------------------------
// Two choices: Generate a code (this device is linked; the code links another
// one to the same account) or Redeem a code (made on a linked device).
// notLinked: what to tell an unlinked device that wants to generate a code.
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export function deviceBox({ notLinked = "Link your account first (Link my account), then make the code here." } = {}) {
  const wrap = h("div", { class: "wz-key-box wz-dev-box" });
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; };
  const back = () => button("Back", () => { stop(); choose(); });
  let carry = true; // bring this device's gallery key along (when it has one)

  function choose() {
    const acct = linkedAccount();
    const who = reviewerKey() && reviewerWho();
    const box = who ? h("label", { class: "wz-dev-carry" },
      h("input", { type: "checkbox", checked: carry, onchange: (e) => { carry = e.target.checked; } }),
      ` Bring my gallery key (${who.name}, ${ROLE_NAMES[who.role] || "reviewer"}) too`) : null;
    wrap.replaceChildren(
      h("p", { text: "Use the Card Gallery on your phone or another computer with the same Undercards account." }),
      h("div", { class: "wz-dev-choices" },
        button("Generate a code", generate, { primary: true, title: "On a device where your account is linked" }),
        button("Redeem a code", redeem, { title: "On the new device" })),
      box,
      h("p", { class: "dim", text: acct ? `This device is linked as ${acct}.` : "This device isn't linked yet." }));
  }

  async function generate() {
    stop();
    if (!linkedAccount()) {
      wrap.replaceChildren(h("p", { class: "wz-key-status", style: "color:#f77", text: `This device isn't linked. ${notLinked}` }), h("p", {}, back()));
      return;
    }
    wrap.replaceChildren(h("p", { text: "Making a code…" }));
    let r;
    try { r = await linkShare(carry); } catch (e) {
      wrap.replaceChildren(h("p", { class: "wz-key-status", style: "color:#f77", text: (e && e.message) || "Couldn't reach the Wizascript server." }), h("p", {}, back()));
      return;
    }
    if (!wrap.isConnected) return;
    const code = h("div", { class: "wz-dev-code", text: r.code, title: "Select to copy" });
    const left = h("span", { class: "dim" });
    const tick = () => {
      if (!wrap.isConnected) return stop();
      const ms = r.expiresAt - Date.now();
      if (ms <= 0) { stop(); left.textContent = "Expired. Make a new one."; code.style.opacity = ".35"; return; }
      left.textContent = `Expires in ${fmtLeft(ms)}. Works once.`;
    };
    timer = setInterval(tick, 1000);
    tick();
    wrap.replaceChildren(
      h("p", { text: `A code for ${linkedAccount() || r.account}:` }),
      code,
      h("p", {}, left),
      r.carries ? h("p", { text: `It also brings your gallery key (${r.carries.name}, ${ROLE_NAMES[r.carries.role] || r.carries.role}). Keep the code to yourself.` }) : null,
      r.keyDropped ? h("p", { class: "wz-key-status", style: "color:#f77", text: "Your gallery key isn't valid anymore, so the code doesn't bring it." }) : null,
      h("p", { class: "dim", text: "On the other device, open the Card Gallery (the website, or Card Maker in Wizascript), press 📱, then Redeem a code." }),
      h("div", { class: "wz-key-row" }, back(), button("New code", generate)));
  }

  function redeem() {
    stop();
    const acct = linkedAccount();
    const input = h("input", { type: "text", placeholder: "WZL-XXXX-XXXX", autocomplete: "off", spellcheck: false, class: "wz-dev-input" });
    const status = h("p", { class: "wz-key-status" });
    const show = (text, ok) => { status.textContent = text; status.style.color = ok ? "#7f7" : "#f77"; };
    let busy = false;
    const submit = async () => {
      if (busy) return;
      if (!isDeviceCode(input.value)) { show("Codes look like WZL-XXXX-XXXX.", false); return; }
      busy = true; go.disabled = true; show("Checking…", true);
      try {
        const r = await redeemDeviceCode(input.value);
        input.value = "";
        show(`Linked as ${r.account}.${r.key ? ` Your gallery key came too (${r.key.name}, ${ROLE_NAMES[r.key.role] || r.key.role}).` : ""}`, true);
      } catch (e) { show(e.message, false); }
      busy = false; go.disabled = false;
    };
    const go = button("Redeem", submit, { primary: true });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    wrap.replaceChildren(
      h("p", { text: "Enter the code from a device where your account is linked (📱 → Generate a code there)." }),
      ...(acct ? [h("p", { class: "dim", text: `This device is linked as ${acct}; a code switches it to the code's account.` })] : []),
      h("div", { class: "wz-key-row" }, input, go), status,
      h("p", {}, back()));
    setTimeout(() => input.focus(), 50);
  }

  choose();
  return wrap;
}
// The 📱 button, next to ⚿.
export function deviceButton(onClick) {
  return h("button", { type: "button", class: "wz-key-btn wz-dev-btn", title: DEVICE_TITLE, "aria-label": DEVICE_TITLE, onclick: onClick }, h("span", { text: "📱" }));
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
.wz-key-btn.wz-dev-btn { left: 44px; font-size: 15px; }
.wz-dev-choices { display: flex; gap: 8px; margin: 0 0 10px; }
.wz-key-box .wz-dev-choices .wz-cm-btn { flex: 1; height: 40px; font-size: 15px; }
.wz-dev-code { font: 24px "DTM-Mono", "DTM Mono", monospace; letter-spacing: 2px; text-align: center; padding: 8px; margin: 0 0 8px; background: #000; border: 1px solid #666; user-select: all; }
.wz-key-row input.wz-dev-input { text-transform: uppercase; }
.wz-dev-carry { display: block; margin: 0 0 10px; font-size: 13px; cursor: pointer; }
`;
