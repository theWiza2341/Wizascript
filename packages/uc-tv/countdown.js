// packages/uc-tv/countdown.js

import { LOG, logDebug } from './settings.js';
import { getPrimaryKeyDisplay } from '../core/keybinds.js';

let activeCancelFn = null;

// Called from channel-guide.js's onPrimaryPress hook - a tap of
// Primary cancels any active auto-continue countdown, since "open the
// guide to pick manually" and "cancel the auto-pick" are the same
// underlying intent.
export function cancelActiveCountdown() {
  if (activeCancelFn) activeCancelFn();
}

export function showCountdown(plugin, seconds, onComplete) {
  if (plugin && typeof plugin.toast === 'function') {
    showCountdownViaToast(plugin, seconds, onComplete);
  } else {
    console.warn(`${LOG} plugin.toast not available - falling back to a custom overlay.`);
    showCountdownOverlay(seconds, onComplete);
  }
}

function cancelHint() {
  return `Cancel by pressing ${getPrimaryKeyDisplay()}`;
}

// Uses UnderScript's own toast system (the same one that shows the
// native "Game Finished / Return Home" toast on match end) instead of
// a hand-rolled overlay. This gets visual parity for free - it's
// literally the same component - and the native toast container
// (#AlertToast) stacks multiple simultaneous toasts on its own, so
// ours naturally lands above/below the native one rather than
// overlapping it. `.setText()` on the returned toast instance drives
// the live countdown (confirmed usage elsewhere in UnderScript's own
// code, e.g. a toast tracking update progress).
function showCountdownViaToast(plugin, seconds, onComplete) {
  let remaining = seconds;
  const toast = plugin.toast({
    title: 'UC TV',
    text: `Spectating a new match in ${remaining}s... (${cancelHint()})`
  });

  function cancel() {
    clearInterval(interval);
    activeCancelFn = null;
    if (toast && typeof toast.setText === 'function') toast.setText('Auto-continue canceled.');
    if (toast && typeof toast.close === 'function') setTimeout(() => toast.close(), 1500);
    logDebug('Auto-continue canceled - Primary pressed during countdown.');
  }
  activeCancelFn = cancel;

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      activeCancelFn = null;
      if (toast && typeof toast.close === 'function') toast.close();
      onComplete();
      return;
    }
    if (toast && typeof toast.setText === 'function') {
      toast.setText(`Spectating a new match in ${remaining}s... (${cancelHint()})`);
    }
  }, 1000);
}

// Fallback only - used if plugin.toast is ever unavailable.
function showCountdownOverlay(seconds, onComplete) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background: rgba(20,20,20,0.9);
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `;
  document.body.appendChild(overlay);

  let remaining = seconds;
  let canceled = false;

  function cancel() {
    if (canceled) return;
    canceled = true;
    activeCancelFn = null;
    overlay.textContent = `${LOG} Auto-continue canceled.`;
    setTimeout(() => overlay.remove(), 1500);
  }
  activeCancelFn = cancel;

  (function tick() {
    if (canceled) return;
    overlay.textContent = `${LOG} Spectating a new match in ${remaining}s... (${cancelHint()})`;
    if (remaining <= 0) {
      activeCancelFn = null;
      overlay.remove();
      onComplete();
      return;
    }
    remaining -= 1;
    setTimeout(tick, 1000);
  })();
}
