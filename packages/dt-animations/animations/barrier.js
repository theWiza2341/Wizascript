// packages/dt-animations/animations/barrier.js
//
// The Barrier (card 801) - a one-shot "barrier breaking" flash when the
// card is played. Two styles (setting "style"):
//
//   classic  the original GIF, full screen (assets/dt-animations/barrier-classic.gif,
//            fetched at runtime from the repo - see core/assets.js)
//   remake   the same animation rebuilt as live SVG: identical shapes and
//            timing (measured from the GIF), but rendered per frame, so the
//            split is smooth instead of stepping at the GIF's 25 fps
//   (custom  - planned, its own iteration)
//
// Timeline (both styles; measured from the GIF, 1200x675 design space):
//      0 ms  off-white screen
//    330 ms  thin jagged crack appears down the middle
//   2340 ms  crack widens to a black band (+-72 px)
//   2380 ms  pale-yellow flash (+-144 px)
//   2420 ms  the band splits open, both edges racing outward (~70 px / 40 ms)
//   2710 ms  fully black - held until 3110 ms
//   then     fades out, revealing the game again
//
// ONE-SHOT: declares kind "oneShot", so if a persistent DT (Titan) is on
// screen the host suspends it and resumes it once this finishes.
//
// TRIGGER: getMonsterPlayed / getSpellPlayed where the played card's
// fixedId is 801. The card being played is public - both players see it.

import { loadAssetBlob } from "../../core/assets.js";

const BARRIER_CARD_ID = 801;
const CLASSIC_GIF = "dt-animations/barrier-classic.gif";
const Z_INDEX = 1000000; // above Titan's eyes (999999), below the debug panel

const T = {
  crack: 330,
  widen: 2340,
  flash: 2380,
  split: 2420,
  black: 2710,
  end: 3110,
  fadeOut: 700,
  classicWaitMax: 2000 // how long "classic" may wait for the GIF before falling back to the remake
};

const VIEW_W = 1200;
const VIEW_H = 675;
const COLORS = {
  paper: "#fcfcff",
  crack: "#000",
  flash: "#fcfce3"
};

// Crack centerline, traced from the GIF (RDP-simplified), extended a
// little past the top/bottom edges so the split never shows a gap.
const CRACK = [
  [548, -20], [548, 0], [531, 13], [519, 33], [553, 75], [565, 98], [554, 116], [543, 124],
  [541, 134], [525, 151], [523, 160], [507, 176], [507, 183], [590, 241], [608, 259],
  [607, 264], [556, 303], [707, 330], [658, 399], [647, 408], [645, 417], [613, 446],
  [606, 461], [580, 492], [602, 508], [714, 557], [696, 571], [681, 591], [673, 594],
  [671, 601], [639, 633], [626, 641], [623, 651], [593, 674], [575, 695]
];

const crackLine = () => CRACK.map(([x, y]) => `${x},${y}`).join(" ");

// The black band between the crack shifted left by d and shifted right
// by d - exactly how the GIF's split behaves.
function bandPoints(d) {
  const left = CRACK.map(([x, y]) => `${(x - d).toFixed(1)},${y}`);
  const right = CRACK.slice().reverse().map(([x, y]) => `${(x + d).toFixed(1)},${y}`);
  return left.concat(right).join(" ");
}

// Half-width of the band at time t (ms) during the split phase.
function splitHalfWidth(t) {
  return 213 + (t - T.split) * (70.5 / 40);
}

function isGeneratedCard(card) {
  if (!card) return false;
  if (card.generated === true) return true;
  const info = card.creatorInfo;
  if (!info) return false;
  if (typeof info === "string") return info.length > 0;
  return typeof info === "object" && Object.keys(info).length > 0;
}

// =================================================================
// EFFECT
// =================================================================
function createEffect(ctx) {
  const svgNS = "http://www.w3.org/2000/svg";
  let root = null;        // current overlay element (svg or img wrapper)
  let rafId = null;
  let timers = [];
  let objectUrl = null;
  let active = false;
  let runToken = 0;        // invalidates async work from a previous run

  const reducedMotion = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function cleanupDom() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    timers.forEach(clearTimeout);
    timers = [];
    if (root) root.remove();
    root = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  function baseStyle(el) {
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: String(Z_INDEX),
      opacity: String(ctx.setting("opacity") ?? 1),
      transition: `opacity ${T.fadeOut}ms ease`
    });
  }

  // Fade out after the black hold, then report back to the host.
  function scheduleEnd(token, startedAt) {
    const elapsed = performance.now() - startedAt;
    later(() => {
      if (token !== runToken || !root) return;
      root.style.opacity = "0";
      later(() => {
        if (token !== runToken) return;
        cleanupDom();
        active = false;
        ctx.finished();
      }, T.fadeOut);
    }, Math.max(0, T.end - elapsed));
  }

  // ---- remake ------------------------------------------------------
  function playRemake(token) {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    baseStyle(svg);
    svg.style.overflow = "hidden";

    const el = (tag, attrs) => {
      const n = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      return n;
    };

    // Oversized so "slice" scaling never exposes an edge on odd aspect ratios.
    svg.appendChild(el("rect", { x: -2000, y: -1000, width: VIEW_W + 4000, height: VIEW_H + 2000, fill: COLORS.paper }));

    const line = el("polyline", {
      points: crackLine(),
      fill: "none",
      stroke: COLORS.crack,
      "stroke-width": 3,
      "stroke-linejoin": "miter",
      visibility: "hidden"
    });
    const band = el("polygon", { points: bandPoints(0), fill: COLORS.crack, visibility: "hidden" });
    const cover = el("rect", { x: -2000, y: -1000, width: VIEW_W + 4000, height: VIEW_H + 2000, fill: COLORS.crack, visibility: "hidden" });
    svg.append(line, band, cover);

    root = svg;
    document.body.appendChild(svg);

    const reduce = reducedMotion();
    const startedAt = performance.now();
    let phase = "";

    function frame(now) {
      if (token !== runToken) return;
      const t = now - startedAt;
      let next;
      if (t < T.crack) next = "paper";
      else if (t < T.widen) next = "crack";
      else if (t < T.flash) next = "widen";
      else if (t < T.split) next = reduce ? "widen" : "flash";
      else if (t < T.black) next = "split";
      else next = "black";

      if (next !== phase) {
        phase = next;
        line.setAttribute("visibility", phase === "crack" ? "visible" : "hidden");
        band.setAttribute("visibility", ["widen", "flash", "split"].includes(phase) ? "visible" : "hidden");
        cover.setAttribute("visibility", phase === "black" ? "visible" : "hidden");
        if (phase === "widen") {
          band.setAttribute("points", bandPoints(72));
          band.setAttribute("fill", COLORS.crack);
        } else if (phase === "flash") {
          band.setAttribute("points", bandPoints(144));
          band.setAttribute("fill", COLORS.flash);
        } else if (phase === "split") {
          band.setAttribute("fill", COLORS.crack);
        }
      }
      if (phase === "split") band.setAttribute("points", bandPoints(splitHalfWidth(t)));
      if (phase !== "black") rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    scheduleEnd(token, startedAt);
  }

  // ---- classic -------------------------------------------------------
  function playClassic(token) {
    let settled = false;
    const fallback = (why) => {
      if (settled || token !== runToken) return;
      settled = true;
      ctx.warn(`classic GIF unavailable (${why}) - using the remake instead.`);
      playRemake(token);
    };
    later(() => fallback("timed out"), T.classicWaitMax);

    loadAssetBlob(CLASSIC_GIF)
      .then((blob) => {
        if (settled || token !== runToken) return;
        // A fresh object URL per play guarantees the GIF starts at frame 1.
        objectUrl = URL.createObjectURL(blob);
        const img = document.createElement("img");
        img.alt = "";
        baseStyle(img);
        img.style.objectFit = "cover";
        img.style.background = COLORS.paper;
        img.src = objectUrl;
        const show = () => {
          if (settled || token !== runToken) return;
          settled = true;
          timers.forEach(clearTimeout); // drop the fallback timer
          timers = [];
          root = img;
          document.body.appendChild(img);
          scheduleEnd(token, performance.now());
        };
        (img.decode ? img.decode() : Promise.resolve()).then(show, () => fallback("decode failed"));
      })
      .catch((err) => fallback(err.message));
  }

  function play() {
    if (active) return false;
    if (!document.body) return false;
    active = true;
    const token = ++runToken;
    cleanupDom();
    if (ctx.setting("style") === "classic") playClassic(token);
    else playRemake(token);
    return true;
  }

  function forceStop() {
    runToken++;
    cleanupDom();
    active = false;
  }

  return {
    play,
    // One-shot: a "graceful end" just means finishing early with the fade.
    reset() {
      if (!active) return;
      if (!root) {
        // Still waiting on the GIF - nothing on screen to fade.
        forceStop();
        ctx.finished();
        return;
      }
      const token = runToken;
      timers.forEach(clearTimeout);
      timers = [];
      root.style.opacity = "0";
      later(() => {
        if (token !== runToken) return;
        cleanupDom();
        active = false;
        ctx.finished();
      }, T.fadeOut);
    },
    forceStop,
    isActive: () => active,
    destroy: forceStop,
    // Lets the detector warm the GIF cache at match start.
    preload() {
      if (ctx.setting("style") === "classic") loadAssetBlob(CLASSIC_GIF).catch(() => {});
    }
  };
}

// =================================================================
// DETECTOR
// =================================================================
function createDetector(api) {
  // getSpellPlayed can arrive twice for one play (UnderScript's own
  // battle log dedupes it the same way) - remember recent instance ids.
  const recent = new Map(); // card instance id -> timestamp

  function seenRecently(instanceId) {
    const now = Date.now();
    recent.forEach((ts, id) => { if (now - ts > 10000) recent.delete(id); });
    if (recent.has(instanceId)) return true;
    recent.set(instanceId, now);
    return false;
  }

  function onPlayed(event) {
    let card;
    try {
      card = typeof event.card === "string" ? JSON.parse(event.card) : event.card;
    } catch (err) {
      api.warn("played card failed to parse:", err);
      return;
    }
    if (!card || card.fixedId !== BARRIER_CARD_ID) return;

    const playerId = Number(event.idPlayer);
    // Logged in full while debug is on, so the generated-card check
    // below can be confirmed against real payloads.
    api.log(`The Barrier played by ${playerId} (${event.action}):`, card);

    if (card.id !== undefined && seenRecently(card.id)) return;
    if (!api.isRelevantPlayer(playerId)) return;
    if (api.setting("skipGenerated") && isGeneratedCard(card)) {
      api.log("skipped - looks like a generated copy.");
      return;
    }
    api.start(playerId);
  }

  return {
    onGameEvent(event) {
      if (event.action === "getMonsterPlayed" || event.action === "getSpellPlayed") onPlayed(event);
    },
    reset() {
      recent.clear();
    }
  };
}

// =================================================================
// MODULE
// =================================================================
export default {
  id: "barrier",
  name: "The Barrier",
  description: "The barrier cracks and breaks open when The Barrier is played.",
  kind: "oneShot",
  settings: {
    style: {
      name: "Style",
      type: "select",
      data: [["Remake (animated)", "remake"], ["Classic (original GIF)", "classic"]],
      default: "remake"
    },
    opacity: {
      name: "Effect opacity",
      note: "Lower it to keep the board visible through the flash.",
      type: "slider",
      default: 1,
      min: 0.3,
      max: 1,
      step: 0.05
    },
    skipGenerated: {
      name: "Only for copies played from your deck (skip generated)",
      type: "boolean",
      default: true
    }
  },
  createEffect,
  createDetector
};
