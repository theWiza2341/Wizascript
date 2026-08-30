// packages/controller/gamepad.js
//
// Everything to do with reading a physical controller: merging the browser
// Gamepad API's per-slot state into one pseudo-Gamepad object, the WebHID
// fallback path for the Switch Pro Controller (whose native Gamepad-API
// button translation is confirmed broken over Bluetooth), per-pad axis
// auto-recentering, and the button-label tables the rest of the package
// displays to the user. Self-contained: nothing in here depends on
// settings/storage/DOM-navigation state, only on the raw input devices
// themselves and the small on-screen diagnostic indicator this module
// owns.

// ---------- on-screen input indicator ----------
// Big, unmissable, top-center - lets a live test be read purely by eye,
// no devtools/console required. Every button press and stick movement
// this module decodes (raw WebHID bits during discovery, or a confirmed
// merged/calibrated edge once frame() is acting on it) can flash this.
export const pressIndicator = document.createElement('div');
Object.assign(pressIndicator.style, {
  position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
  zIndex: 2147483647, background: 'rgba(0,150,0,0.92)', color: '#fff',
  font: 'bold 22px -apple-system, "Segoe UI", sans-serif',
  padding: '10px 22px', borderRadius: '10px', pointerEvents: 'none',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)', display: 'none', textAlign: 'center'
});
let pressIndicatorHideTimer = null;
export function showPressIndicator(text) {
  pressIndicator.textContent = text;
  pressIndicator.style.display = 'block';
  if (pressIndicatorHideTimer) clearTimeout(pressIndicatorHideTimer);
  pressIndicatorHideTimer = setTimeout(() => { pressIndicator.style.display = 'none'; }, 1000);
}

// ---------- WebHID connect button ----------
// WebHID's requestDevice() is spec-required to run from a real user
// gesture (it shows the browser's own device picker) - this is the one
// unavoidable manual step, needed only once ever per browser profile
// since the granted permission persists across reloads (see
// tryAutoReconnectWebHid below).
export const hidConnectBtn = document.createElement('button');
hidConnectBtn.textContent = '🎮 Connect Controller (WebHID)';
Object.assign(hidConnectBtn.style, {
  position: 'fixed', top: '16px', right: '16px', zIndex: 2147483647,
  padding: '8px 14px', borderRadius: '8px', border: 'none',
  background: '#2a6', color: '#fff', fontWeight: 'bold', fontSize: '13px',
  cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
});
hidConnectBtn.addEventListener('click', () => { connectWebHidController(); });

// ---------- button labels ----------
// PlayStation-style glyphs - the default/fallback, used whenever the
// connected device isn't the WebHID Switch Pro Controller.
export const BUTTON_LABELS = {
  0: '✕', 1: '○', 2: '□', 3: '△',
  4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2',
  8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3',
  12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right',
  16: 'Home', 17: 'Touchpad'
};
// Nintendo-style labels, same slot POSITIONS as BUTTON_LABELS above (this
// is exactly the confirmed WebHID mapping's own physical-position table,
// just expressed as display strings instead of bit values) - shown
// whenever the WebHID Pro Controller is the connected device, so
// on-screen button hints match what's actually printed on the controller.
export const BUTTON_LABELS_NINTENDO = {
  0: 'B', 1: 'A', 2: 'Y', 3: 'X',
  4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR',
  8: '-', 9: '+', 10: 'L3', 11: 'R3',
  12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right',
  16: 'Home', 17: 'Capture'
};
export function activeButtonLabelTable() {
  return hidDevice ? BUTTON_LABELS_NINTENDO : BUTTON_LABELS;
}
export function btnLabel(idx) {
  return activeButtonLabelTable()[idx] || ('Button ' + idx);
}
export function buttonToDisplay(idx) {
  if (idx === null || idx === undefined) return 'Unbound';
  return btnLabel(idx);
}

// ---------- per-pad axis auto-recentering ----------
// Some pads (confirmed live with a Switch Pro Controller over Bluetooth,
// which self-identifies generically as "Wireless Gamepad" rather than
// through a native mapping) report their rest position as a fixed
// nonzero offset instead of 0/0 - a flat, unmoving, non-zero reading is
// far more consistent with a miscentered calibration than with live
// mechanical drift (real drift almost always jitters frame-to-frame even
// while "stuck"). getCalibratedAxes() watches each pad's own raw axes;
// whenever an axis holds essentially flat (within 0.02) for ~1.5
// continuous seconds, THAT value becomes its new zero-point, subtracted
// out of every future reading before the deadzone runs. A normally
// centered pad just "confirms" a baseline of ~0, so this is a no-op for
// it.
const AXIS_CALIBRATION = new Map(); // pad.id -> { baseline[], lastRaw[], stableFrames[] }
const AXIS_STABLE_FRAMES_NEEDED = 90; // ~1.5s at 60fps
const AXIS_JITTER_EPS = 0.02;
function getCalibratedAxes(pad) {
  let cal = AXIS_CALIBRATION.get(pad.id);
  if (!cal) {
    cal = {
      baseline: pad.axes.map(() => 0),
      lastRaw: pad.axes.slice(),
      stableFrames: pad.axes.map(() => 0)
    };
    AXIS_CALIBRATION.set(pad.id, cal);
  }
  pad.axes.forEach((v, i) => {
    const prev = cal.lastRaw[i] !== undefined ? cal.lastRaw[i] : v;
    if (Math.abs(v - prev) < AXIS_JITTER_EPS) {
      cal.stableFrames[i] = (cal.stableFrames[i] || 0) + 1;
    } else {
      cal.stableFrames[i] = 0;
    }
    cal.lastRaw[i] = v;
    if (cal.stableFrames[i] === AXIS_STABLE_FRAMES_NEEDED && Math.abs(v - (cal.baseline[i] || 0)) > AXIS_JITTER_EPS) {
      cal.baseline[i] = v;
      console.log(`[Wizascript Controller] axis ${i} on "${pad.id}" recalibrated to neutral=${v.toFixed(3)} after holding steady for ~1.5s`);
    }
  });
  return pad.axes.map((v, i) => Math.max(-1, Math.min(1, v - (cal.baseline[i] || 0))));
}

// ---------- WebHID path for the Switch Pro Controller ----------
// Byte layout pulled from dekuNukem's Nintendo_Switch_Reverse_Engineering
// repo (bluetooth_hid_notes.md), INPUT REPORT 0x3F ("Simple HID mode").
// Sticks + d-pad (hat) confidence: HIGH, checked against the doc's own
// decode formula and hat convention. Face/shoulder/misc buttons:
// CONFIRMED live via an ordered, one-button-at-a-time test
// (A,B,X,Y,L,R,ZL,ZR,Minus,Plus,L-stick-click,R-stick-click,Capture,Home).
const WEBHID_VENDOR_ID = 0x057e; // Nintendo
let hidDevice = null;
export function isHidConnected() { return !!hidDevice; }
const hidState = { axes: [0, 0, 0, 0], hat: 8, raw1: 0, raw2: 0 };
const lastLoggedHidBits = { raw1: 0, raw2: 0 };

function decodeHidReport(dataView) {
  // dataView is event.data - the WebHID spec strips the report-ID byte,
  // so every offset below is the doc's own byte number MINUS 1.
  if (dataView.byteLength < 11) return;
  const raw1 = dataView.getUint8(0);   // doc byte 1
  const raw2 = dataView.getUint8(1);   // doc byte 2
  const hat = dataView.getUint8(2);    // doc byte 3
  const lh = dataView.getUint16(3, true); // doc bytes 4-5 (left stick horizontal)
  const lv = dataView.getUint16(5, true); // doc bytes 6-7 (left stick vertical)
  const rh = dataView.getUint16(7, true); // doc bytes 8-9 (right stick horizontal)
  const rv = dataView.getUint16(9, true); // doc bytes 10-11 (right stick vertical)
  const norm = (v) => Math.max(-1, Math.min(1, (v - 32768) / 32768));
  hidState.axes = [norm(lh), norm(lv), norm(rh), norm(rv)];
  hidState.hat = hat;
  hidState.raw1 = raw1;
  hidState.raw2 = raw2;

  // Raw bit discovery diagnostic - edge-triggered per bit, per byte, kept
  // in place alongside the confirmed mapping below in case a future
  // controller/report shape needs the same discovery process repeated.
  for (let bit = 0; bit < 8; bit++) {
    const mask = 1 << bit;
    const wasR1 = !!(lastLoggedHidBits.raw1 & mask), isR1 = !!(raw1 & mask);
    if (wasR1 !== isR1) {
      console.log(`[Wizascript Controller] WebHID raw bit B1.0x${mask.toString(16).padStart(2, '0')} -> ${isR1 ? 'DOWN' : 'UP'}`);
      if (isR1) showPressIndicator(`🎮 WebHID B1.0x${mask.toString(16).padStart(2, '0')} pressed`);
    }
    const wasR2 = !!(lastLoggedHidBits.raw2 & mask), isR2 = !!(raw2 & mask);
    if (wasR2 !== isR2) {
      console.log(`[Wizascript Controller] WebHID raw bit B2.0x${mask.toString(16).padStart(2, '0')} -> ${isR2 ? 'DOWN' : 'UP'}`);
      if (isR2) showPressIndicator(`🎮 WebHID B2.0x${mask.toString(16).padStart(2, '0')} pressed`);
    }
  }
  lastLoggedHidBits.raw1 = raw1;
  lastLoggedHidBits.raw2 = raw2;
}

function handleHidInputReport(event) {
  if (event.reportId !== 0x3f) return; // only Simple HID mode reports
  decodeHidReport(event.data);
}

// Only one physical WebHID connection is supported at a time - if
// `hidDevice` is already set, later open calls (whether from the manual
// button or the auto-reconnect check firing right after it) are no-ops,
// so a real device is never double-listened-to.
async function openHidDevice(device) {
  if (hidDevice) {
    console.log('[Wizascript Controller] WebHID device already connected, ignoring duplicate open call.');
    return;
  }
  try {
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', handleHidInputReport);
    hidDevice = device;
    console.log('[Wizascript Controller] WebHID device opened:', device.productName || device.vendorId + ':' + device.productId);
    hidConnectBtn.textContent = '🎮 Controller Connected';
    hidConnectBtn.disabled = true;
    hidConnectBtn.style.background = '#555';
    hidConnectBtn.style.cursor = 'default';
  } catch (e) {
    console.log('[Wizascript Controller] WebHID open failed:', e);
  }
}

export async function connectWebHidController() {
  if (!navigator.hid) {
    console.log('[Wizascript Controller] navigator.hid is not available in this browser/context - WebHID cannot be used.');
    return;
  }
  try {
    const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: WEBHID_VENDOR_ID }] });
    if (!devices.length) { console.log('[Wizascript Controller] WebHID device picker closed with no selection.'); return; }
    await openHidDevice(devices[0]);
  } catch (e) {
    console.log('[Wizascript Controller] WebHID requestDevice failed:', e);
  }
}

// Permission granted via requestDevice() persists - no fresh user gesture
// needed on later page loads, navigator.hid.getDevices() just returns
// whatever was already authorized.
(async function tryAutoReconnectWebHid() {
  if (!navigator.hid) return;
  try {
    const devices = await navigator.hid.getDevices();
    const match = devices.find((d) => d.vendorId === WEBHID_VENDOR_ID);
    if (match) await openHidDevice(match);
  } catch (e) {
    console.log('[Wizascript Controller] WebHID auto-reconnect check failed:', e);
  }
})();

// ---------- merged gamepad read ----------
// navigator.getGamepads() returns one slot per gamepad the browser has
// ever seen connected this page load, indexed by connection order - NOT
// just "the active one." Reading only the first non-null slot silently
// ignores every other connected pad. getMergedGamepad() reads every
// connected slot (plus the WebHID pad, if connected) and merges them
// into one pseudo-Gamepad-shaped object every frame: a button counts as
// pressed if ANY connected pad reports it pressed (value = the max
// reported across pads, so analog triggers still work), and each axis
// takes whichever connected pad reports the largest magnitude on that
// axis index that frame.
export function getMergedGamepad() {
  let rawPads = Array.from(navigator.getGamepads()).filter((p) => p);
  // Exclude the NATIVE Gamepad-API entry for the same physical device once
  // WebHID is handling it - this device's native Gamepad-API button
  // translation is confirmed broken/untrustworthy over Bluetooth (a
  // mouse-free flash test proved no genuine button press ever reached the
  // Gamepad API), which is the entire reason the WebHID path exists. The
  // native pad is only ever kept in the OR-merge so a SEPARATE controller
  // (e.g. a DS4) can stay merged in alongside it - never meant to still be
  // trusted for BUTTON data on this exact device once WebHID supersedes
  // it. Matched by vendor+product ID against the connected HIDDevice, so
  // this holds for any Nintendo Pro Controller, not one specific id
  // string.
  if (hidDevice) {
    const vidHex = hidDevice.vendorId.toString(16).padStart(4, '0');
    const pidHex = hidDevice.productId.toString(16).padStart(4, '0');
    rawPads = rawPads.filter((p) => {
      const id = (p.id || '').toLowerCase();
      const isSameDevice = id.includes(vidHex) && id.includes(pidHex);
      if (isSameDevice) console.log('[Wizascript Controller] excluding native Gamepad-API entry for the WebHID-connected device from the merge (buttons unreliable over Bluetooth):', p.id);
      return !isSameDevice;
    });
  }
  // Fold in the WebHID Switch Pro Controller (if connected) as a synthetic
  // pad using the same {id, buttons, axes} shape everything else already
  // merges - sticks + d-pad (indices 12-15) and every face/shoulder/misc
  // button below are wired to the confirmed byte-level mapping.
  if (hidDevice) {
    const hidButtons = new Array(18).fill(null).map(() => ({ pressed: false, value: 0 }));
    const hat = hidState.hat;
    hidButtons[12] = { pressed: hat === 0 || hat === 1 || hat === 7, value: 0 }; // up
    hidButtons[15] = { pressed: hat === 1 || hat === 2 || hat === 3, value: 0 }; // right
    hidButtons[13] = { pressed: hat === 3 || hat === 4 || hat === 5, value: 0 }; // down
    hidButtons[14] = { pressed: hat === 5 || hat === 6 || hat === 7, value: 0 }; // left
    // Mapped onto the same Standard Gamepad slot POSITIONS this whole
    // package already assumes (0=bottom-face/✕-slot,1=right-face/○-slot,
    // 2=left-face/□-slot,3=top-face/△-slot,4=L1,5=R1,6=L2,7=R2,8=Select,
    // 9=Start,10=L3,11=R3,16=Home,17=Touchpad) using PHYSICAL POSITION,
    // same convention Chrome itself uses for a natively-mapped pad.
    const r1 = hidState.raw1, r2 = hidState.raw2;
    hidButtons[0] = { pressed: !!(r1 & 0x01), value: 0 };  // B (bottom)
    hidButtons[1] = { pressed: !!(r1 & 0x02), value: 0 };  // A (right)
    hidButtons[2] = { pressed: !!(r1 & 0x04), value: 0 };  // Y (left)
    hidButtons[3] = { pressed: !!(r1 & 0x08), value: 0 };  // X (top)
    hidButtons[4] = { pressed: !!(r1 & 0x10), value: r1 & 0x10 ? 1 : 0 }; // L
    hidButtons[5] = { pressed: !!(r1 & 0x20), value: r1 & 0x20 ? 1 : 0 }; // R
    hidButtons[6] = { pressed: !!(r1 & 0x40), value: r1 & 0x40 ? 1 : 0 }; // ZL
    hidButtons[7] = { pressed: !!(r1 & 0x80), value: r1 & 0x80 ? 1 : 0 }; // ZR
    hidButtons[8] = { pressed: !!(r2 & 0x01), value: 0 };  // Minus
    hidButtons[9] = { pressed: !!(r2 & 0x02), value: 0 };  // Plus
    hidButtons[10] = { pressed: !!(r2 & 0x04), value: 0 }; // L-stick click
    hidButtons[11] = { pressed: !!(r2 & 0x08), value: 0 }; // R-stick click
    hidButtons[16] = { pressed: !!(r2 & 0x10), value: 0 }; // Home
    hidButtons[17] = { pressed: !!(r2 & 0x20), value: 0 }; // Capture
    rawPads.push({ id: 'WebHID Switch Pro Controller', buttons: hidButtons, axes: hidState.axes.slice() });
  }
  if (!rawPads.length) return null;
  const pads = rawPads.map((p) => ({ id: p.id, buttons: p.buttons, axes: getCalibratedAxes(p) }));
  if (pads.length === 1) return pads[0];
  const buttonCount = Math.max(...pads.map((p) => p.buttons.length));
  const axesCount = Math.max(...pads.map((p) => p.axes.length));
  const buttons = [];
  for (let i = 0; i < buttonCount; i++) {
    let pressed = false, value = 0;
    for (const p of pads) {
      const b = p.buttons[i];
      if (!b) continue;
      if (b.pressed) pressed = true;
      if (b.value > value) value = b.value;
    }
    buttons.push({ pressed, value });
  }
  const axes = [];
  for (let i = 0; i < axesCount; i++) {
    let best = 0;
    for (const p of pads) {
      const v = p.axes[i];
      if (v === undefined) continue;
      if (Math.abs(v) > Math.abs(best)) best = v;
    }
    axes.push(best);
  }
  return { buttons, axes, _mergedFrom: pads.map((p) => p.id) };
}

window.addEventListener('gamepadconnected', (e) => {
  console.log('[Wizascript Controller] gamepadconnected:', {
    index: e.gamepad.index, id: e.gamepad.id, mapping: e.gamepad.mapping,
    buttons: e.gamepad.buttons.length, axes: e.gamepad.axes.length
  });
});
window.addEventListener('gamepaddisconnected', (e) => {
  console.log('[Wizascript Controller] gamepaddisconnected:', { index: e.gamepad.index, id: e.gamepad.id });
});

// ---------- diagnostics ----------
// Raw per-pad dump, throttled to only log when the snapshot actually
// changes (pressed indices changed, or any axis moved by more than a
// small epsilon) rather than on a fixed interval, so a permanently-stuck
// raw axis can't spam identical lines forever.
const lastLoggedRawSnapshot = new Map(); // pad.id -> { pressedIdx: [...], axes: [...] }
function rawSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.pressedIdx.length !== b.pressedIdx.length) return false;
  for (let i = 0; i < a.pressedIdx.length; i++) if (a.pressedIdx[i] !== b.pressedIdx[i]) return false;
  if (a.axes.length !== b.axes.length) return false;
  for (let i = 0; i < a.axes.length; i++) if (Math.abs(a.axes[i] - b.axes[i]) > 0.03) return false;
  return true;
}
export function logRawGamepadStateIfChanged() {
  const pads = Array.from(navigator.getGamepads()).filter((p) => p);
  if (!pads.length) return;
  pads.forEach((p) => {
    const pressedIdx = p.buttons.map((b, i) => (b.pressed ? i : null)).filter((i) => i !== null);
    const snapshot = { pressedIdx, axes: p.axes.slice() };
    const prev = lastLoggedRawSnapshot.get(p.id);
    if (rawSnapshotsEqual(prev, snapshot)) return;
    lastLoggedRawSnapshot.set(p.id, snapshot);
    console.log(`[Wizascript Controller] raw gamepad[${p.index}] "${p.id}" mapping="${p.mapping}" pressed=[${pressedIdx.join(',')}] axes=[${p.axes.map((v) => v.toFixed(2)).join(',')}]`);
  });
}

// Edge-triggered log of the MERGED/CALIBRATED state the main loop actually
// acts on - the on-screen indicator flash needs no console/devtools open
// to read.
let lastMergedButtonState = [];
let lastUsingControllerLogged = null;
let lastAnyStickState = false;
export function logMergedInputEdges(gp, usingControllerNow, anyStickNow) {
  if (lastUsingControllerLogged !== usingControllerNow) {
    lastUsingControllerLogged = usingControllerNow;
    console.log(`[Wizascript Controller] usingController -> ${usingControllerNow}`);
  }
  gp.buttons.forEach((b, i) => {
    const was = !!lastMergedButtonState[i];
    const is = !!(b && b.pressed);
    if (was !== is) {
      console.log(`[Wizascript Controller] MERGED button ${i} (${buttonToDisplay(i)}) -> ${is ? 'DOWN' : 'UP'}`);
      if (is) showPressIndicator('🎮 ' + buttonToDisplay(i) + ' pressed');
    }
    lastMergedButtonState[i] = is;
  });
  if (!!anyStickNow !== lastAnyStickState) {
    lastAnyStickState = !!anyStickNow;
    if (lastAnyStickState) showPressIndicator('🕹 Stick moved');
  }
}
