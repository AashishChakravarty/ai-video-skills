/**
 * reel-kit.js: shared runtime for every layer of a ai-video-skills HyperFrames project. Combines the reel's data
 * (assets/reel-data.js, written by scaffold.mjs) with this version's creative direction (assets/direction.js)
 * and provides frame maths, easing, the format's layout, word anchors and the one shared camera, so the
 * background, scenes, Remotion clip wrappers and chrome all move together. Load it after both data files.
 */
(function () {
  const REEL = window.REEL, D = window.DIRECTION || {};
  const FPS = REEL.fps, DUR = REEL.frames / FPS, TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const wrap = (v, m) => ((v % m) + m) % m;
  const F = (sec) => Math.round(sec * FPS);
  const ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) ** 2,
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
    inCubic: (x) => x ** 3,
    outCubic: (x) => 1 - (1 - x) ** 3,
    inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
    expoOut: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
    backOut: (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
    smooth: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)),
  };
  /** 0→1 progress of frame f through [start, start + dur], shaped by fn. */
  const prog = (f, start, dur, fn = ease.linear) => fn(dur > 0 ? clamp((f - start) / dur) : f >= start ? 1 : 0);

  /** Deterministic hash of integers to [0, 1). */
  function hash(...ns) {
    let h = 0x811c9dc5;
    for (const n of ns) {
      h = Math.imul(h ^ (n | 0), 0x5bd1e995);
      h ^= h >>> 15;
    }
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Seeded PRNG (mulberry32); never use Math.random in a composition. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const LAYOUTS = {
    portrait: {
      W: 1080, H: 1920, camOrigin: [540, 895],
      header: { band: 360, logo: { x: 56, y: 260, size: 64 }, wordmark: { x: 132, y: 271, size: 42 }, handle: { right: 60, y: 270, size: 40 }, hair: 344 },
      ticker: { top: 360, h: 72, size: 42, badgeW: 190 },
      progress: { y: 1538, x0: 90, x1: 990 },
      footer: { bandTop: 1570, cta: { x: 60, y: 1590, w: 260, h: 76 }, textY: 1628, size: 44, handleX: 590, final: { followY: 930, followSize: 96, handleY: 1010, handleSize: 40 }, next: { x: 90, y: 1556, w: 900, h: 144, size: 64 } },
      captions: { y: 1373, h: 96, size: 46, maxW: 880 },
      safe: { top: 450, bottom: 1340, left: 60, right: 1020 },
    },
    landscape: {
      W: 1920, H: 1080, camOrigin: [960, 560],
      header: { band: 130, logo: { x: 56, y: 30, size: 68 }, wordmark: { x: 140, y: 44, size: 44 }, cta: { right: 56, y: 34, h: 62, size: 36 }, hair: 118 },
      ticker: { top: 126, h: 68, size: 40, badgeW: 180 },
      progress: { y: 1050, x0: 60, x1: 1860 },
      footer: null,
      captions: { y: 880, h: 100, size: 52, maxW: 1500 },
      safe: { top: 220, bottom: 850, left: 120, right: 1800 },
    },
  };
  const L = LAYOUTS[REEL.format];

  /** Spoken time (s) of the n-th anchor `token` in `scene` from script.timed.md; throws if it is not an anchor. */
  function anchor(scene, token, n = 0) {
    const hits = REEL.anchors.filter((a) => a.scene === scene && a.token === token);
    if (!hits[n]) throw new Error(`reel-kit: no anchor "${token}"${n ? ` #${n}` : ''} in scene ${scene}; add @${token} to script.md and re-run script.mjs time + scaffold --sync`);
    return hits[n].t;
  }

  /** Start (s) of the first spoken word matching `word` at or after `from` seconds, for beats that are not script anchors. */
  function wordAt(word, from = 0) {
    const key = word.normalize('NFC').toLowerCase();
    const w = REEL.words.find(([text, start]) => start >= from && text.normalize('NFC').toLowerCase().replace(/[.,!?।…]/g, '') === key);
    if (!w) throw new Error(`reel-kit: no spoken word "${word}" after ${from}s`);
    return w[1];
  }

  const scene = (id) => REEL.scenes.find((s) => s.id === id) || (() => { throw new Error(`reel-kit: no scene ${id}`); })();

  /** The shared camera at time t: pushes, punches and shakes from DIRECTION.camera, identical in every layer. */
  function camAt(t) {
    const cam = D.camera || {};
    let s = 1, x = 0, y = 0;
    for (const p of cam.pushes || []) {
      const rel = p.release ?? 0.3;
      s += p.amount * ease.smooth((t - p.from) / (p.to - p.from)) * (1 - ease.smooth((t - p.to) / rel));
    }
    for (const p of cam.punches || []) {
      const k = t - p.at, decay = p.decay ?? 0.22;
      if (k >= 0) s += k < 0.12 ? p.amount * (1 - (1 - k / 0.12) ** 3) : p.amount * Math.exp(-(k - 0.12) / decay);
    }
    for (const [a0, amp, dur] of cam.hits || []) {
      const d = t - a0;
      if (d < 0) continue;
      s += amp * 0.003 * (d < 0.1 ? 1 - (1 - d / 0.1) ** 3 : Math.exp(-(d - 0.1) / 0.2));
      if (d > dur) continue;
      const a = amp * (1 - d / dur) ** 2, n = Math.floor(d * FPS), seed = Math.round(a0 * FPS);
      x += (hash(n, seed, 1) * 2 - 1) * a;
      y += (hash(n, seed, 2) * 2 - 1) * a;
    }
    return { s, x, y };
  }

  /** Applies the camera at time t to an element (depth < 1 for parallax layers behind the action). */
  function applyCam(el, t, depth = 1) {
    const c = camAt(t), s = (1 + (c.s - 1) * depth) * ((D.camera && D.camera.scale) ?? 1);
    el.style.transformOrigin = `${L.camOrigin[0]}px ${L.camOrigin[1]}px`;
    el.style.transform = `translate(${(c.x * depth).toFixed(2)}px, ${(c.y * depth).toFixed(2)}px) scale(${s.toFixed(4)})`;
  }

  /** Registers a paused root timeline for composition `id` that calls render(t) with local time t over dur seconds. */
  function drive(id, dur, render) {
    const clock = { t: 0 };
    const tl = gsap.timeline({ paused: true });
    tl.to(clock, { t: dur, duration: dur, ease: 'none', onUpdate: () => render(clock.t) }, 0);
    render(0);
    window.__timelines = window.__timelines || {};
    window.__timelines[id] = tl;
    return tl;
  }

  /** Runs cb once the reel fonts are ready, so text metrics are final before layout. */
  function fonts(cb) {
    Promise.all(['800 56px "Reel Sans"', '700 56px "Reel Mono"'].map((f) => document.fonts.load(f, 'Aअ1'))).then(cb);
  }

  /** Where the middle of the capitals sits below the top of a line-height-1 box, as a fraction of the font size. */
  const CAP_MID = { sans: 0.39, mono: 0.495 };

  /** WCAG relative luminance of a #rrggbb colour. */
  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [16, 8, 0].reduce((sum, s, i) => {
      const c = ((n >> s) & 255) / 255;
      return sum + [0.2126, 0.7152, 0.0722][i] * (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    }, 0);
  };
  const P = REEL.palette, ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  /** Text colour that reads on an accent fill: white when it has 3:1 there (purple, red), else the background (yellow). */
  const onAccent = ratio(P.white, P.accent) >= 3 ? P.white : P.bg;
  /** A light theme (paper background, dark ink in palette.white): layers swap glows and black shades for soft ink. */
  const light = luminance(P.bg) > 0.5;
  /** Fill for cards, chips and boxes: palette.surface when the theme sets one, else the background. */
  const surface = P.surface || P.bg;
  /** The theme's card look (REEL.cards.style): "soft" (hairline edge, layered tinted shadow), "hard" (solid ink edge, offset ink shadow) or null (outlines). */
  const cards = (REEL.cards && REEL.cards.style) || null;
  const ink = light ? P.white : P.text;
  /** A drop shadow for a card at depth (1 = a full card, ~0.3 for a chip), in the theme's card look. */
  const shadow = (depth = 1) => {
    const n = (v) => Math.max(1, Math.round(v * depth));
    if (cards === "hard") return `${n(8)}px ${n(8)}px 0 ${light ? ink : P.accent}`;
    if (cards === "soft") return `0 1px 2px ${rgba(ink, 0.08)}, 0 ${n(6)}px ${n(16)}px ${rgba(ink, 0.08)}, 0 ${n(22)}px ${n(48)}px ${rgba(P.accent, 0.16)}`;
    return light ? `0 ${n(14)}px ${n(36)}px ${rgba(ink, 0.14)}` : `0 ${n(30)}px ${n(80)}px rgba(0,0,0,0.55)`;
  };
  /** A card or cell border colour lit toward the accent by act 0–1; at rest it is the text at alpha a (outlines), a hairline (soft) or solid ink (hard). */
  const lit = (act = 0, a = 0.5) => {
    const [hex, al] = cards === "hard" ? [ink, 1] : [P.text, cards === "soft" ? 0.18 : a];
    const x = parseInt(hex.slice(1), 16), y = parseInt(P.accent.slice(1), 16), q = clamp(act);
    const c = (s) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, q));
    return `rgba(${c(16)},${c(8)},${c(0)},${lerp(al, 1, q)})`;
  };
  /** Border shorthand for a card or cell at rest (see lit). */
  const edge = (a = 0.5) => `${cards === "soft" ? 2 : 4}px solid ${lit(0, a)}`;

  window.ReelKit = { REEL, D, FPS, DUR, TAU, L, LAYOUTS, CAP_MID, F, clamp, lerp, wrap, ease, prog, hash, rng, rgba, onAccent, light, surface, cards, shadow, lit, edge, anchor, wordAt, scene, camAt, applyCam, drive, fonts };
})();
