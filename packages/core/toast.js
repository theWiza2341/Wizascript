// packages/core/toast.js
//
// A toast button's click handler, under both of UnderScript's names:
// - `onclick` is the only one UnderScript 0.64 (SimpleToast 2) knows.
// - `onClick` is the 0.65+ name; `onclick` is deprecated there.
// 0.65 prefers `onClick` when both are given, so the handler runs once.
//   buttons: [{ text: "Open", ...toastClick(() => open()) }]

export function toastClick(fn) {
  return { onClick: fn, onclick: fn };
}
