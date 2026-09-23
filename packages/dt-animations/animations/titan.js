// packages/dt-animations/animations/titan.js
//
// Titan - "Constricting Darkness" eye-swarm effect (Deltarune-style).
// Ported from the standalone Titan Eye Border Effect userscript (v0.5 +
// its v1.1 GameEvent wiring) onto the DT Animations host.
//
// TRIGGER: driven off the Constricting Darkness artifact (id 67), not
// the Titan card itself - summoning more Titanspawns never creates a
// second Constricting Darkness, so there's nothing to re-fire on.
//   - artifact first appears (not disabled) -> start
//   - its counter (`custom`) drops           -> react("hurt") (red glow + pupil shake)
//   - it becomes disabled / disappears       -> end (eyes shatter, darkness lifts)
// Both getPlayersStats (periodic snapshot) AND getArtifactDoingEffect
// (fires immediately) are read into ONE shared per-player state: a rise
// seen via getArtifactDoingEffect sets the baseline so a drop that only
// shows up in the next snapshot is still caught.
//
// Everything read here is public: the artifact, its counter and its
// disabled state are all visible on the artifact icon to both players.
//
// KNOWN GAP: generated vs. played Titan can't be told apart from the
// artifact (that info only lived on the Titan card's creatorInfo/rarity).
// Revisit if "non-generated only" becomes a requirement.

const CONSTRICTING_DARKNESS_ID = 67;

// ---------------------------------------------------------------
// Fixed tuning (the user-facing knobs are in `settings` below)
// ---------------------------------------------------------------
const TIMING = {
  darkenMs: 3200,
  eyeAppearStaggerMs: 220,
  eyeDissipateMs: 900,
  eyeDissipateStaggerMs: 140,
  glowMs: 1000
};

const SHATTER = {
  cols: 8, rows: 4,          // 32 shards per eye
  minDistance: 16, maxDistance: 34,
  maxRotation: 35,           // deg, +/-
  maxDelay: 130              // ms, random per-shard stagger
};

const SHAPE = {
  eyeWidth: 84,
  eyeHeight: 34,
  cornerLineLength: 10,
  spikeLength: 16,
  spikeBaseWidth: 7,
  pupilRadius: 9,
  pupilMargin: 1,
  pupilOvershoot: 1,
  pupilShakeMagnitude: 2.5
};

const LAYOUT = {
  boardSelector: "#board",
  // Used only to steer eyes away from these panels.
  avoidSelectors: ["#board", ".hand", "#discussion", ".discussion-panel", ".chat-panel"],
  avoidPadding: 24,
  eyeSpacingPadding: 22,
  eyeVerticalSpread: 1.0,
  layerZIndex: 999999,
  haloSizePercent: 170,
  haloBlurPx: 8,
  haloOpacity: 0.6
};

const EYE_TOTAL_HEIGHT = SHAPE.eyeHeight + SHAPE.spikeLength * 2;
const EYE_TOTAL_WIDTH = SHAPE.eyeWidth + SHAPE.cornerLineLength * 2;

// Per-row offsets/scale within a side (up to 8 per side). scale never
// exceeds 1.0 - eyes only ever shrink a little, never outgrow the art.
const EYE_JITTER = [
  { dx: 0, dy: 0, scale: 1.0 },
  { dx: -5, dy: 3, scale: 0.85 },
  { dx: 6, dy: -3, scale: 0.92 },
  { dx: -4, dy: 2, scale: 0.78 },
  { dx: 5, dy: -2, scale: 0.95 },
  { dx: -3, dy: 4, scale: 0.88 },
  { dx: 4, dy: -4, scale: 0.8 },
  { dx: -6, dy: 1, scale: 0.97 }
];

const STYLE_ID = "wiza-dt-titan-style";
const CSS = `
  #wiza-titan-dark-overlay {
    position: fixed;
    inset: 0;
    background: #000;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
    transition: opacity ${TIMING.darkenMs}ms ease;
  }
  #wiza-titan-dark-overlay.is-dark {
    opacity: var(--wiza-titan-darkness, 1);
  }
  #wiza-titan-eye-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: ${LAYOUT.layerZIndex};
  }
  .wiza-titan-eye {
    position: absolute;
    width: ${EYE_TOTAL_WIDTH}px;
    height: ${EYE_TOTAL_HEIGHT}px;
    opacity: 0;
    transform: scale(calc(var(--eye-scale, 1) * 0.3));
    transform-origin: center;
    transition: opacity 600ms ease, transform 600ms cubic-bezier(.2,1.4,.4,1);
  }
  .wiza-titan-eye.is-visible {
    opacity: var(--wiza-titan-eye-opacity, 0.65);
    transform: scale(var(--eye-scale, 1));
  }
  .wiza-titan-shatter {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .wiza-titan-shard {
    position: absolute;
    overflow: hidden;
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
    transition-property: transform, opacity;
    transition-duration: ${TIMING.eyeDissipateMs}ms;
    transition-timing-function: cubic-bezier(.3, 0, .7, 1);
  }
  .wiza-titan-shatter.is-shattering .wiza-titan-shard {
    transform: translate(var(--shard-dx), var(--shard-dy)) rotate(var(--shard-rot)) scale(0.3);
    opacity: 0;
  }
  .wiza-titan-shard-inner {
    position: absolute;
  }
  .wiza-titan-halo {
    position: absolute;
    left: 50%;
    top: 50%;
    width: ${LAYOUT.haloSizePercent}%;
    height: ${LAYOUT.haloSizePercent}%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(0, 0, 0, ${LAYOUT.haloOpacity}) 0%,
      rgba(0, 0, 0, ${LAYOUT.haloOpacity * 0.5}) 45%,
      rgba(0, 0, 0, 0) 75%
    );
    filter: blur(${LAYOUT.haloBlurPx}px);
    pointer-events: none;
    transition: opacity ${TIMING.eyeDissipateMs}ms ease;
  }
  .wiza-titan-eye-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .wiza-titan-eye-void { fill: rgba(0, 0, 0, 0.55); }
  .wiza-titan-eye-outline {
    fill: none;
    stroke: #e9e9e9;
    stroke-width: 2.5;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.35));
  }
  .wiza-titan-eye-corner {
    stroke: #e9e9e9;
    stroke-width: 2.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.35));
  }
  .wiza-titan-eye-spike {
    fill: #e9e9e9;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.35));
  }
  .wiza-titan-pupil {
    fill: #e9e9e9;
    filter: drop-shadow(0 0 3px rgba(255,255,255,0.3));
    transition: fill 450ms ease, filter 450ms ease, transform 100ms ease-out;
  }
  /* While glowing the pupil is shaking via per-frame transforms - drop
     the transform transition so it doesn't smear the rattle into mush. */
  .wiza-titan-eye.is-glowing .wiza-titan-pupil {
    fill: #ff2222;
    filter: drop-shadow(0 0 6px red) drop-shadow(0 0 12px rgba(255,0,0,0.6));
    transition: fill 450ms ease, filter 450ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .wiza-titan-eye { transition: opacity 600ms ease; }
    .wiza-titan-shard { transition-duration: 1ms; }
  }
`;

// =================================================================
// EFFECT
// =================================================================
function createEffect(ctx) {
  const svgNS = "http://www.w3.org/2000/svg";
  let overlay = null;
  let eyeLayer = null;
  let boardEl = null;
  let resizeObserver = null;
  let eyes = [];
  let eyePupils = [];
  let isEffectActive = false;

  let darknessTimeoutId = null;
  let darknessReverseTimeoutId = null;
  let glowTimeoutId = null;
  const staggerTimeoutIds = [];
  const dissipateTimeoutIds = [];

  let clipIdCounter = 0;
  const nextClipId = () => `wiza-titan-lens-clip-${clipIdCounter++}`;

  const reducedMotion = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- mounting (lazy - first play(), once #board exists) ----------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function mount() {
    const board = document.querySelector(LAYOUT.boardSelector);
    if (!board) return false;
    ensureStyle();

    if (!overlay || !overlay.isConnected) {
      overlay = document.createElement("div");
      overlay.id = "wiza-titan-dark-overlay";
      // First child of body + z-index:-1: paints above body's own
      // background (which is where UC puts the game backdrop) but below
      // every normally-stacked child, so gameplay stays visible.
      document.body.insertBefore(overlay, document.body.firstChild);
    }
    if (!eyeLayer || !eyeLayer.isConnected) {
      eyeLayer = document.createElement("div");
      eyeLayer.id = "wiza-titan-eye-layer";
      document.body.appendChild(eyeLayer);
    }
    if (board !== boardEl) {
      if (boardEl) unbindBoard();
      boardEl = board;
      bindBoard();
    }
    return true;
  }

  function bindBoard() {
    resizeObserver = new ResizeObserver(() => repositionEyes());
    resizeObserver.observe(boardEl);
    window.addEventListener("resize", repositionEyes);
    boardEl.addEventListener("mouseenter", onBoardMouseEnter);
    boardEl.addEventListener("mouseleave", onBoardMouseLeave);
    window.addEventListener("mousemove", onMouseMove);
  }

  function unbindBoard() {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    window.removeEventListener("resize", repositionEyes);
    window.removeEventListener("mousemove", onMouseMove);
    if (boardEl) {
      boardEl.removeEventListener("mouseenter", onBoardMouseEnter);
      boardEl.removeEventListener("mouseleave", onBoardMouseLeave);
    }
    boardEl = null;
  }

  function applySettingVars() {
    overlay.style.setProperty("--wiza-titan-darkness", String(ctx.setting("darkness")));
    eyeLayer.style.setProperty("--wiza-titan-eye-opacity", String(ctx.setting("eyeOpacity")));
  }

  // ---- layout -------------------------------------------------------
  function rectFor(selector) {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null; // hidden = not there
  }

  function rectsOverlap(a, b, padding = 0) {
    return !(
      a.right + padding < b.left ||
      a.left - padding > b.right ||
      a.bottom + padding < b.top ||
      a.top - padding > b.bottom
    );
  }

  function eyeCount() {
    const n = Number(ctx.setting("eyeCount")) || 12;
    return Math.max(2, Math.min(n, EYE_JITTER.length * 2));
  }

  function computeEyePositions() {
    const boardRect = boardEl.getBoundingClientRect();
    const avoidRects = LAYOUT.avoidSelectors.map(rectFor).filter(Boolean);
    const perSide = Math.max(1, Math.floor(eyeCount() / 2));
    const positions = [];

    [-1, 1].forEach((side) => {
      for (let i = 0; i < perSide; i++) {
        const tFull = (i + 0.5) / perSide;
        const t = 0.5 + (tFull - 0.5) * LAYOUT.eyeVerticalSpread;
        const jitter = EYE_JITTER[i % EYE_JITTER.length];

        const baseY = boardRect.top + boardRect.height * t + jitter.dy;
        const basePadding = LAYOUT.eyeSpacingPadding + jitter.dx;

        let x = side === -1
          ? boardRect.left - basePadding - EYE_TOTAL_WIDTH
          : boardRect.right + basePadding;
        let y = baseY - EYE_TOTAL_HEIGHT / 2;

        for (let attempts = 0; attempts < 8; attempts++) {
          const candidate = { left: x, right: x + EYE_TOTAL_WIDTH, top: y, bottom: y + EYE_TOTAL_HEIGHT };
          if (!avoidRects.some((r) => rectsOverlap(candidate, r, LAYOUT.avoidPadding))) break;
          if (attempts < 4) x += side * 24;
          else y += 40;
        }
        positions.push({ x, y, scale: jitter.scale });
      }
    });
    return positions;
  }

  function repositionEyes() {
    if (!boardEl || !eyes.length) return;
    computeEyePositions().forEach((pos, i) => {
      if (!eyes[i]) return;
      eyes[i].style.left = `${pos.x}px`;
      eyes[i].style.top = `${pos.y}px`;
    });
  }

  // ---- eye artwork ---------------------------------------------------
  function buildEyeSvg() {
    const w = EYE_TOTAL_WIDTH;
    const h = EYE_TOTAL_HEIGHT;
    const lensLeftX = SHAPE.cornerLineLength;
    const lensRightX = lensLeftX + SHAPE.eyeWidth;
    const cx = lensLeftX + SHAPE.eyeWidth / 2;
    const lensTop = SHAPE.spikeLength;
    const lensBottom = SHAPE.spikeLength + SHAPE.eyeHeight;
    const cy = SHAPE.spikeLength + SHAPE.eyeHeight / 2;
    // A quadratic bezier only reaches halfway to its control point, so
    // push the control points out to make the curve actually peak at
    // lensTop/lensBottom where the spikes sit (no gap).
    const controlTopY = 2 * lensTop - cy;
    const controlBottomY = 2 * lensBottom - cy;
    const lensD = `M ${lensLeftX} ${cy} Q ${cx} ${controlTopY} ${lensRightX} ${cy} Q ${cx} ${controlBottomY} ${lensLeftX} ${cy} Z`;
    const clipId = nextClipId();

    const el = (tag, attrs) => {
      const node = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
      return node;
    };

    const svg = el("svg", { class: "wiza-titan-eye-svg", viewBox: `0 0 ${w} ${h}` });

    const defs = el("defs", {});
    const clipPath = el("clipPath", { id: clipId });
    clipPath.appendChild(el("path", { d: lensD }));
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    // Bottom layer: socket + pupil, clipped to the lens so the pupil
    // can "peek" past the rim instead of being hard-clamped inside.
    const clipped = el("g", { "clip-path": `url(#${clipId})` });
    clipped.appendChild(el("path", { class: "wiza-titan-eye-void", d: lensD }));
    clipped.appendChild(el("circle", { class: "wiza-titan-pupil", cx, cy, r: SHAPE.pupilRadius }));
    svg.appendChild(clipped);

    // Top layer: crisp outline, corner caps, spikes.
    svg.appendChild(el("path", { class: "wiza-titan-eye-outline", d: lensD }));
    svg.appendChild(el("line", { class: "wiza-titan-eye-corner", x1: 0, y1: cy, x2: lensLeftX, y2: cy }));
    svg.appendChild(el("line", { class: "wiza-titan-eye-corner", x1: lensRightX, y1: cy, x2: w, y2: cy }));
    const halfBase = SHAPE.spikeBaseWidth / 2;
    svg.appendChild(el("polygon", {
      class: "wiza-titan-eye-spike",
      points: `${cx - halfBase},${lensTop} ${cx + halfBase},${lensTop} ${cx},0`
    }));
    svg.appendChild(el("polygon", {
      class: "wiza-titan-eye-spike",
      points: `${cx - halfBase},${lensBottom} ${cx + halfBase},${lensBottom} ${cx},${h}`
    }));
    return svg;
  }

  function renderEyes() {
    eyeLayer.innerHTML = "";
    eyes = [];
    eyePupils = [];
    pupilBaseOffsets = [];
    pupilJitterOffsets = [];
    const withHalo = !!ctx.setting("halo");
    computeEyePositions().forEach((pos) => {
      const eye = document.createElement("div");
      eye.className = "wiza-titan-eye";
      eye.style.left = `${pos.x}px`;
      eye.style.top = `${pos.y}px`;
      eye.style.setProperty("--eye-scale", pos.scale ?? 1);
      if (withHalo) {
        const halo = document.createElement("div");
        halo.className = "wiza-titan-halo";
        eye.appendChild(halo); // first, so it sits behind the SVG
      }
      const svg = buildEyeSvg();
      eye.appendChild(svg);
      eyeLayer.appendChild(eye);
      eyes.push(eye);
      eyePupils.push(svg.querySelector(".wiza-titan-pupil"));
    });
  }

  // Splits an eye into a grid of clipped shard windows, each showing
  // one slice of a clone of the artwork, then flings them outward.
  function shatterEye(eyeDiv) {
    if (eyeDiv.querySelector(".wiza-titan-shatter")) return;
    const svg = eyeDiv.querySelector(".wiza-titan-eye-svg");
    if (!svg) return;

    const halo = eyeDiv.querySelector(".wiza-titan-halo");
    if (halo) halo.style.opacity = "0";

    if (reducedMotion()) {
      eyeDiv.classList.remove("is-visible"); // plain fade instead of flying shards
      return;
    }

    const { cols, rows } = SHATTER;
    const w = EYE_TOTAL_WIDTH;
    const h = EYE_TOTAL_HEIGHT;
    const shardW = w / cols;
    const shardH = h / rows;
    const layer = document.createElement("div");
    layer.className = "wiza-titan-shatter";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shard = document.createElement("div");
        shard.className = "wiza-titan-shard";
        Object.assign(shard.style, {
          left: `${c * shardW}px`,
          top: `${r * shardH}px`,
          width: `${shardW}px`,
          height: `${shardH}px`
        });

        const inner = svg.cloneNode(true);
        // Give each clone its own clipPath id - otherwise every shard
        // (32 per eye) shares one id and relies on the browser resolving
        // url(#id) to the first match in the document.
        const newId = nextClipId();
        const clip = inner.querySelector("clipPath");
        const clipped = inner.querySelector("[clip-path]");
        if (clip) clip.setAttribute("id", newId);
        if (clipped) clipped.setAttribute("clip-path", `url(#${newId})`);
        inner.classList.add("wiza-titan-shard-inner");
        Object.assign(inner.style, {
          left: `${-c * shardW}px`,
          top: `${-r * shardH}px`,
          width: `${w}px`,
          height: `${h}px`
        });
        shard.appendChild(inner);

        const baseAngle = Math.atan2((r + 0.5) * shardH - h / 2, (c + 0.5) * shardW - w / 2);
        const angle = baseAngle + (Math.random() - 0.5) * 0.8;
        const dist = SHATTER.minDistance + Math.random() * (SHATTER.maxDistance - SHATTER.minDistance);
        shard.style.setProperty("--shard-dx", `${(Math.cos(angle) * dist).toFixed(1)}px`);
        shard.style.setProperty("--shard-dy", `${(Math.sin(angle) * dist).toFixed(1)}px`);
        shard.style.setProperty("--shard-rot", `${((Math.random() * 2 - 1) * SHATTER.maxRotation).toFixed(1)}deg`);
        shard.style.transitionDelay = `${(Math.random() * SHATTER.maxDelay).toFixed(0)}ms`;
        layer.appendChild(shard);
      }
    }

    eyeDiv.appendChild(layer);
    svg.style.visibility = "hidden";
    void layer.offsetHeight; // reflow so the transition runs
    layer.classList.add("is-shattering");
  }

  // ---- pupil tracking + shake -----------------------------------------
  let hoveringBoard = false;
  let trackRafPending = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  // Final pupil transform = tracked base offset + shake jitter, kept
  // separate so a shake rides on top of wherever tracking points.
  let pupilBaseOffsets = [];
  let pupilJitterOffsets = [];

  function renderPupilTransform(i) {
    const pupil = eyePupils[i];
    if (!pupil) return;
    const base = pupilBaseOffsets[i] || { x: 0, y: 0 };
    const jitter = pupilJitterOffsets[i] || { x: 0, y: 0 };
    pupil.setAttribute("transform", `translate(${(base.x + jitter.x).toFixed(2)}, ${(base.y + jitter.y).toFixed(2)})`);
  }

  function updatePupilPositions() {
    trackRafPending = false;
    const a = SHAPE.eyeWidth / 2 - SHAPE.pupilRadius - SHAPE.pupilMargin + SHAPE.pupilOvershoot;
    const b = SHAPE.eyeHeight / 2 - SHAPE.pupilRadius - SHAPE.pupilMargin + SHAPE.pupilOvershoot;

    eyes.forEach((eye, i) => {
      if (!eyePupils[i]) return;
      const rect = eye.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // screen space -> the eye's own viewBox space (survives CSS scale)
      let dx = (lastMouseX - (rect.left + rect.width / 2)) * (EYE_TOTAL_WIDTH / rect.width);
      let dy = (lastMouseY - (rect.top + rect.height / 2)) * (EYE_TOTAL_HEIGHT / rect.height);
      const norm = (dx * dx) / (a * a) + (dy * dy) / (b * b);
      if (norm > 1) {
        const s = 1 / Math.sqrt(norm);
        dx *= s;
        dy *= s;
      }
      pupilBaseOffsets[i] = { x: dx, y: dy };
      renderPupilTransform(i);
    });
  }

  function recenterPupils() {
    eyePupils.forEach((_, i) => {
      pupilBaseOffsets[i] = { x: 0, y: 0 };
      renderPupilTransform(i);
    });
  }

  function onBoardMouseEnter() { hoveringBoard = true; }
  function onBoardMouseLeave() {
    hoveringBoard = false;
    recenterPupils();
  }
  function onMouseMove(e) {
    if (!hoveringBoard || !isEffectActive || !ctx.setting("trackCursor")) return;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!trackRafPending) {
      trackRafPending = true;
      requestAnimationFrame(updatePupilPositions);
    }
  }

  let shakeActive = false;
  let shakeRafId = null;

  function startPupilShake() {
    if (shakeActive || reducedMotion()) return;
    shakeActive = true;
    const seeds = eyePupils.map((_, i) => i * 1.9); // per-eye phase so they don't jitter in unison
    function tick(now) {
      if (!shakeActive) return;
      eyePupils.forEach((pupil, i) => {
        if (!pupil) return;
        pupilJitterOffsets[i] = {
          x: Math.sin(now * 0.05 + seeds[i]) * SHAPE.pupilShakeMagnitude,
          y: Math.cos(now * 0.07 + seeds[i] * 1.3) * SHAPE.pupilShakeMagnitude
        };
        renderPupilTransform(i);
      });
      shakeRafId = requestAnimationFrame(tick);
    }
    shakeRafId = requestAnimationFrame(tick);
  }

  function stopPupilShake() {
    shakeActive = false;
    if (shakeRafId) cancelAnimationFrame(shakeRafId);
    shakeRafId = null;
    eyePupils.forEach((_, i) => {
      pupilJitterOffsets[i] = { x: 0, y: 0 };
      renderPupilTransform(i);
    });
  }

  // ---- sequence ---------------------------------------------------------
  function clearTimers() {
    [darknessTimeoutId, darknessReverseTimeoutId, glowTimeoutId].forEach((id) => id && clearTimeout(id));
    darknessTimeoutId = darknessReverseTimeoutId = glowTimeoutId = null;
    staggerTimeoutIds.splice(0).forEach(clearTimeout);
    dissipateTimeoutIds.splice(0).forEach(clearTimeout);
  }

  function play() {
    if (isEffectActive) return false;
    if (!mount()) return false;
    isEffectActive = true;

    clearTimers();
    applySettingVars();
    renderEyes();
    void overlay.offsetHeight; // reflow so the fade actually transitions
    overlay.classList.add("is-dark");

    darknessTimeoutId = setTimeout(() => {
      eyes.forEach((eye, i) => {
        staggerTimeoutIds.push(setTimeout(() => eye.classList.add("is-visible"), i * TIMING.eyeAppearStaggerMs));
      });
    }, TIMING.darkenMs);
    return true;
  }

  // Graceful end: eyes shatter one by one, THEN the darkness lifts, and
  // only then does isActive() go false (so nothing restarts mid-removal).
  function reset() {
    if (!isEffectActive) return;
    clearTimers();
    stopPupilShake();
    eyes.forEach((eye) => eye.classList.remove("is-glowing"));

    const shown = eyes.filter((eye) => eye.classList.contains("is-visible"));
    if (!shown.length) {
      // Still in the darkening phase - no eyes to break, just lift.
      overlay.classList.remove("is-dark");
      eyeLayer.innerHTML = "";
      eyes = [];
      eyePupils = [];
      isEffectActive = false;
      return;
    }

    shown.forEach((eye, i) => {
      dissipateTimeoutIds.push(setTimeout(() => shatterEye(eye), i * TIMING.eyeDissipateStaggerMs));
    });
    const totalMs = (shown.length - 1) * TIMING.eyeDissipateStaggerMs + TIMING.eyeDissipateMs + SHATTER.maxDelay;
    darknessReverseTimeoutId = setTimeout(() => {
      overlay.classList.remove("is-dark");
      eyeLayer.innerHTML = "";
      eyes = [];
      eyePupils = [];
      isEffectActive = false;
    }, totalMs);
  }

  // Hard cut - no shatter, no fade. Game end, or being replaced by
  // another DT's animation.
  function forceStop() {
    clearTimers();
    stopPupilShake();
    if (overlay) {
      overlay.style.transition = "none";
      overlay.classList.remove("is-dark");
      void overlay.offsetHeight;
      overlay.style.transition = "";
    }
    if (eyeLayer) eyeLayer.innerHTML = "";
    eyes = [];
    eyePupils = [];
    isEffectActive = false;
  }

  function react(kind) {
    if (kind !== "hurt" || !isEffectActive || !eyes.length) return;
    if (glowTimeoutId) clearTimeout(glowTimeoutId);
    eyes.forEach((eye) => eye.classList.add("is-glowing"));
    startPupilShake();
    glowTimeoutId = setTimeout(() => {
      eyes.forEach((eye) => eye.classList.remove("is-glowing"));
      stopPupilShake();
      glowTimeoutId = null;
    }, TIMING.glowMs);
  }

  function destroy() {
    forceStop();
    unbindBoard();
    if (overlay) overlay.remove();
    if (eyeLayer) eyeLayer.remove();
    overlay = eyeLayer = null;
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  return { play, reset, forceStop, react, isActive: () => isEffectActive, destroy };
}

// =================================================================
// DETECTOR
// =================================================================
function createDetector(api) {
  // playerId -> { counter, disabled } for every relevant player who
  // currently has Constricting Darkness. Per-player so the experimental
  // opponent mode (and a mirror match) doesn't cross wires.
  const states = new Map();

  const anyLive = () => [...states.values()].some((s) => !s.disabled);

  function maybeEnd() {
    if (!anyLive()) api.end();
  }

  function applyReading(playerId, cd, source) {
    const prev = states.get(playerId);
    const next = { counter: cd.custom, disabled: !!cd.disabled };
    states.set(playerId, next);

    if (!prev) {
      api.log(`Constricting Darkness appeared for player ${playerId} (via ${source}).`, next);
      if (!next.disabled) api.start(playerId);
      return;
    }
    if (next.disabled && !prev.disabled) {
      api.log(`Constricting Darkness disabled for player ${playerId}.`);
      maybeEnd();
    } else if (!next.disabled && prev.disabled) {
      api.start(playerId); // re-enabled - no-op if already playing
    } else if (!next.disabled && next.counter < prev.counter) {
      api.log(`Counter ${prev.counter} -> ${next.counter} for player ${playerId}.`);
      api.react("hurt");
    }
  }

  function findCd(list) {
    return Array.isArray(list) ? list.find((art) => art && art.id === CONSTRICTING_DARKNESS_ID) : null;
  }

  function handlePlayersStats(event) {
    let byPlayer;
    try {
      byPlayer = typeof event.artifacts === "string" ? JSON.parse(event.artifacts || "{}") : (event.artifacts || {});
    } catch (err) {
      api.warn("getPlayersStats.artifacts failed to parse:", err);
      return;
    }

    const seen = new Set();
    Object.keys(byPlayer).forEach((key) => {
      const playerId = Number(key);
      if (!api.isRelevantPlayer(playerId)) return;
      const cd = findCd(byPlayer[key]);
      if (!cd) return;
      seen.add(playerId);
      applyReading(playerId, cd, "getPlayersStats");
    });

    // Anyone we were tracking whose artifact is now gone.
    let removed = false;
    [...states.keys()].forEach((playerId) => {
      if (!seen.has(playerId)) {
        states.delete(playerId);
        removed = true;
      }
    });
    if (removed) {
      api.log("Constricting Darkness no longer present.");
      maybeEnd();
    }
  }

  function handleArtifactDoingEffect(event) {
    if (event.artifactId !== CONSTRICTING_DARKNESS_ID) return;
    const playerId = Number(event.playerId);
    if (!api.isRelevantPlayer(playerId)) return;
    let battleLog;
    try {
      battleLog = typeof event.battleLog === "string" ? JSON.parse(event.battleLog) : event.battleLog;
    } catch (err) {
      api.warn("getArtifactDoingEffect.battleLog failed to parse:", err);
      return;
    }
    const cd = battleLog && battleLog.artifactActor;
    if (cd && cd.id === CONSTRICTING_DARKNESS_ID) applyReading(playerId, cd, "getArtifactDoingEffect");
  }

  return {
    onGameEvent(event) {
      if (event.action === "getPlayersStats") handlePlayersStats(event);
      else if (event.action === "getArtifactDoingEffect") handleArtifactDoingEffect(event);
    },
    reset() {
      states.clear();
    }
  };
}

// =================================================================
// MODULE
// =================================================================
export default {
  id: "titan",
  name: "Titan",
  description: "Eyes surround the board while Constricting Darkness is active.",
  settings: {
    darkness: {
      name: "Background darkness",
      type: "slider",
      default: 1,
      min: 0,
      max: 1,
      step: 0.05
    },
    eyeOpacity: {
      name: "Eye opacity",
      type: "slider",
      default: 0.65,
      min: 0.2,
      max: 1,
      step: 0.05
    },
    eyeCount: {
      name: "Number of eyes",
      type: "select",
      data: [["8", 8], ["12", 12], ["16", 16]],
      default: 12
    },
    trackCursor: {
      name: "Eyes follow the cursor",
      type: "boolean",
      default: true
    },
    halo: {
      name: "Dark halo behind eyes",
      note: "Helps the eyes stand out on bright backgrounds.",
      type: "boolean",
      default: true
    }
  },
  createEffect,
  createDetector
};
