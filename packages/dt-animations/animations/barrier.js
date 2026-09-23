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
//   custom   one of YOUR clips, picked at random (never the same one twice
//            in a row): assets/dt-animations/barrier-custom/*.webm, listed
//            in clips.json there. Make them with the Clip Squisher page.
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

import { loadAssetBlob, loadAssetText } from "../../core/assets.js";

const BARRIER_CARD_ID = 801;
const CLASSIC_GIF = "dt-animations/barrier-classic.gif";
const CUSTOM_DIR = "dt-animations/barrier-custom/";
const CUSTOM_LIST = CUSTOM_DIR + "clips.json";
const CUSTOM_MAX_MS = 3100;
const Z_INDEX = 1000000; // above Titan's eyes (999999), below the debug panel

const T = {
  crack: 330,
  widen: 2340,
  flash: 2380,
  split: 2420,
  black: 2710,
  end: 3110,
  fadeOut: 700,
  classicWaitMax: 2000, // how long "classic" may wait for the GIF before falling back to the remake
  customWaitMax: 2500   // same for a custom clip
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

// clips.json is hand-edited, so be forgiving: accept a bare array or
// { "clips": [...] }, and a trailing comma after the last entry (the Clip
// Squisher's copy-line ends with one).
function parseClipList(text) {
  const cleaned = String(text).replace(/,\s*([\]}])/g, "$1");
  const data = JSON.parse(cleaned);
  const list = Array.isArray(data) ? data : (data && data.clips) || [];
  return list
    .filter((c) => c && typeof c.file === "string" && c.enabled !== false)
    .map((c) => ({
      file: c.file.replace(/^[\/.]+/, "").replace(/\.\.+/g, "."),
      title: c.title || c.file,
      durationMs: Math.min(CUSTOM_MAX_MS, Math.max(300, Number(c.durationMs) || CUSTOM_MAX_MS))
    }))
    .filter((c) => c.file);
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
    if (root) {
      if (root.tagName === "VIDEO") {
        root.pause();
        root.removeAttribute("src");
        root.load();
      }
      root.remove();
    }
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
  function scheduleEnd(token, startedAt, endMs = T.end) {
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
    }, Math.max(0, endMs - elapsed));
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

  // ---- custom ------------------------------------------------------
  let clipListPromise = null;
  let lastFile = null;
  let nextPick = null; // { clip, blob: Promise<Blob> } - fetched ahead of time

  function loadClipList(refresh) {
    if (refresh || !clipListPromise) {
      clipListPromise = loadAssetText(CUSTOM_LIST, { fresh: !!refresh }).then(parseClipList);
      clipListPromise.catch(() => { clipListPromise = null; });
    }
    return clipListPromise;
  }

  function chooseClip(list) {
    const pool = list.length > 1 ? list.filter((c) => c.file !== lastFile) : list;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function prepareNext() {
    return loadClipList(false).then((list) => {
      if (nextPick) return nextPick;
      const clip = chooseClip(list);
      if (!clip) return null;
      nextPick = { clip, blob: loadAssetBlob(CUSTOM_DIR + clip.file) };
      nextPick.blob.catch(() => { nextPick = null; });
      return nextPick;
    });
  }

  function playCustom(token, forcedFile) {
    let settled = false;
    const fallback = (why) => {
      if (settled || token !== runToken) return;
      settled = true;
      ctx.warn(`custom clip unavailable (${why}) - using the remake instead.`);
      playRemake(token);
    };
    later(() => fallback("timed out"), T.customWaitMax);

    const picked = forcedFile
      ? loadClipList(false).then((list) => {
          const clip = list.find((c) => c.file === forcedFile) || { file: forcedFile, title: forcedFile, durationMs: CUSTOM_MAX_MS };
          return { clip, blob: loadAssetBlob(CUSTOM_DIR + clip.file) };
        })
      : prepareNext();

    picked
      .then((pick) => {
        if (!pick) throw new Error("clips.json lists no clips");
        if (!forcedFile) nextPick = null; // used up - the next play picks again
        return pick.blob.then((blob) => ({ clip: pick.clip, blob }));
      })
      .then(({ clip, blob }) => {
        if (settled || token !== runToken) return;
        objectUrl = URL.createObjectURL(blob);
        const video = document.createElement("video");
        baseStyle(video);
        video.style.objectFit = "cover";
        video.style.background = "#000";
        video.playsInline = true;
        video.preload = "auto";
        video.volume = Math.max(0, Math.min(1, Number(ctx.setting("volume") ?? 0.6)));
        video.src = objectUrl;
        const onReady = () => {
          if (settled || token !== runToken) return;
          settled = true;
          timers.forEach(clearTimeout); // drop the fallback timer
          timers = [];
          root = video;
          document.body.appendChild(video);
          video.play().catch(() => {
            // Sound needs a prior click on the page; mid-match there always
            // is one, but play muted rather than not at all.
            ctx.warn("sound was blocked - playing the clip muted.");
            video.muted = true;
            return video.play();
          }).catch(() => {});
          ctx.log(`custom clip: ${clip.title} (${clip.file})`);
          lastFile = clip.file;
          scheduleEnd(token, performance.now(), clip.durationMs);
          prepareNext().catch(() => {}); // warm up the next one
        };
        video.addEventListener("canplay", onReady, { once: true });
        video.addEventListener("error", () => fallback("the clip couldn't be decoded"), { once: true });
        video.load();
      })
      .catch((err) => fallback(err && err.message ? err.message : String(err)));
  }

  // `variant` (debug panel only): "remake" | "classic" | "custom" |
  // "custom:<file>" - overrides the Style setting for this one play.
  function play({ variant } = {}) {
    if (active) return false;
    if (!document.body) return false;
    active = true;
    const token = ++runToken;
    cleanupDom();
    const [style, file] = variant ? [variant.split(":")[0], variant.split(":").slice(1).join(":")] : [ctx.setting("style"), ""];
    if (style === "classic") playClassic(token);
    else if (style === "custom") playCustom(token, file || null);
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
    // Match start: fetch whatever the chosen style needs ahead of time.
    preload() {
      const style = ctx.setting("style");
      if (style === "classic") loadAssetBlob(CLASSIC_GIF).catch(() => {});
      else if (style === "custom") prepareNext().catch((err) => ctx.warn("couldn't load clips.json:", err.message));
    },
    // Debug panel picker: every style, plus each custom clip on its own.
    async debugVariants({ refresh = false } = {}) {
      if (refresh) nextPick = null;
      const base = [
        { label: "Remake", value: "remake" },
        { label: "Classic (GIF)", value: "classic" },
        { label: "Custom: random clip", value: "custom" }
      ];
      let clips = [];
      try {
        clips = await loadClipList(refresh);
      } catch (err) {
        ctx.warn("couldn't load clips.json:", err.message);
      }
      return base.concat(clips.map((c) => ({ label: `Custom: ${c.title}`, value: `custom:${c.file}` })));
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
  description: "The barrier cracks and breaks open when The Barrier is played - or one of your own clips plays instead.",
  kind: "oneShot",
  settings: {
    style: {
      name: "Style",
      type: "select",
      data: [["Remake (animated)", "remake"], ["Classic (original GIF)", "classic"], ["Custom (random clip)", "custom"]],
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
    volume: {
      name: "Custom clip volume",
      type: "slider",
      default: 0.6,
      min: 0,
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
