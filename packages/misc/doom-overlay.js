// Doom Reminder (Clickbait Overlay) - the "unserious" version, styled
// after classic YouTube-clickbait reaction edits: a big red circle
// around the target, a random 1-4 arrows converging in from around
// it (each with its own "vine boom" hit), then one random reaction
// sound. Independent from the simpler chat-ping version - both can be
// enabled at once, or just one.
//
// Deliberately only watches the OPPONENT'S Doom (#enemyArtifacts) per
// the user's own call - if both players had Doom and this fired for
// both, it'd be visual chaos. See doom-shared.js for the confirmed
// selector and the turn-order-aware trigger gate, shared with the
// Classic (chat-ping) mode so both stay correct together.
//
// Audio files are expected at a fixed GitHub raw path (same pattern as
// bot/decks.json) - see SOUND_BASE_URL below. Simple <audio> playback
// doesn't need CORS the way GM_xmlhttpRequest/fetch would (cross-origin
// media elements can be played, just not sample-analyzed, without CORS
// headers), so no @connect grant is needed for this.
//
// Arrow geometry confirmed via live console iteration: each arrow is a
// single clip-path polygon (shaft blended directly into the
// triangular head) rather than two separately-shadowed pieces, since
// two pieces always showed a visible seam at the join. Positioned so
// the TIP - not the shape's bounding box - lands within 10px of the
// circle's edge, traveling in from well outside along its own angle
// rather than a fixed, disconnected travel distance.

import { findEnemyDoomElement, createDoomTurnGate } from "./doom-shared.js";

const turnGate = createDoomTurnGate();

const SOUND_BASE_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/main/packages/misc/sounds/";
const VINE_BOOM_SOUND = "vine-boom.mp3";
// "Bad to the Bone" deliberately excluded - copyright concern flagged
// by the user, dropped from the pool entirely.
const REMINDER_SOUND_POOL = [
  "prowler.mp3",
  "cave-sound.mp3",
  "violin.mp3",
  "bua-wa-wa.mp3",
  "metal-pipe.mp3",
  "hallway.mp3"
];

const ARROW_STAGGER_MS = 180;         // gap between each arrow's spawn
const REMINDER_SOUND_DELAY_MS = 400;  // pause after the last arrow lands, before the reaction sound
const TOTAL_DISPLAY_MS = 4200;        // how long the whole overlay stays up after the reaction sound
const FADE_OUT_MS = 700;

// Circle sized at 3.3x the artifact icon's own size (2.2x base, then
// 150% larger per the user's request).
const CIRCLE_SIZE_MULTIPLIER = 3.3;
const CIRCLE_TO_ARROW_TIP_GAP = 10; // how close each arrow's tip lands to the circle's edge
const ARROW_TRAVEL_DISTANCE = 420;  // how far outside the circle each arrow starts from

const ARROW_HEAD_LENGTH = 30;
const ARROW_HEAD_WIDTH = 56;
const ARROW_SHAFT_LENGTH = 60;
const ARROW_SHAFT_THICKNESS = 18;
const ARROW_TOTAL_LENGTH = ARROW_SHAFT_LENGTH + ARROW_HEAD_LENGTH; // tip sits at this local x
const ARROW_TIP_LOCAL_Y = ARROW_HEAD_WIDTH / 2;

function playSound(filename, baseVolume, getVolume) {
  try {
    const audio = new Audio(SOUND_BASE_URL + filename);
    audio.volume = baseVolume * getVolume();
    // Autoplay could theoretically be blocked in rare browser contexts
    // - this is a joke feature, not critical, so fail silently rather
    // than surfacing an error to the user.
    audio.play().catch(() => {});
  } catch (e) {}
}

function injectOverlayStyle() {
  if (document.getElementById("wizascript-doom-overlay-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-doom-overlay-style";
  style.textContent = `
.wizascript-doom-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  pointer-events: none;
  overflow: hidden;
}
.wizascript-doom-circle {
  position: absolute;
  box-sizing: border-box;
  border: 7px solid #ff1414;
  border-radius: 50%;
  box-shadow: 0 0 22px 5px rgba(255, 20, 20, 0.85);
  animation: wizascript-doom-pulse 0.55s ease-in-out infinite alternate;
}
@keyframes wizascript-doom-pulse {
  from { transform: scale(1); }
  to { transform: scale(1.07); }
}
.wizascript-doom-arrow {
  position: absolute;
  opacity: 0;
  background: #ff1414;
  filter: drop-shadow(0 0 6px rgba(0,0,0,0.65));
  transition: left 0.4s cubic-bezier(.2,.8,.3,1.15), top 0.4s cubic-bezier(.2,.8,.3,1.15), opacity 0.2s ease-out;
}
.wizascript-doom-arrow.wizascript-doom-arrow-in {
  opacity: 1;
}
.wizascript-doom-fade-out {
  transition: opacity ${FADE_OUT_MS}ms ease-out;
  opacity: 0 !important;
}
`;
  document.head.appendChild(style);
}

// One seamless polygon per arrow - shaft blended directly into the
// triangular head, no separate pieces, no visible seam between them.
function buildArrowElement() {
  const upperShoulderY = (ARROW_HEAD_WIDTH - ARROW_SHAFT_THICKNESS) / 2;
  const lowerShoulderY = (ARROW_HEAD_WIDTH + ARROW_SHAFT_THICKNESS) / 2;

  const arrow = document.createElement("div");
  arrow.className = "wizascript-doom-arrow";
  arrow.style.width = ARROW_TOTAL_LENGTH + "px";
  arrow.style.height = ARROW_HEAD_WIDTH + "px";
  arrow.style.clipPath = `polygon(
    ${ARROW_TOTAL_LENGTH}px ${ARROW_HEAD_WIDTH / 2}px,
    ${ARROW_SHAFT_LENGTH}px 0px,
    ${ARROW_SHAFT_LENGTH}px ${upperShoulderY}px,
    0px ${upperShoulderY}px,
    0px ${lowerShoulderY}px,
    ${ARROW_SHAFT_LENGTH}px ${lowerShoulderY}px,
    ${ARROW_SHAFT_LENGTH}px ${ARROW_HEAD_WIDTH}px
  )`;
  return arrow;
}

function showDoomOverlay(getVolume) {
  const doomEl = findEnemyDoomElement();
  if (!doomEl) return; // enemy doesn't currently have Doom equipped/visible - nothing to point at

  injectOverlayStyle();

  const rect = doomEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const overlay = document.createElement("div");
  overlay.className = "wizascript-doom-overlay";

  const circleSize = Math.max(rect.width, rect.height) * CIRCLE_SIZE_MULTIPLIER;
  const circleRadius = circleSize / 2;
  const circle = document.createElement("div");
  circle.className = "wizascript-doom-circle";
  circle.style.width = circleSize + "px";
  circle.style.height = circleSize + "px";
  circle.style.left = (centerX - circleSize / 2) + "px";
  circle.style.top = (centerY - circleSize / 2) + "px";
  overlay.appendChild(circle);

  document.body.appendChild(overlay);

  // Random 1-4 arrows each time, spawned at a random angle within its
  // own equal angular "slot" around the circle - guarantees no two
  // arrows can overlap while still varying every time this fires.
  const arrowCount = 1 + Math.floor(Math.random() * 4);
  const slotSize = 360 / arrowCount;

  for (let i = 0; i < arrowCount; i++) {
    const angleDeg = i * slotSize + Math.random() * slotSize;

    setTimeout(() => {
      const angleRad = angleDeg * Math.PI / 180;
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);

      const endDist = circleRadius + CIRCLE_TO_ARROW_TIP_GAP;
      const endX = centerX + endDist * dirX;
      const endY = centerY + endDist * dirY;

      const startDist = endDist + ARROW_TRAVEL_DISTANCE;
      const startX = centerX + startDist * dirX;
      const startY = centerY + startDist * dirY;

      const pointAngle = angleDeg + 180; // arrow's built-in tip faces +x; rotate it to aim back at center

      const arrow = buildArrowElement();
      arrow.style.transformOrigin = `${ARROW_TOTAL_LENGTH}px ${ARROW_TIP_LOCAL_Y}px`;
      arrow.style.transform = `rotate(${pointAngle}deg)`;
      arrow.style.left = (startX - ARROW_TOTAL_LENGTH) + "px";
      arrow.style.top = (startY - ARROW_TIP_LOCAL_Y) + "px";
      overlay.appendChild(arrow);

      playSound(VINE_BOOM_SOUND, 0.8, getVolume);

      // Force layout to register the starting position before
      // triggering the transition, or the browser may skip straight
      // to the end position with no visible animation.
      requestAnimationFrame(() => {
        arrow.classList.add("wizascript-doom-arrow-in");
        arrow.style.left = (endX - ARROW_TOTAL_LENGTH) + "px";
        arrow.style.top = (endY - ARROW_TIP_LOCAL_Y) + "px";
      });
    }, i * ARROW_STAGGER_MS);
  }

  const allArrowsLandedDelay = arrowCount * ARROW_STAGGER_MS + REMINDER_SOUND_DELAY_MS;
  setTimeout(() => {
    const pick = REMINDER_SOUND_POOL[Math.floor(Math.random() * REMINDER_SOUND_POOL.length)];
    playSound(pick, 1, getVolume);
  }, allArrowsLandedDelay);

  setTimeout(() => {
    overlay.classList.add("wizascript-doom-fade-out");
    setTimeout(() => overlay.remove(), FADE_OUT_MS);
  }, allArrowsLandedDelay + TOTAL_DISPLAY_MS);
}

export function resetDoomOverlayForMatchStart(turn) {
  if (turn <= 1) {
    turnGate.reset();
  }
}

export function registerDoomOverlay(plugin, isEnabled, getVolume) {
  plugin.events.on("GameEvent", event => {
    if (!isEnabled()) return;

    if (turnGate.checkEvent(event)) {
      showDoomOverlay(getVolume);
    }
  });
}
