// Doom Reminder (Clickbait Overlay) - the "unserious" version, styled
// after classic YouTube-clickbait reaction edits: a big red circle
// around the target, arrows converging from every corner (each with
// its own "vine boom" hit), comic-style outlined text, then one random
// reaction sound. Independent from the simpler chat-ping version -
// both can be enabled at once, or just one.
//
// Deliberately only watches the OPPONENT'S Doom (#enemyArtifacts) per
// the user's own call - if both players had Doom and this fired for
// both, it'd be visual chaos. Confirmed selector directly from live
// DOM: every artifact icon carries a `name="..."` attribute matching
// its real display name, so `#enemyArtifacts img.artifact-img[name="Doom"]`
// reliably finds Doom specifically with no fuzzy matching needed. This
// query IS the detection check too - checked fresh every time we'd
// trigger, not just once at match load, so it's automatically correct
// even if Doom is somehow acquired mid-match.
//
// Audio files are expected at a fixed GitHub raw path (same pattern as
// bot/decks.json) - see SOUND_BASE_URL below. Simple <audio> playback
// doesn't need CORS the way GM_xmlhttpRequest/fetch would (cross-origin
// media elements can be played, just not sample-analyzed, without CORS
// headers), so no @connect grant is needed for this.

const SOUND_BASE_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/miscellaneous/sounds/";
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

const ARROW_STAGGER_MS = 180;     // gap between each arrow's spawn
const REMINDER_SOUND_DELAY_MS = 400; // pause after the last arrow lands, before the reaction sound
const TOTAL_DISPLAY_MS = 4200;    // how long the whole overlay stays up after the reaction sound - adjust once real clip lengths are known
const FADE_OUT_MS = 700;

let nextOverlayTurn = 11;

function playSound(filename, volume = 1) {
  try {
    const audio = new Audio(SOUND_BASE_URL + filename);
    audio.volume = volume;
    // Autoplay could theoretically be blocked in rare browser contexts
    // - this is a joke feature, not critical, so fail silently rather
    // than surfacing an error to the user.
    audio.play().catch(() => {});
  } catch (e) {}
}

function findEnemyDoomElement() {
  return document.querySelector('#enemyArtifacts img.artifact-img[name="Doom"]');
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
  width: 0;
  height: 0;
  opacity: 0;
  border-style: solid;
  border-width: 28px 46px 28px 0;
  border-color: transparent #ff1414 transparent transparent;
  filter: drop-shadow(0 0 6px rgba(0,0,0,0.65));
  transition: transform 0.4s cubic-bezier(.2,.8,.3,1.15), opacity 0.2s ease-out;
}
.wizascript-doom-arrow.wizascript-doom-arrow-in {
  opacity: 1;
}
.wizascript-doom-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: Impact, "Arial Black", sans-serif;
  font-size: 52px;
  font-weight: 900;
  color: #fff;
  -webkit-text-stroke: 3px #000;
  text-shadow: 3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 0 14px rgba(0,0,0,0.5);
  letter-spacing: 2px;
  text-align: center;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s ease-in;
}
.wizascript-doom-text.wizascript-doom-text-in {
  opacity: 1;
}
.wizascript-doom-text-top {
  top: 6%;
}
.wizascript-doom-text-bottom {
  bottom: 6%;
}
.wizascript-doom-fade-out {
  transition: opacity ${FADE_OUT_MS}ms ease-out;
  opacity: 0 !important;
}
`;
  document.head.appendChild(style);
}

// Four spawn points just outside the viewport's corners - arrows
// travel inward from each toward wherever Doom's icon actually is.
function getArrowSpawnPoints(w, h) {
  return [
    { x: -60, y: -60 },
    { x: w + 60, y: -60 },
    { x: -60, y: h + 60 },
    { x: w + 60, y: h + 60 }
  ];
}

function angleToward(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
}

function showDoomOverlay() {
  const doomEl = findEnemyDoomElement();
  if (!doomEl) return; // enemy doesn't currently have Doom equipped/visible - nothing to point at

  injectOverlayStyle();

  const rect = doomEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const overlay = document.createElement("div");
  overlay.className = "wizascript-doom-overlay";

  const circleSize = Math.max(rect.width, rect.height) * 2.2;
  const circle = document.createElement("div");
  circle.className = "wizascript-doom-circle";
  circle.style.width = circleSize + "px";
  circle.style.height = circleSize + "px";
  circle.style.left = (centerX - circleSize / 2) + "px";
  circle.style.top = (centerY - circleSize / 2) + "px";
  overlay.appendChild(circle);

  const topText = document.createElement("div");
  topText.className = "wizascript-doom-text wizascript-doom-text-top";
  topText.textContent = "HEY!";
  overlay.appendChild(topText);

  const bottomText = document.createElement("div");
  bottomText.className = "wizascript-doom-text wizascript-doom-text-bottom";
  bottomText.textContent = "DON'T FORGET ABOUT DOOM!";
  overlay.appendChild(bottomText);

  document.body.appendChild(overlay);

  const spawnPoints = getArrowSpawnPoints(window.innerWidth, window.innerHeight);
  const arrowTravelDistance = 90;

  spawnPoints.forEach((point, i) => {
    setTimeout(() => {
      const angle = angleToward(point.x, point.y, centerX, centerY);
      const arrow = document.createElement("div");
      arrow.className = "wizascript-doom-arrow";
      arrow.style.left = point.x + "px";
      arrow.style.top = point.y + "px";
      arrow.style.transform = `rotate(${angle}deg) translateX(0px)`;
      overlay.appendChild(arrow);

      playSound(VINE_BOOM_SOUND, 0.8);

      // Force layout to register the starting state before triggering
      // the transition, or the browser may skip straight to the end
      // state with no visible animation.
      requestAnimationFrame(() => {
        arrow.classList.add("wizascript-doom-arrow-in");
        arrow.style.transform = `rotate(${angle}deg) translateX(${arrowTravelDistance}px)`;
      });
    }, i * ARROW_STAGGER_MS);
  });

  setTimeout(() => {
    topText.classList.add("wizascript-doom-text-in");
    bottomText.classList.add("wizascript-doom-text-in");
  }, 150);

  const allArrowsLandedDelay = spawnPoints.length * ARROW_STAGGER_MS + REMINDER_SOUND_DELAY_MS;
  setTimeout(() => {
    const pick = REMINDER_SOUND_POOL[Math.floor(Math.random() * REMINDER_SOUND_POOL.length)];
    playSound(pick, 1);
  }, allArrowsLandedDelay);

  setTimeout(() => {
    overlay.classList.add("wizascript-doom-fade-out");
    setTimeout(() => overlay.remove(), FADE_OUT_MS);
  }, allArrowsLandedDelay + TOTAL_DISPLAY_MS);
}

export function resetDoomOverlayForMatchStart(turn) {
  if (turn <= 1) {
    nextOverlayTurn = 11;
  }
}

export function registerDoomOverlay(plugin, isEnabled) {
  plugin.events.on("GameEvent", event => {
    if (!isEnabled()) return;
    if (event.action !== "getTurnStart") return;

    const numTurn = event.numTurn;
    if (typeof numTurn === "number" && numTurn >= nextOverlayTurn) {
      nextOverlayTurn += 12;
      showDoomOverlay();
    }
  });
}
