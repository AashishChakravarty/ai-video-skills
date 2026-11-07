/**
 * design.js: the shared design system every scene builds with, so text sizes, object sizes and spacing match across
 * a reel. A type scale (T: hero 96, title 64, stamp 56, label 40, chip 30 mono, note 28), a layout grid (GRID), text
 * and chip helpers that only take type-scale kinds, line icons (hacker with a hat, user, laptop, container, signer,
 * key, contract, wallets), icon boxes, vertical step flows (flowRow + flowLink), a terminal window with small mono
 * text, a map pin, a realistic phone with app-UI text (phone, ui: regular weight, 28 px floor), and the low-level
 * DOM/SVG helpers. Exposed as window.Design; load after reel-kit.js. A version's
 * own assets/diagram.js adds its topic objects (hero card, safe, ...) on top of it. The grid, the default text centre
 * (CX) and the flow positions follow the reel's format, so a scene that reads them re-lays itself for the 16:9 cut.
 */
(function () {
  const K = window.ReelKit, { REEL, TAU, rgba, clamp, lerp } = K, C = REEL.palette;
  const LAND = REEL.format === "landscape", CX = K.L.W / 2;
  const SVGNS = "http://www.w3.org/2000/svg";
  const px = (v) => `${v}px`;

  /** Creates an absolutely positioned element (or "svg:<tag>") under parent with an id, CSS and inner HTML. */
  function mk(parent, tag, id, css, html) {
    const svg = tag.startsWith("svg:");
    const n = svg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
    if (id) n.id = id;
    if (!svg) n.style.position = "absolute";
    if (css) Object.assign(n.style, css);
    if (html != null) n.innerHTML = html;
    parent.appendChild(n);
    return n;
  }

  /** Sets SVG attributes on an element. */
  function attrs(n, a) {
    for (const k in a) n.setAttribute(k, a[k]);
    return n;
  }

  /** An SVG canvas centred on (cx, cy) in its parent, with a viewBox whose origin is that centre. */
  function svgAt(parent, id, cx, cy, half) {
    const s = mk(parent, "svg:svg", id);
    attrs(s, { width: half * 2, height: half * 2, viewBox: `${-half} ${-half} ${half * 2} ${half * 2}` });
    Object.assign(s.style, { position: "absolute", left: px(cx - half), top: px(cy - half), overflow: "visible" });
    return s;
  }

  /** Blends two #rrggbb colours; returns rgba() with alpha a. */
  function mix(a, b, p, al = 1) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), q = clamp(p);
    const c = (s) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, q));
    return `rgba(${c(16)},${c(8)},${c(0)},${al})`;
  }

  /** Places an element: translate (x, y), rotation in degrees, uniform scale, opacity. */
  function pose(n, x = 0, y = 0, s = 1, r = 0, a = 1) {
    n.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
    n.style.opacity = String(clamp(a));
  }

  /** Offset (in em) from a line box's top to the centre of its capitals, per font, at line-height 1. */
  const CAP_MID = K.CAP_MID;

  /**
   * A single line of text centred on x whose capitals are centred on cy. Font sizes are in px; mono picks
   * Reel Mono. Returns the element (opacity 0 until the scene poses it); its transform origin is the cap centre.
   */
  function line(parent, id, str, { x = CX, cy, size, mono = false, color = C.white, w = 980, align = "center", ls = "0px" }) {
    const top = cy - (mono ? CAP_MID.mono : CAP_MID.sans) * size;
    const n = mk(parent, "div", id, {
      left: px(x - w / 2), top: px(top), width: px(w), textAlign: align, fontSize: px(size), lineHeight: "1",
      transformOrigin: `${w / 2}px ${(cy - top).toFixed(1)}px`,
      whiteSpace: "pre", color, letterSpacing: ls, opacity: "0",
      fontFamily: mono ? '"Reel Mono", monospace' : '"Reel Sans", sans-serif', fontWeight: mono ? "700" : "800",
    });
    n.textContent = str;
    return n;
  }

  /** A rounded label chip (dark fill, coloured border) centred on (x, y); returns the element. */
  function chip(parent, id, str, { x, y, size = 52, w, h = 84, mono = false, color = C.white, border = C.accent }) {
    const n = mk(parent, "div", id, {
      left: px(x - w / 2), top: px(y - h / 2), width: px(w), height: px(h), borderRadius: px(h / 2),
      border: `4px solid ${border}`, background: rgba(K.surface, 0.92), boxSizing: "border-box", display: "flex",
      alignItems: "center", justifyContent: "center", fontSize: px(size), lineHeight: "1", whiteSpace: "pre", color,
      paddingTop: mono ? "0px" : px(Math.round((0.5 - CAP_MID.sans) * 2 * size)),
      fontFamily: mono ? '"Reel Mono", monospace' : '"Reel Sans", sans-serif', fontWeight: mono ? "700" : "800",
      boxShadow: K.light || K.cards ? K.shadow(0.4) : `0 0 28px ${rgba(border, 0.35)}`, opacity: "0", transformOrigin: "50% 50%",
    });
    n.textContent = str;
    return n;
  }

  /** A white rubber stamp (thick border, big caps) centred on (x, cy), tilted by the scene; returns the element. */
  function stamp(parent, id, str, { x = CX, cy, size = T.stamp.size, w = 760, color = C.white }) {
    const h = Math.round(size * 1.3);
    const n = mk(parent, "div", id, {
      left: px(x - w / 2), top: px(cy - h / 2), width: px(w), height: px(h), boxSizing: "border-box",
      border: `8px solid ${color}`, borderRadius: "18px", background: rgba(C.bg, 0.55), color, fontSize: px(size),
      lineHeight: "1", letterSpacing: "4px", display: "flex", alignItems: "center", justifyContent: "center",
      paddingTop: px(Math.round((0.5 - CAP_MID.sans) * 2 * size)), whiteSpace: "pre", opacity: "0", transformOrigin: "50% 50%",
    });
    n.textContent = str;
    return n;
  }

  /** A stroke that draws itself: an SVG path in svg's coordinates. Returns { el, set(draw 0–1, alpha) }. */
  function wire(svg, id, d, { stroke = C.accent, width = 6, dash = null } = {}) {
    const p = attrs(mk(svg, "svg:path", id), { d, fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1 });
    return {
      el: p,
      set(draw = 1, a = 1) {
        const dr = clamp(draw);
        attrs(p, { "stroke-dasharray": dash && dr >= 1 ? dash : `${dr.toFixed(4)} 1` });
        p.style.opacity = String(dr > 0 ? clamp(a) : 0);
      },
    };
  }

  /** A progress ring of radius r centred on (cx, cy) that draws clockwise from 12 o'clock. Returns { el, set(p, alpha) }. */
  function ring(parent, id, cx, cy, r, { stroke = C.accent, width = 10 } = {}) {
    const s = svgAt(parent, id, cx, cy, r + width);
    const base = attrs(mk(s, "svg:circle", `${id}-base`), { r, fill: "none", stroke: rgba(C.text, 0.14), "stroke-width": width });
    const arc = attrs(mk(s, "svg:circle", `${id}-arc`), { r, fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", transform: "rotate(-90)", pathLength: 1 });
    return {
      el: s,
      set(p, a = 1) {
        attrs(arc, { "stroke-dasharray": `${clamp(p).toFixed(4)} 1` });
        arc.style.opacity = String(p > 0 ? 1 : 0);
        base.style.opacity = "1";
        s.style.opacity = String(clamp(a));
      },
    };
  }

  /** Inline SVG markup of the topic logo at size s in colour fill (empty string without a logo). */
  const logoSvg = (s, fill) =>
    REEL.logo ? `<svg viewBox="0 0 24 24" width="${s}" height="${s}" style="position:absolute;left:0;top:0"><path d="${REEL.logo.path}" fill="${fill}"/></svg>` : "";

  /** Whole-number display with thousands separators, so rolling counters never show fractions. */
  const num = (n) => Math.round(n).toLocaleString("en-US");

  function bez(p0, c, p1, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
  }

  /** A slow ±1 breathing value at frame f, for glows that should not pop between scenes. */
  const breath = (f) => Math.sin(f * 0.12);

  /**
   * Layout grid (canvas px) for the reel's format: the title row, the stage rows, two columns, the rows of a three-step
   * vertical flow and the note row above the captions. Portrait 1080 × 1920; landscape 1920 × 1080 (content y 220–850).
   */
  const GRID = LAND
    ? { title: 270, rows: [400, 560, 720], colL: 640, colR: 1280, flow: [390, 585, 780], note: 810, gap: 24 }
    : { title: 470, rows: [640, 820, 1000, 1180], colL: 300, colR: 780, flow: [680, 900, 1120], note: 1300, gap: 24 };

  /**
   * Type scale: every word on screen uses one of these kinds, so sizes match from scene to scene. Sizes are canvas
   * px at camera scale 1 and never scale with an object: labels sit beside objects, not inside them.
   */
  const T = {
    hero: { size: 96, mono: false },
    title: { size: 64, mono: false },
    stamp: { size: 56, mono: false },
    label: { size: 40, mono: false },
    chip: { size: 30, mono: true },
    note: { size: 28, mono: false },
  };

  /** A line of text in one type-scale kind: left-aligned from `left` when given, else centred on x. */
  function text(parent, id, str, { kind = "label", x = CX, left = null, cy, color = C.white, w = 900 }) {
    const k = T[kind];
    const n = left != null
      ? line(parent, id, str, { x: left + w / 2, cy, size: k.size, mono: k.mono, color, w, align: "left" })
      : line(parent, id, str, { x, cy, size: k.size, mono: k.mono, color, w });
    // A card look marks titles with a highlighter stroke through the lower half of the letters.
    if (kind === "title" && K.cards) Object.assign(n.style, { textDecorationLine: "underline", textDecorationColor: rgba(C.accent, 0.22), textDecorationThickness: "24px", textUnderlineOffset: "-18px", textDecorationSkipInk: "none" });
    return n;
  }

  /** A chip in the chip kind (mono 30 px, 56 px tall) sized to its text, centred on (x, y). */
  function tag(parent, id, str, { x, y, color = C.white, border = C.accent }) {
    const w = Math.round([...str].length * T.chip.size * 0.6 + 52);
    return chip(parent, id, str, { x, y, w, h: 56, size: T.chip.size, mono: true, color, border });
  }

  const stroke = (g, d, col = C.white, w = 6) =>
    attrs(mk(g, "svg:path", null), { d, fill: "none", stroke: col, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" });

  /** Line icons drawn into an SVG group on a 120 × 120 box centred on the origin (white strokes, gold details). */
  const ICONS = {
    hacker(g) {
      attrs(mk(g, "svg:path", null), { d: "M -40 52 C -40 20 40 20 40 52", fill: "none", stroke: C.white, "stroke-width": 7, "stroke-linecap": "round" });
      attrs(mk(g, "svg:circle", null), { cx: 0, cy: -6, r: 22, fill: C.bg, stroke: C.white, "stroke-width": 7 });
      attrs(mk(g, "svg:rect", null), { x: -17, y: -12, width: 34, height: 10, rx: 4, fill: C.white });
      attrs(mk(g, "svg:path", null), { d: "M -22 -26 L -17 -52 H 17 L 22 -26 Z", fill: C.white });
      attrs(mk(g, "svg:rect", null), { x: -21, y: -37, width: 42, height: 8, fill: C.accent });
      attrs(mk(g, "svg:path", null), { d: "M -40 -24 H 40", stroke: C.white, "stroke-width": 8, "stroke-linecap": "round" });
    },
    laptop(g) {
      attrs(mk(g, "svg:rect", null), { x: -44, y: -38, width: 88, height: 60, rx: 6, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      attrs(mk(g, "svg:path", null), { d: "M -28 -22 L -16 -12 L -28 -2 M -10 2 H 8", fill: "none", stroke: C.accent, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
      attrs(mk(g, "svg:path", null), { d: "M -58 28 H 58 L 50 40 H -50 Z", fill: C.white });
    },
    container(g) {
      attrs(mk(g, "svg:rect", null), { x: -46, y: -42, width: 92, height: 84, rx: 10, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      for (let i = 0; i < 5; i++) attrs(mk(g, "svg:path", null), { d: `M ${-28 + i * 14} -26 V 26`, stroke: rgba(C.text, 0.8), "stroke-width": 5, "stroke-linecap": "round" });
    },
    signer(g) {
      attrs(mk(g, "svg:rect", null), { x: -10, y: -52, width: 20, height: 26, rx: 6, fill: C.white });
      attrs(mk(g, "svg:rect", null), { x: -22, y: -28, width: 44, height: 12, rx: 4, fill: C.white });
      attrs(mk(g, "svg:rect", null), { x: -40, y: -16, width: 80, height: 22, rx: 6, fill: C.accent });
      attrs(mk(g, "svg:path", null), { d: "M -40 38 C -30 20 -20 20 -14 36 S 0 50 8 32 S 26 20 40 34", fill: "none", stroke: C.white, "stroke-width": 5, "stroke-linecap": "round" });
    },
    key(g) {
      attrs(mk(g, "svg:circle", null), { cx: -24, cy: 0, r: 18, fill: "none", stroke: C.accent, "stroke-width": 8 });
      attrs(mk(g, "svg:path", null), { d: "M -6 0 H 46 M 30 0 V 16 M 42 0 V 12", fill: "none", stroke: C.accent, "stroke-width": 8, "stroke-linecap": "round" });
    },
    user(g) {
      attrs(mk(g, "svg:path", null), { d: "M -40 52 C -40 20 40 20 40 52", fill: "none", stroke: C.white, "stroke-width": 7, "stroke-linecap": "round" });
      attrs(mk(g, "svg:circle", null), { cx: 0, cy: -12, r: 24, fill: C.bg, stroke: C.white, "stroke-width": 7 });
    },
    contract(g) {
      attrs(mk(g, "svg:path", null), { d: "M -36 -50 H 20 L 38 -32 V 50 H -36 Z", fill: C.bg, stroke: C.white, "stroke-width": 6, "stroke-linejoin": "round" });
      attrs(mk(g, "svg:path", null), { d: "M -20 -22 L -30 -10 L -20 2 M 8 -22 L 18 -10 L 8 2 M -2 14 H 22 M -22 30 H 22", fill: "none", stroke: C.accent, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    },
    wallets(g) {
      [[-26, -30, 0.3], [-12, -14, 0.6], [2, 2, 1]].forEach(([x, y, a]) =>
        attrs(mk(g, "svg:rect", null), { x: x - 20, y, width: 80, height: 50, rx: 8, fill: a === 1 ? C.accent : C.bg, stroke: C.accent, "stroke-width": 5, opacity: a }));
    },
    globe(g) {
      attrs(mk(g, "svg:circle", null), { r: 44, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      stroke(g, "M -44 0 H 44 M 0 -44 C -26 -20 -26 20 0 44 C 26 20 26 -20 0 -44");
      for (const [x, y] of [[-30, -30], [32, -24], [26, 32], [-34, 26]]) attrs(mk(g, "svg:circle", null), { cx: x, cy: y, r: 7, fill: C.accent });
    },
    shield(g) {
      attrs(mk(g, "svg:path", null), { d: "M 0 -50 L 40 -34 V 2 C 40 28 22 44 0 52 C -22 44 -40 28 -40 2 V -34 Z", fill: C.bg, stroke: C.white, "stroke-width": 6, "stroke-linejoin": "round" });
      stroke(g, "M -16 2 L -4 14 L 18 -12", C.accent, 7);
    },
    server(g) {
      for (const y of [-42, -10, 22]) {
        attrs(mk(g, "svg:rect", null), { x: -44, y, width: 88, height: 26, rx: 6, fill: C.bg, stroke: C.white, "stroke-width": 5 });
        attrs(mk(g, "svg:circle", null), { cx: -28, cy: y + 13, r: 4, fill: C.accent });
        stroke(g, `M 4 ${y + 13} H 30`, rgba(C.text, 0.8), 4);
      }
    },
    router(g) {
      attrs(mk(g, "svg:rect", null), { x: -22, y: -22, width: 44, height: 44, rx: 8, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      stroke(g, "M 0 -24 V -48 M -10 -40 L 0 -50 L 10 -40 M 0 24 V 50 M -10 42 L 0 52 L 10 42", C.white, 5);
      stroke(g, "M 22 0 H 50 M 42 -9 L 51 0 L 42 9 M -22 0 H -50 M -42 -9 L -51 0 L -42 9", C.accent, 5);
    },
    db(g) {
      attrs(mk(g, "svg:path", null), { d: "M -40 -32 V 32 C -40 48 40 48 40 32 V -32", fill: C.bg, stroke: C.white, "stroke-width": 6 });
      attrs(mk(g, "svg:ellipse", null), { cx: 0, cy: -32, rx: 40, ry: 14, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      stroke(g, "M -40 0 C -40 16 40 16 40 0", C.accent, 5);
    },
    lock(g) {
      stroke(g, "M -20 -6 V -24 C -20 -50 20 -50 20 -24 V -6", C.white, 8);
      attrs(mk(g, "svg:rect", null), { x: -34, y: -8, width: 68, height: 54, rx: 10, fill: C.accent });
      attrs(mk(g, "svg:circle", null), { cx: 0, cy: 16, r: 7, fill: C.bg });
    },
    cloud(g) {
      attrs(mk(g, "svg:path", null), { d: "M -38 30 H 36 C 56 30 56 2 38 0 C 40 -26 6 -36 -6 -16 C -20 -32 -46 -20 -40 2 C -58 6 -56 30 -38 30 Z", fill: C.bg, stroke: C.white, "stroke-width": 6, "stroke-linejoin": "round" });
      stroke(g, "M -14 14 H 18", C.accent, 6);
    },
    chat(g) {
      attrs(mk(g, "svg:path", null), { d: "M -44 -36 H 44 V 22 H -6 L -26 42 V 22 H -44 Z", fill: C.bg, stroke: C.white, "stroke-width": 6, "stroke-linejoin": "round" });
      for (const x of [-20, 0, 20]) attrs(mk(g, "svg:circle", null), { cx: x, cy: -7, r: 6, fill: C.accent });
    },
    train(g) {
      attrs(mk(g, "svg:rect", null), { x: -36, y: -46, width: 72, height: 76, rx: 16, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      attrs(mk(g, "svg:rect", null), { x: -24, y: -32, width: 48, height: 24, rx: 4, fill: C.accent });
      for (const x of [-18, 18]) attrs(mk(g, "svg:circle", null), { cx: x, cy: 14, r: 6, fill: C.white });
      stroke(g, "M -26 30 L -38 50 M 26 30 L 38 50", C.white, 6);
    },
    clock(g) {
      attrs(mk(g, "svg:circle", null), { r: 46, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      stroke(g, "M 0 0 V -30 M 0 0 L 20 10", C.accent, 7);
    },
    phone(g) {
      attrs(mk(g, "svg:rect", null), { x: -28, y: -50, width: 56, height: 100, rx: 12, fill: C.bg, stroke: C.white, "stroke-width": 6 });
      stroke(g, "M -8 -38 H 8", C.white, 5);
      attrs(mk(g, "svg:circle", null), { cx: 0, cy: 36, r: 5, fill: C.accent });
    },
    bank(g) {
      attrs(mk(g, "svg:path", null), { d: "M -48 -18 L 0 -48 L 48 -18 Z", fill: C.bg, stroke: C.white, "stroke-width": 6, "stroke-linejoin": "round" });
      stroke(g, "M -34 -10 V 30 M -12 -10 V 30 M 12 -10 V 30 M 34 -10 V 30", C.accent, 7);
      stroke(g, "M -48 42 H 48", C.white, 7);
    },
  };

  const ICON = 132, FLOW_X = LAND ? 560 : 300, FLOW_TEXT = FLOW_X + 100;

  /** An icon in its 132 px rounded box centred on (x, y) (a flow step's box, or a stand-alone icon). Returns the box element. */
  function iconBox(parent, id, icon, { x, y }) {
    const box = mk(parent, "div", id, {
      left: px(x - ICON / 2), top: px(y - ICON / 2), width: px(ICON), height: px(ICON), borderRadius: "28px",
      border: K.edge(0.5), boxSizing: "border-box", background: rgba(K.surface, 0.95), opacity: "0", transformOrigin: "50% 50%",
    });
    const s = attrs(mk(box, "svg:svg", `${id}-ico`), { width: ICON - 8, height: ICON - 8, viewBox: "-60 -60 120 120" });
    Object.assign(s.style, { position: "absolute", left: "0px", top: "0px" });
    ICONS[icon](mk(s, "svg:g", null));
    return box;
  }

  /** Lights an icon box: act 0–1 turns its border gold with a glow. */
  function lightBox(box, act) {
    const a = clamp(act);
    box.style.borderColor = K.lit(a, 0.5);
    box.style.boxShadow = [K.cards && K.shadow(0.5), `0 0 ${(36 * a).toFixed(1)}px ${rgba(C.accent, 0.45 * a)}`].filter(Boolean).join(", ");
  }

  /**
   * One step of a vertical flow: an icon box at FLOW_X and its label (label kind) over a sub line (chip kind),
   * left-aligned at FLOW_TEXT, centred on y. Returns { box, set({ a, act, dim, pop, subA }) }: act lights the box, dim
   * fades a finished step, pop slides the step in.
   */
  function flowRow(parent, id, { y, icon, label, sub = "", subColor = C.accent }) {
    const box = iconBox(parent, `${id}-box`, icon, { x: FLOW_X, y });
    const lab = text(parent, `${id}-lab`, label, { kind: "label", left: FLOW_TEXT, w: 720, cy: sub ? y - 22 : y });
    const sb = sub ? text(parent, `${id}-sub`, sub, { kind: "chip", left: FLOW_TEXT, w: 720, cy: y + 30, color: subColor }) : null;
    return {
      box,
      set({ a = 1, act = 0, dim = 0, pop = 1, subA = 1 }) {
        const al = clamp(a) * (1 - 0.6 * clamp(dim)), p = clamp(pop);
        box.style.opacity = String(al);
        box.style.transform = `scale(${lerp(0.6, 1, p).toFixed(4)})`;
        lightBox(box, act);
        pose(lab, -24 * (1 - p), 0, 1, 0, al);
        if (sb) pose(sb, -24 * (1 - p), 0, 1, 0, al * clamp(subA));
      },
    };
  }

  /** A downward arrow between two flow steps at FLOW_X (box edges at y1 + 66 and y2 − 66). Returns { set(p, alpha) }. */
  function flowLink(parent, id, y1, y2, { x = FLOW_X } = {}) {
    const top = y1 + ICON / 2 + 6, bot = y2 - ICON / 2 - 6, half = (bot - top) / 2 + 20;
    const s = svgAt(parent, id, x, (top + bot) / 2, half);
    const shaft = wire(s, `${id}-shaft`, `M 0 ${-(bot - top) / 2} V ${(bot - top) / 2 - 2}`, { stroke: rgba(C.text, 0.7), width: 5 });
    const head = wire(s, `${id}-head`, `M -11 ${(bot - top) / 2 - 13} L 0 ${(bot - top) / 2} L 11 ${(bot - top) / 2 - 13}`, { stroke: rgba(C.text, 0.7), width: 5 });
    return { set(p, a = 1) { shaft.set(p, a); head.set(p >= 0.95 ? 1 : 0, a); } };
  }

  /** A window title bar (60 px) across the top of card o: three dots (traffic lights in a card look) and a centred mono title. */
  function winBar(o, id, title) {
    const hard = K.cards === "hard", lights = ["#FF5F57", "#FEBC2E", "#28C840"];
    const bar = mk(o, "div", `${id}-bar`, {
      left: "0px", top: "0px", width: "100%", height: "60px", boxSizing: "border-box",
      background: hard ? C.accent : K.cards ? rgba(C.accent, 0.07) : rgba(C.text, 0.08),
      borderBottom: hard ? K.edge() : `2px solid ${K.cards ? K.lit(0) : rgba(C.text, 0.2)}`,
    });
    for (let i = 0; i < 3; i++) mk(bar, "div", `${id}-dot${i}`, { left: px(26 + i * 34), top: "20px", width: "20px", height: "20px", borderRadius: "50%", boxSizing: "border-box", background: K.cards ? lights[i] : rgba(C.text, 0.4), border: hard ? `2px solid ${K.lit(0)}` : "none" });
    const ttl = mk(bar, "div", `${id}-title`, { left: "0px", top: "15px", width: "100%", textAlign: "center", fontFamily: '"Reel Mono", monospace', fontWeight: "700", fontSize: px(T.chip.size), lineHeight: "1", color: hard ? K.onAccent : rgba(C.text, 0.7), whiteSpace: "pre" });
    ttl.textContent = title;
    return bar;
  }

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /**
   * A terminal window w × h centred on (x, cy): a title bar with three dots and a title, then mono lines in the chip
   * kind typed on character by character. lines = [[[text, colour], …], …]. Returns
   * { el, chars, set({ alpha, s, typed, caret, glow }) } where chars is the total character count.
   */
  function terminal(parent, id, { x = CX, cy, w = 940, h = 380, title = "monitor.log", lines }) {
    const o = mk(parent, "div", id, {
      left: px(x - w / 2), top: px(cy - h / 2), width: px(w), height: px(h), borderRadius: "26px", border: K.edge(0.6),
      boxSizing: "border-box", background: rgba(K.surface, 0.97), overflow: "hidden", opacity: "0", transformOrigin: "50% 50%",
      boxShadow: K.shadow(),
    });
    winBar(o, id, title);
    const body = mk(o, "div", `${id}-body`, { left: "44px", top: "92px", width: px(w - 88), fontFamily: '"Reel Mono", monospace', fontWeight: "700", fontSize: px(T.chip.size), lineHeight: "1.75", color: C.text, whiteSpace: "pre" });
    const chars = lines.reduce((n, segs) => n + segs.reduce((m, [s]) => m + s.length, 0), 0);
    let last = "";
    return {
      el: o, chars,
      set({ alpha = 1, s = 1, typed = Infinity, caret = 0, glow = 0 }) {
        o.style.opacity = String(clamp(alpha));
        o.style.transform = `scale(${s.toFixed(4)})`;
        o.style.borderColor = K.lit(glow, 0.6);
        let left = Math.floor(typed), html = "", placed = false;
        for (const segs of lines) {
          let row = "";
          for (const [str, col] of segs) {
            if (left <= 0) break;
            const part = str.slice(0, left);
            left -= part.length;
            row += `<span style="color:${col}">${esc(part)}</span>`;
          }
          if (!placed && left <= 0) {
            row += `<span style="display:inline-block;width:0.55em;height:0.9em;vertical-align:-0.12em;background:${C.accent};opacity:${clamp(caret).toFixed(2)}"></span>`;
            placed = true;
          }
          html += `<div>${row || "&nbsp;"}</div>`;
          if (left <= 0) break;
        }
        if (html !== last) body.innerHTML = last = html;
      },
    };
  }

  /** The map pin shared by scene-root and scene-who: gold teardrop, tip on the pose point, dark hole 100 px above it. */
  function mapPin(parent, id) {
    const o = mk(parent, "div", id, { left: "0px", top: "0px", width: "0px", height: "0px" });
    const s = svgAt(o, `${id}-svg`, 0, 0, 180);
    const body = attrs(mk(s, "svg:path", `${id}-body`), { d: "M 0 0 L -48 -64 A 60 60 0 1 1 48 -64 Z", fill: C.accent });
    attrs(mk(s, "svg:circle", `${id}-hole`), { cx: 0, cy: -100, r: 24, fill: C.bg });
    return {
      el: o,
      set({ x, y, s = 1, sx = 1, sy = 1, alpha = 1, white = 0 }) {
        o.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(s * sx).toFixed(4)}, ${(s * sy).toFixed(4)})`;
        o.style.opacity = String(clamp(alpha));
        body.setAttribute("fill", white > 0 ? mix(C.accent, C.white, white) : C.accent);
      },
    };
  }

  /** App-screen text sizes inside a phone: xs is the 28 px legibility floor at 1080 wide. */
  const UI = { xs: 28, s: 30, m: 34, l: 48, xl: 64 };

  /**
   * Text on an app screen: a UI size, regular weight unless bold (the 400 fonts every composition declares), visible at
   * once; left-, right- or centre-aligned from left / right / x. Sentence case, like a real app.
   */
  function ui(parent, id, str, { k = "xs", x, left, right, cy, w = 280, bold = false, mono = false, color = C.text }) {
    const align = left != null ? "left" : right != null ? "right" : "center";
    const cx = left != null ? left + w / 2 : right != null ? right - w / 2 : x;
    const n = line(parent, id, str, { x: cx, cy, size: UI[k], mono, color, w, align });
    n.style.fontWeight = bold ? (mono ? "700" : "800") : "400";
    n.style.opacity = "1";
    return n;
  }

  /** An icon from ICONS drawn s px square, centred on (x, y) inside parent (an avatar, a notification's app icon). */
  function glyph(parent, id, icon, s, x, y) {
    const v = attrs(mk(parent, "svg:svg", id), { width: s, height: s, viewBox: "-60 -60 120 120" });
    Object.assign(v.style, { position: "absolute", left: px(x - s / 2), top: px(y - s / 2) });
    ICONS[icon](mk(v, "svg:g", null));
    return v;
  }

  /**
   * A modern phone (w × h, centred on (x, y)): dark frame, side keys, Dynamic Island, status bar (9:41, signal,
   * battery) and home bar. Build the app inside `screen` (sw × sh, top-left origin; content from y ≈ 60, above
   * sh − 30) with ui() and glyph(); pose `el` to move it. 340 × 690 fits two side by side in portrait.
   */
  function phone(parent, id, { x, y, w = 340, h = 690 }) {
    const BEZ = 10, sw = w - 2 * BEZ, sh = h - 2 * BEZ, FRAME = "#1D1B24", INK = C.white;
    const o = mk(parent, "div", id, { left: px(x - w / 2), top: px(y - h / 2), width: px(w), height: px(h), transformOrigin: "50% 50%" });
    for (const [side, top, len] of [["left", 130, 40], ["left", 196, 66], ["left", 276, 66], ["right", 220, 96]]) {
      mk(o, "div", null, { [side]: "-5px", top: px(top), width: "8px", height: px(len), borderRadius: "4px", background: mix(FRAME, "#FFFFFF", 0.3) });
    }
    mk(o, "div", null, {
      left: "0px", top: "0px", width: px(w), height: px(h), borderRadius: "58px", boxShadow: K.shadow(1.6),
      background: `linear-gradient(145deg, ${mix(FRAME, "#FFFFFF", 0.28)}, ${FRAME} 35%, ${FRAME} 75%, ${mix(FRAME, "#FFFFFF", 0.18)})`,
    });
    const screen = mk(o, "div", `${id}-screen`, { left: px(BEZ), top: px(BEZ), width: px(sw), height: px(sh), borderRadius: "48px", background: K.surface, overflow: "hidden" });
    mk(screen, "div", null, { left: px(sw / 2 - 50), top: "12px", width: "100px", height: "30px", borderRadius: "15px", background: "#0B0A0F" });
    ui(screen, `${id}-time`, "9:41", { k: "xs", left: 30, w: 80, cy: 28, bold: true, color: INK });
    const st = attrs(mk(screen, "svg:svg", null), { width: 78, height: 24, viewBox: "0 0 78 24" });
    Object.assign(st.style, { position: "absolute", left: px(sw - 104), top: "16px" });
    for (let i = 0; i < 4; i++) attrs(mk(st, "svg:rect", null), { x: i * 7, y: 16 - i * 4, width: 5, height: 6 + i * 4, rx: 1.2, fill: INK });
    attrs(mk(st, "svg:rect", null), { x: 36, y: 3, width: 34, height: 18, rx: 5, fill: "none", stroke: rgba(INK, 0.45), "stroke-width": 2 });
    attrs(mk(st, "svg:rect", null), { x: 39, y: 6, width: 24, height: 12, rx: 2.5, fill: INK });
    attrs(mk(st, "svg:rect", null), { x: 72, y: 9, width: 3, height: 6, rx: 1.5, fill: rgba(INK, 0.45) });
    mk(screen, "div", null, { left: px(sw / 2 - 60), top: px(sh - 18), width: "120px", height: "6px", borderRadius: "3px", background: rgba(INK, 0.85) });
    return { el: o, screen, sw, sh };
  }

  window.Design = {
    C, CX, CAP_MID, GRID, T, mk, attrs, svgAt, mix, pose, line, chip, stamp, wire, ring, logoSvg, num, bez, breath,
    text, tag, ICONS, ICON, FLOW_X, FLOW_TEXT, iconBox, lightBox, flowRow, flowLink, esc, winBar, terminal, mapPin,
    UI, ui, glyph, phone,
  };
})();
