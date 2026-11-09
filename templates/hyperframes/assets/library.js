/**
 * library.js: ready-made scenes for fast mode (skills/reel/SKILL.md "Fast mode"). starter.mjs writes a scene file that calls
 * Library.scene(kind, sceneId); its beats are the scene's @anchors from reel-data.js (each beat's quoted label and
 * spoken time), so re-timing the script (script.mjs time, then scaffold.mjs --sync) updates the scene without
 * rewriting it. A label's fields are split on "|"; a label may start with a lowercase slot name ("stamp: NOT
 * AVAILABLE") to fill that slot out of order, otherwise beats fill the kind's slots in order and missing slots are
 * simply not drawn. Kinds and their slots:
 *
 *   hook-app    question (LINE 1 | LINE 2) · page (url | HEADING | ITEM | ITEM SUB | BUTTON) · loader (TEXT)
 *               · stuck (HEADING | AMOUNT | STATUS | OPTION, OPTION, OPTION) · stamp (TEXT) · why (TEXT | TAG)
 *   big-number  big (VALUE | SUB) · stat (VALUE | CAPTION) · stat
 *   stack       title (TEXT) · layer (NAME | SUB | icon) ×4
 *   steps       title (WINDOW TITLE) · step (KEY | TEXT) ×6
 *   bottleneck  title (TEXT) · label (TEXT) · note (TEXT) · wait (TEXT)
 *   end         comment (SMALL | KEYWORD) · follow (the chrome's FOLLOW lockup takes over) · next (only as "next: TEXT | TEXT")
 *
 * Portrait layouts on the design kit (fast mode makes no 16:9 cut). Load after design.js.
 */
(function () {
  const K = window.ReelKit, G = window.Design, { REEL, F, prog, lerp, ease, rgba, clamp, hash } = K, C = G.C;
  const px = (v) => `${v}px`;
  const CX = G.CX, S = K.L.safe, MIDY = (S.top + S.bottom) / 2;

  const SLOTS = {
    "hook-app": ["question", "page", "loader", "stuck", "stamp", "why"],
    "big-number": ["big", "stat", "stat"],
    stack: ["title", "layer", "layer", "layer", "layer"],
    steps: ["title", "step", "step", "step", "step", "step", "step"],
    bottleneck: ["title", "label", "note", "wait"],
    end: ["comment", "follow", "next"],
  };

  /** Beats → { slot: [{ f, parts }] }: "slot: text" labels go to that slot, the rest fill free slots in order. */
  function assign(kind, beats) {
    const names = SLOTS[kind];
    if (!names) throw new Error(`Library: unknown kind "${kind}" (kinds: ${Object.keys(SLOTS).join(", ")})`);
    const filled = names.map(() => null), rest = [];
    for (const [label, t] of beats) {
      const m = /^([a-z]+):\s*([\s\S]*)$/.exec(label);
      const i = m ? names.findIndex((n, j) => n === m[1] && !filled[j]) : -1;
      const beat = { f: F(t), parts: (i >= 0 ? m[2] : label).split("|").map((s) => s.trim()) };
      if (i >= 0) filled[i] = beat;
      else rest.push(beat);
    }
    for (const b of rest) {
      const i = filled.indexOf(null);
      if (i < 0) throw new Error(`Library: "${kind}" takes at most ${names.length} beats (${names.join(", ")})`);
      filled[i] = b;
    }
    const out = {};
    names.forEach((n, i) => filled[i] && (out[n] = out[n] || []).push(filled[i]));
    return out;
  }

  let meas;
  /** Width in px of str at size in Reel Sans (or Reel Mono). */
  function measure(str, size, mono = false) {
    meas = meas || document.createElement("canvas").getContext("2d");
    meas.font = `${mono ? 700 : 800} ${size}px "Reel ${mono ? "Mono" : "Sans"}"`;
    return meas.measureText(str).width;
  }
  /** The largest size ≤ max at which str fits w px. */
  function fit(str, max, w, mono = false) {
    const width = measure(str, max, mono);
    return width <= w ? max : Math.max(18, Math.floor((max * w) / width));
  }
  /** A single text line sized to fit its width; o as Design.line, with size as the maximum. */
  const line = (parent, id, str, o) => G.line(parent, id, str, { ...o, size: fit(str, o.size, o.w, o.mono) });
  /** The card looks' highlighter stroke under a title. */
  const highlight = (el) => K.cards && Object.assign(el.style, { textDecorationLine: "underline", textDecorationColor: rgba(C.accent, 0.22), textDecorationThickness: "24px", textUnderlineOffset: "-18px", textDecorationSkipInk: "none" });
  const card = (parent, id, x, y, w, h, r = 30) => G.mk(parent, "div", id, {
    left: px(x - w / 2), top: px(y - h / 2), width: px(w), height: px(h), borderRadius: px(r), boxSizing: "border-box",
    border: K.edge(0.45), background: K.surface, boxShadow: K.shadow(), opacity: "0", transformOrigin: "50% 50%",
  });
  const group = (parent, id, ox, oy) => G.mk(parent, "div", id, { left: "0px", top: "0px", width: px(K.L.W), height: px(K.L.H), opacity: "0", transformOrigin: `${ox}px ${oy}px` });
  const show = (el, a) => (el.style.opacity = String(clamp(a)));

  /** A bare icon of size s centred on its pose. */
  function glyph(parent, id, icon, s) {
    const o = G.mk(parent, "div", id, { left: px(-s / 2), top: px(-s / 2), width: px(s), height: px(s) });
    const v = G.attrs(G.mk(o, "svg:svg", `${id}-svg`), { width: s, height: s, viewBox: "-60 -60 120 120" });
    (G.ICONS[icon] || G.ICONS.server)(G.mk(v, "svg:g", null));
    return o;
  }
  /** A loading spinner of radius r; set({ x, y, alpha, f, s }). */
  function spinner(parent, id, r) {
    const s = G.svgAt(parent, id, 0, 0, r + 10);
    G.attrs(G.mk(s, "svg:circle", null), { r, fill: "none", stroke: rgba(C.text, 0.2), "stroke-width": 10 });
    const arc = G.attrs(G.mk(s, "svg:path", null), { d: `M 0 ${-r} A ${r} ${r} 0 0 1 ${r} 0`, fill: "none", stroke: C.accent, "stroke-width": 10, "stroke-linecap": "round" });
    return {
      set({ x, y, alpha = 1, f = 0, s: sc = 1 }) {
        s.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
        s.style.opacity = String(clamp(alpha));
        arc.setAttribute("transform", `rotate(${((f * 14) % 360).toFixed(1)})`);
      },
    };
  }
  /** n dots in canvas pixels; set([{ x, y, a, r, col }]). */
  function dots(parent, id, n) {
    const s = G.svgAt(parent, id, CX, K.L.H / 2, Math.max(K.L.W, K.L.H) / 2);
    const cs = Array.from({ length: n }, (_, i) => G.attrs(G.mk(s, "svg:circle", `${id}-${i}`), { r: 10, fill: C.accent, opacity: 0 }));
    return {
      set(points) {
        cs.forEach((c, i) => {
          const p = points[i];
          if (!p || p.a <= 0) return c.setAttribute("opacity", "0");
          G.attrs(c, { cx: (p.x - CX).toFixed(1), cy: (p.y - K.L.H / 2).toFixed(1), r: (p.r ?? 10).toFixed(1), opacity: clamp(p.a).toFixed(3), fill: p.col ?? C.accent });
        });
      },
    };
  }
  /** A number whose digits roll into place (other characters stay put); set(p 0–1, alpha). */
  function odometer(parent, id, str, { x, cy, size, color = C.white }) {
    const cw = size * 0.6, w = cw * str.length, top0 = cy - K.CAP_MID.mono * size, pad = size * 0.03;
    const box = G.mk(parent, "div", id, { left: px(x - w / 2), top: px(top0 - pad), width: px(w), height: px(size + 2 * pad), overflow: "hidden", opacity: "0" });
    const cols = [...str].map((ch, i) => {
      const digit = /\d/.test(ch);
      const col = G.mk(box, "div", `${id}-c${i}`, { left: px(i * cw), top: px(pad), width: px(cw), textAlign: "center", fontFamily: '"Reel Mono", monospace', fontWeight: "700", fontSize: px(size), lineHeight: "1", whiteSpace: "pre", color });
      col.textContent = digit ? "0123456789".split("").join("\n") : ch;
      return { col, d: digit ? +ch : null };
    });
    return {
      set(p, a = 1) {
        box.style.opacity = String(clamp(a));
        cols.forEach(({ col, d }, i) => d != null && (col.style.transform = `translateY(${(-ease.outCubic(clamp((p - (0.35 * i) / cols.length) / 0.65)) * d * size).toFixed(2)}px)`));
      },
    };
  }

  const KINDS = {};

  /** The hook: a question bubble, then the app's own page, its loader, a stuck screen, a stamp and a big WHY. */
  KINDS["hook-app"] = ({ root, slots: s, START, NEXT, id }) => {
    const [q, page, load, stuck, stamp, why] = ["question", "page", "loader", "stuck", "stamp", "why"].map((n) => s[n]?.[0]);
    const CLEAR = why ? why.f - 8 : Infinity;
    const BY = MIDY - 100;
    let bubble, badge, q1, q2;
    if (q) {
      bubble = card(root, `${id}-bubble`, CX, BY, 900, 280, 40);
      G.mk(bubble, "div", `${id}-tail`, { left: "130px", bottom: "-22px", width: "40px", height: "40px", background: K.surface, borderRight: K.edge(0.45), borderBottom: K.edge(0.45), transform: "rotate(45deg)" });
      badge = G.mk(root, "div", `${id}-badge`, { left: px(CX - 330 - 70), top: px(BY - 70), width: "140px", height: "140px", borderRadius: "50%", background: C.accent, boxShadow: K.shadow(0.6), opacity: "0" });
      show(G.line(badge, `${id}-badge-q`, "?", { x: 70, cy: 70, size: 100, color: K.onAccent, w: 140 }), 1);
      const two = q.parts.length > 1;
      q1 = line(root, `${id}-q1`, q.parts[0], { x: CX - 230 + 330, cy: two ? BY - 42 : BY, size: G.T.title.size, w: 660, align: "left" });
      if (two) highlight((q2 = line(root, `${id}-q2`, q.parts[1], { x: CX - 230 + 330, cy: BY + 46, size: G.T.title.size, w: 660, align: "left", color: C.accent })));
    }

    const WW = 900, WH = 780, WX = CX - WW / 2, WY = MIDY - WH / 2 - 40;
    let win, p1, p2, veil, modal, spin, wait, bar;
    if (page || stuck) {
      win = G.mk(root, "div", `${id}-win`, { left: px(WX), top: px(WY), width: px(WW), height: px(WH), borderRadius: "30px", boxSizing: "border-box", overflow: "hidden", border: K.edge(0.45), background: K.surface, boxShadow: K.shadow(), opacity: "0", transformOrigin: "50% 50%" });
      G.winBar(win, `${id}-win`, page ? page.parts[0] : "");
      const pane = (pid) => G.mk(win, "div", pid, { left: "0px", top: "60px", width: px(WW), height: px(WH - 60) });
      if (page) {
        const [, heading, item, itemSub, button = "CONTINUE"] = page.parts;
        p1 = pane(`${id}-p1`);
        if (heading) show(line(p1, `${id}-p1-h`, heading, { x: 44 + 400, cy: 64, size: G.T.label.size, w: 800, align: "left" }), 1);
        if (item) {
          G.mk(p1, "div", `${id}-p1-row`, { left: "36px", top: "124px", width: px(WW - 72), height: "200px", borderRadius: "22px", boxSizing: "border-box", border: K.edge(0.3), background: rgba(C.accent, 0.04) });
          show(line(p1, `${id}-p1-item`, item, { x: 72 + 380, cy: itemSub ? 196 : 224, size: G.T.label.size, w: 760, align: "left" }), 1);
          if (itemSub) show(line(p1, `${id}-p1-sub`, itemSub, { x: 72 + 380, cy: 256, size: G.T.chip.size, mono: true, w: 760, align: "left", color: C.accent }), 1);
        }
        const btn = G.mk(p1, "div", `${id}-p1-btn`, { left: "36px", top: "370px", width: px(WW - 72), height: "96px", borderRadius: "48px", background: C.accent, boxShadow: K.shadow(0.4) });
        show(line(btn, `${id}-p1-btnt`, button, { x: (WW - 72) / 2, cy: 48, size: G.T.label.size, w: 700, color: K.onAccent }), 1);
        [[520, 560], [574, 420], [640, 760]].forEach(([y, w], i) => G.mk(p1, "div", `${id}-p1-sk${i}`, { left: "36px", top: px(y), width: px(w), height: "30px", borderRadius: "15px", background: rgba(C.text, 0.08) }));
        veil = G.mk(win, "div", `${id}-veil`, { left: "0px", top: "60px", width: px(WW), height: px(WH - 60), background: rgba(C.text, 0.18), opacity: "0" });
        modal = card(win, `${id}-modal`, WW / 2, 430, 440, 280, 28);
        spin = spinner(win, `${id}-spin`, 56);
        wait = line(win, `${id}-wait`, (load && load.parts[0]) || "PLEASE WAIT…", { x: WW / 2, cy: 520, size: G.T.chip.size, mono: true, w: 400, color: C.text });
      }
      if (stuck) {
        const [heading = "", amount = "", status = "PROCESSING…", options = ""] = stuck.parts;
        const opts = options.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 3);
        p2 = pane(`${id}-p2`);
        if (heading) show(line(p2, `${id}-p2-h`, heading, { x: 44 + 260, cy: 64, size: G.T.label.size, w: 520, align: "left" }), 1);
        if (amount) show(line(p2, `${id}-p2-amt`, amount, { x: WW - 44 - 170, cy: 64, size: G.T.title.size, w: 340, align: "right", color: C.accent }), 1);
        opts.forEach((o, i) => {
          const y = 140 + i * 96, on = i === 0;
          G.mk(p2, "div", `${id}-p2-o${i}`, { left: "36px", top: px(y), width: px(WW - 72), height: "80px", borderRadius: "20px", boxSizing: "border-box", border: on ? K.edge(1) : K.edge(0.3), background: on ? rgba(C.accent, 0.06) : "transparent" });
          G.mk(p2, "div", `${id}-p2-r${i}`, { left: "72px", top: px(y + 24), width: "32px", height: "32px", borderRadius: "50%", boxSizing: "border-box", border: `4px solid ${on ? C.accent : rgba(C.text, 0.35)}`, background: on ? `radial-gradient(${C.accent} 40%, transparent 44%)` : "transparent" });
          show(line(p2, `${id}-p2-t${i}`, o, { x: 128 + 300, cy: y + 40, size: G.T.label.size, w: 600, align: "left" }), 1);
        });
        const sy = 140 + opts.length * 96 + 40;
        show(line(p2, `${id}-p2-st`, status, { x: 44 + 400, cy: sy, size: G.T.chip.size, mono: true, w: 800, align: "left" }), 1);
        const back = G.mk(p2, "div", `${id}-p2-bar`, { left: "44px", top: px(sy + 38), width: px(WW - 88), height: "26px", borderRadius: "13px", background: rgba(C.text, 0.1), overflow: "hidden" });
        bar = G.mk(back, "div", `${id}-p2-fill`, { left: "0px", top: "0px", width: "100%", height: "100%", borderRadius: "13px", background: C.accent, transformOrigin: "0 50%", transform: "scaleX(0)" });
      }
    }
    let stampEl;
    if (stamp) {
      stampEl = G.stamp(root, `${id}-stamp`, stamp.parts[0], { cy: win ? MIDY - 40 : BY, w: 760, color: C.white });
      Object.assign(stampEl.style, { background: K.surface, boxShadow: K.shadow(0.6) });
    }
    let whyEl, whyTag;
    if (why) {
      whyEl = line(root, `${id}-why`, why.parts[0], { cy: MIDY - 40, size: 140, w: 940, color: C.accent });
      if (why.parts[1]) whyTag = G.tag(root, `${id}-whytag`, why.parts[1], { x: CX, y: MIDY + 70, color: C.white, border: C.accent });
    }

    return (f) => {
      const clear = 1 - prog(f, CLEAR, 8), lift = -30 * prog(f, CLEAR, 8, ease.inQuad);
      const winAt = page ? page.f : stuck ? stuck.f : Infinity;
      if (q) {
        const qOut = prog(f, winAt - 6, 8, ease.inQuad), qA = (1 - qOut) * clear, qY = -50 * qOut + lift;
        G.pose(bubble, 0, qY + 30 * (1 - prog(f, q.f, 10, ease.expoOut)), lerp(0.9, 1, prog(f, q.f, 10, ease.backOut)), 0, prog(f, q.f, 6) * qA);
        const wob = prog(f, q.f + 30, 4) * Math.sin(prog(f, q.f + 30, 14) * Math.PI * 3) * (1 - prog(f, q.f + 30, 14));
        G.pose(badge, 0, qY, lerp(0.3, 1, prog(f, q.f + 2, 10, ease.backOut)) * (1 + 0.12 * Math.abs(wob)), 16 * wob, prog(f, q.f + 2, 6) * qA);
        G.pose(q1, 0, qY, 1, 0, prog(f, q.f + 4, 3) * qA);
        q1.style.clipPath = `inset(0 ${(100 * (1 - prog(f, q.f + 4, 12, ease.outCubic))).toFixed(1)}% 0 0)`;
        if (q2) {
          G.pose(q2, 0, qY, 1, 0, prog(f, q.f + 18, 3) * qA);
          q2.style.clipPath = `inset(0 ${(100 * (1 - prog(f, q.f + 18, 12, ease.outCubic))).toFixed(1)}% -20px 0)`;
        }
      }
      if (win) {
        const wIn = prog(f, winAt - 2, 12, ease.expoOut);
        G.pose(win, 0, lift + 60 * (1 - wIn), lerp(0.94, 1, wIn), 0, prog(f, winAt - 2, 6) * clear);
        const toStuck = stuck && page ? prog(f, stuck.f, 8, ease.outCubic) : stuck ? 1 : 0;
        if (p1) {
          G.pose(p1, -80 * toStuck, 0, 1, 0, 1 - toStuck);
          const busy = (load ? prog(f, load.f, 6) : 0) * (1 - toStuck);
          show(veil, busy);
          G.pose(modal, 0, load ? 20 * (1 - prog(f, load.f, 8, ease.expoOut)) : 0, load ? lerp(0.92, 1, prog(f, load.f, 8, ease.backOut)) : 1, 0, busy);
          spin.set({ x: WW / 2, y: 400, alpha: busy, f, s: load ? lerp(0.6, 1, prog(f, load.f, 8, ease.backOut)) : 1 });
          G.pose(wait, 0, 0, 1, 0, busy);
        }
        if (p2) {
          G.pose(p2, 80 * (1 - toStuck), 0, 1, 0, toStuck * (stamp ? 1 - 0.5 * prog(f, stamp.f, 6) : 1));
          const fill = 0.72 * prog(f, stuck.f + 4, 24, ease.outCubic) + (f > stuck.f + 28 ? 0.012 * Math.sin(f * 0.9) : 0);
          bar.style.transform = `scaleX(${fill.toFixed(4)})`;
        }
      }
      if (stampEl) G.pose(stampEl, 0, lift, lerp(1.6, 1, prog(f, stamp.f, 8, ease.backOut)), -8, prog(f, stamp.f, 4) * clear);
      if (whyEl) {
        const out = 1 - prog(f, NEXT - 4, 10);
        G.pose(whyEl, 0, 0, lerp(1.3, 1, prog(f, why.f, 10, ease.expoOut)), 0, prog(f, why.f, 6) * out);
        if (whyTag) G.pose(whyTag, 0, 14 * (1 - prog(f, why.f + 9, 8, ease.expoOut)), 1, 0, prog(f, why.f + 9, 6) * out);
      }
    };
  };

  /** One headline number alone at hero size, then it settles to the top as up to two counter cards roll in. */
  KINDS["big-number"] = ({ root, slots: s, NEXT, id }) => {
    const big = s.big?.[0], stats = s.stat || [];
    const TY = S.top + 75, ROWS = [TY + 265, TY + 505];
    let grp;
    if (big) {
      grp = group(root, `${id}-big`, CX, TY);
      const c = card(grp, `${id}-big-card`, CX, TY, 760, 210);
      c.style.opacity = "1";
      const sub = big.parts[1];
      show(line(grp, `${id}-big-v`, big.parts[0], { cy: sub ? TY - 22 : TY, size: 104, mono: true, w: 680, color: C.accent }), 1);
      if (sub) show(line(grp, `${id}-big-s`, sub, { cy: TY + 62, size: G.T.chip.size, mono: true, w: 680, color: C.text }), 1);
    }
    const cards = stats.slice(0, 2).map((st, i) => {
      const y = ROWS[i], c = card(root, `${id}-st${i}`, CX, y, 760, 200);
      const v = st.parts[0], size = fit(v, G.T.hero.size, 680, true);
      return { st, c, y, num: odometer(root, `${id}-st${i}-v`, v, { x: CX, cy: y - 25, size, color: i ? C.accent : C.white }), cap: st.parts[1] ? line(root, `${id}-st${i}-c`, st.parts[1], { cy: y + 55, size: G.T.label.size, w: 680, color: C.accent }) : null };
    });
    return (f) => {
      const out = 1 - prog(f, NEXT - 4, 10);
      if (grp) {
        const settle = stats.length ? prog(f, stats[0].f - 8, 12, ease.inOutCubic) : 0;
        G.pose(grp, 0, (MIDY - 120 - TY) * (1 - settle), lerp(1.35, 1, settle) * lerp(0.8, 1, prog(f, big.f, 8, ease.backOut)), 0, prog(f, big.f, 5) * out);
      }
      cards.forEach(({ st, c, num, cap }) => {
        const dy = 30 * (1 - prog(f, st.f - 4, 12, ease.expoOut)), a = prog(f, st.f - 4, 6) * out;
        G.pose(c, 0, dy, 1, 0, a);
        num.set(prog(f, st.f, 30), a);
        if (cap) G.pose(cap, 0, dy, 1, 0, a);
      });
    };
  };

  /** A layered stack: each layer band drops in and lights on its beat while dots flow down to it. */
  KINDS.stack = ({ root, slots: s, START, NEXT, id }) => {
    const title = s.title?.[0], layers = (s.layer || []).slice(0, 4), ICONS = ["globe", "server", "router", "db"];
    const ROWS = G.GRID.rows, BW = 880, BH = 132;
    const flow = dots(root, `${id}-flow`, 10);
    const arrows = G.svgAt(root, `${id}-arrows`, CX, K.L.H / 2, K.L.H / 2);
    const links = layers.slice(1).map((_, i) => G.wire(arrows, `${id}-link${i}`, `M 0 ${ROWS[i] + BH / 2 + 6 - K.L.H / 2} V ${ROWS[i + 1] - BH / 2 - 10 - K.L.H / 2}`, { stroke: rgba(C.accent, 0.7), width: 5 }));
    let titleEl;
    if (title) highlight((titleEl = line(root, `${id}-title`, title.parts[0], { cy: G.GRID.title, size: G.T.title.size, w: 940 })));
    const bands = layers.map((L, i) => {
      const y = ROWS[i], o = card(root, `${id}-band${i}`, CX, y, BW, BH, 30);
      const g = glyph(o, `${id}-band${i}-g`, L.parts[2] || ICONS[i], 84);
      G.pose(g, 28 + 42, BH / 2);
      const two = !!L.parts[1];
      show(line(o, `${id}-band${i}-n`, L.parts[0], { x: 140 + (BW - 180) / 2, cy: two ? BH / 2 - 20 : BH / 2, size: G.T.label.size, w: BW - 180, align: "left" }), 1);
      if (two) show(line(o, `${id}-band${i}-s`, L.parts[1], { x: 140 + (BW - 180) / 2, cy: BH / 2 + 30, size: G.T.chip.size, mono: true, w: BW - 180, align: "left", color: C.accent }), 1);
      return { L, o, y };
    });
    return (f) => {
      const out = 1 - prog(f, NEXT - 4, 10);
      if (titleEl) G.pose(titleEl, 0, 16 * (1 - prog(f, title.f, 8, ease.expoOut)), 1, 0, prog(f, title.f, 6) * out);
      let cur = -1;
      bands.forEach(({ L, o }, i) => {
        if (f >= L.f) cur = i;
        const pop = prog(f, L.f - 2, 10, ease.expoOut), nextF = bands[i + 1] ? bands[i + 1].L.f : Infinity;
        const act = prog(f, L.f, 6) * (1 - prog(f, nextF, 8));
        G.pose(o, 0, 40 * (1 - pop), lerp(0.94, 1, pop), 0, prog(f, L.f - 2, 6) * out);
        o.style.borderColor = K.lit(act, 0.45);
        o.style.boxShadow = `${K.shadow(0.8)}, 0 0 ${(40 * act).toFixed(1)}px ${rgba(C.accent, 0.4 * act)}`;
      });
      links.forEach((w, i) => w.set(prog(f, bands[i + 1].L.f - 4, 10, ease.outCubic), out));
      const bottom = cur >= 0 ? bands[cur].y : 0;
      flow.set(Array.from({ length: 10 }, (_, i) => {
        if (cur < 0) return null;
        const per = 36, q = (((f - bands[0].L.f + (i * per) / 10) % per) + per) % per / per;
        return { x: CX + (hash(i, 5) - 0.5) * 600 * (1 - q), y: lerp(ROWS[0] - 110, bottom, q), a: Math.sin(Math.PI * q) * 0.8 * out, r: 9 };
      }));
    };
  };

  /** Steps in a window: each step's row wipes in on its beat and gets a check when the next one starts. */
  KINDS.steps = ({ root, slots: s, START, NEXT, id }) => {
    const title = s.title?.[0], steps = (s.step || []).slice(0, 6);
    const W = 940, LH = 84, H = 110 + steps.length * LH, X0 = CX - W / 2, Y0 = MIDY - H / 2 - 30;
    const at = title ? title.f : steps.length ? steps[0].f - 6 : START + 4;
    const win = G.mk(root, "div", `${id}-win`, { left: px(X0), top: px(Y0), width: px(W), height: px(H), borderRadius: "26px", boxSizing: "border-box", overflow: "hidden", border: K.edge(0.6), background: K.surface, boxShadow: K.shadow(), opacity: "0", transformOrigin: "50% 50%" });
    G.winBar(win, `${id}-win`, title ? title.parts[0] : "");
    const keyW = Math.max(...steps.map((st) => st.parts.length > 1 ? st.parts[0].length : 0), 0) * G.T.chip.size * 0.6 + (steps.some((st) => st.parts.length > 1) ? 28 : 0);
    const hi = G.mk(win, "div", `${id}-hi`, { left: "16px", top: "0px", width: px(W - 32), height: px(LH - 12), borderRadius: "14px", background: rgba(C.accent, 0.08), opacity: "0" });
    const rows = steps.map((st, i) => {
      const cy = 96 + i * LH + LH / 2 - 6;
      const row = G.mk(win, "div", `${id}-row${i}`, { left: "0px", top: "0px", width: px(W), height: px(H), clipPath: "inset(0 100% 0 0)" });
      const two = st.parts.length > 1;
      if (two) show(line(row, `${id}-row${i}-k`, st.parts[0], { x: 44 + keyW / 2, cy, size: G.T.chip.size, mono: true, w: keyW, align: "left", color: C.accent }), 1);
      show(line(row, `${id}-row${i}-t`, two ? st.parts[1] : st.parts[0], { x: 44 + keyW + (W - 140 - keyW) / 2, cy, size: 36, w: W - 140 - keyW, align: "left" }), 1);
      const tick = G.mk(win, "div", `${id}-row${i}-ok`, { left: px(W - 72), top: px(cy - 18), width: "36px", height: "36px", borderRadius: "50%", background: C.success, opacity: "0" });
      G.attrs(G.mk(G.attrs(G.mk(tick, "svg:svg", null), { width: 36, height: 36, viewBox: "0 0 36 36" }), "svg:path", null), { d: "M 10 18 L 16 24 L 27 12", fill: "none", stroke: K.surface, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" });
      return { st, row, tick, cy };
    });
    return (f) => {
      const out = 1 - prog(f, NEXT - 4, 10), wIn = prog(f, at, 12, ease.expoOut);
      G.pose(win, 0, 40 * (1 - wIn), lerp(0.94, 1, wIn), 0, prog(f, at, 6) * out);
      let cur = -1;
      rows.forEach(({ st, row, tick }, i) => {
        if (f >= st.f) cur = i;
        row.style.clipPath = `inset(0 ${(100 * (1 - prog(f, st.f, 10, ease.outCubic))).toFixed(1)}% 0 0)`;
        const done = rows[i + 1] ? prog(f, rows[i + 1].st.f, 6) : prog(f, NEXT - 16, 6);
        G.pose(tick, 0, 0, lerp(0.5, 1, done), 0, done);
      });
      show(hi, cur >= 0 ? 1 : 0);
      if (cur >= 0) {
        const from = cur > 0 ? rows[cur - 1].cy : rows[0].cy, to = rows[cur].cy, k = prog(f, rows[cur].st.f, 8, ease.outCubic);
        hi.style.transform = `translateY(${(lerp(from, to, k) - (LH - 12) / 2).toFixed(1)}px)`;
      }
    };
  };

  /** A funnel that fills with requests and lets one at a time through the lock at its neck. */
  KINDS.bottleneck = ({ root, slots: s, START, NEXT, id }) => {
    const [title, label, note, wait] = ["title", "label", "note", "wait"].map((n) => s[n]?.[0]);
    const TOP = 600, NECK = 900, hw = (y) => 40 + (NECK - y) * (320 / (NECK - TOP));
    const fun = G.svgAt(root, `${id}-funnel`, CX, K.L.H / 2, K.L.H / 2), oy = K.L.H / 2;
    const fill = G.attrs(G.mk(fun, "svg:path", `${id}-fill`), { d: `M -360 ${TOP - oy} L 360 ${TOP - oy} L 40 ${NECK - oy} L 40 ${NECK + 60 - oy} L -40 ${NECK + 60 - oy} L -40 ${NECK - oy} Z`, fill: rgba(C.accent, 0.07), opacity: 0 });
    const sideL = G.wire(fun, `${id}-l`, `M -360 ${TOP - oy} L -40 ${NECK - oy} L -40 ${NECK + 60 - oy}`, { stroke: rgba(C.accent, 0.7), width: 6 });
    const sideR = G.wire(fun, `${id}-r`, `M 360 ${TOP - oy} L 40 ${NECK - oy} L 40 ${NECK + 60 - oy}`, { stroke: rgba(C.accent, 0.7), width: 6 });
    const lock = G.iconBox(root, `${id}-lock`, "lock", { x: CX, y: NECK + 140 });
    const SLOT = [];
    for (let r = 0; r < 7; r++) {
      const y = NECK - 22 - r * 30, n = Math.floor((2 * hw(y) - 24) / 30);
      for (let c = 0; c < n; c++) SLOT.push({ x: CX + (c - (n - 1) / 2) * 30, y });
    }
    const pile = dots(root, `${id}-pile`, SLOT.length + 1);
    let titleEl, labelEl, noteEl, waitEl, spin;
    if (title) highlight((titleEl = line(root, `${id}-title`, title.parts[0], { cy: G.GRID.title, size: G.T.title.size, w: 940 })));
    if (label) labelEl = G.chip(root, `${id}-label`, label.parts[0], { x: CX, y: NECK + 290, size: 40, w: Math.min(940, Math.ceil(measure(label.parts[0], 40)) + 80), h: 68, color: C.accent, border: C.accent });
    if (note) noteEl = G.tag(root, `${id}-note`, note.parts[0], { x: CX, y: S.bottom - 40, color: C.white, border: C.accent });
    if (wait) {
      spin = spinner(root, `${id}-spin`, 40);
      waitEl = line(root, `${id}-wait`, wait.parts[0], { x: CX + 310, cy: NECK + 220, size: G.T.chip.size, mono: true, w: 300, color: C.accent });
    }
    const go = title ? title.f : START + 4, FILL0 = go + 6, FILL1 = Math.max(FILL0 + 12, NEXT - 12);
    return (f) => {
      const out = 1 - prog(f, NEXT - 4, 10), a = prog(f, go, 8) * out;
      if (titleEl) G.pose(titleEl, 0, 16 * (1 - prog(f, go, 8, ease.expoOut)), 1, 0, a);
      sideL.set(prog(f, go, 12, ease.outCubic), a);
      sideR.set(prog(f, go, 12, ease.outCubic), a);
      fill.setAttribute("opacity", a.toFixed(3));
      G.pose(lock, 0, 0, lerp(0.4, 1, prog(f, FILL0, 10, ease.backOut)) * (1 + 0.05 * G.breath(f)), 0, prog(f, FILL0, 6) * out);
      lock.style.borderColor = K.lit(prog(f, FILL0 + 6, 8), 0.5);
      const pts = SLOT.map((p, i) => {
        const land = FILL0 + (i / SLOT.length) * (FILL1 - FILL0), q = prog(f, land - 10, 10, ease.inQuad);
        return { x: lerp(p.x + (hash(i, 21) - 0.5) * 160, p.x, q), y: lerp(TOP - 40, p.y, q), a: prog(f, land - 10, 3) * out, r: 11 };
      });
      const slip = (((f - FILL0) % 14) + 14) % 14 / 14;
      pts.push(f >= FILL0 + 6 ? { x: CX, y: lerp(NECK - 10, NECK + 140, slip), a: Math.min(1, 6 * (1 - slip)) * out, r: 11, col: C.success } : null);
      pile.set(pts);
      if (labelEl) G.pose(labelEl, 0, 0, lerp(0.9, 1, prog(f, label.f, 10, ease.backOut)), 0, prog(f, label.f, 6) * out);
      if (noteEl) G.pose(noteEl, 0, 14 * (1 - prog(f, note.f, 8, ease.expoOut)), 1, 0, prog(f, note.f, 6) * out);
      if (wait) {
        spin.set({ x: CX + 310, y: NECK + 140, alpha: prog(f, wait.f, 6) * out, f, s: lerp(0.7, 1, prog(f, wait.f, 10, ease.backOut)) });
        G.pose(waitEl, 0, 0, 1, 0, prog(f, wait.f + 3, 6) * out);
      }
    };
  };

  /** The end card: the comment keyword, an optional next card, then it clears for the chrome's FOLLOW lockup. */
  KINDS.end = ({ root, slots: s, START, NEXT, id }) => {
    const [comment, next, follow] = ["comment", "next", "follow"].map((n) => s[n]?.[0]);
    const CLEAR = follow ? follow.f - 6 : Infinity, CY = MIDY - 160;
    let c, small, key, nextEl, chat;
    if (comment) {
      const [a, b] = comment.parts.length > 1 ? comment.parts : ["COMMENT", comment.parts[0]];
      c = card(root, `${id}-card`, CX, CY, 760, 280, 34);
      chat = glyph(root, `${id}-chat`, "chat", 84);
      small = line(root, `${id}-small`, a, { cy: CY - 62, size: G.T.label.size, w: 600 });
      key = line(root, `${id}-key`, b, { cy: CY + 40, size: 120, mono: true, w: 680, color: C.accent });
    }
    if (next) nextEl = G.tag(root, `${id}-next`, next.parts.join(" → "), { x: CX, y: CY + 230, color: C.white, border: C.accent });
    return (f) => {
      const clear = (1 - prog(f, CLEAR, 8)) * (1 - prog(f, NEXT - 4, 10));
      if (c) {
        const pop = prog(f, comment.f, 10, ease.backOut), a = prog(f, comment.f, 6) * clear;
        G.pose(c, 0, 0, lerp(0.85, 1, pop), 0, a);
        G.pose(chat, CX - 330, CY - 100, lerp(0.4, 1, prog(f, comment.f + 4, 10, ease.backOut)), -8, a);
        G.pose(small, 0, 0, 1, 0, a);
        G.pose(key, 0, 0, lerp(1.3, 1, prog(f, comment.f + 3, 10, ease.expoOut)), 0, prog(f, comment.f + 3, 6) * clear);
      }
      if (nextEl) G.pose(nextEl, 0, 14 * (1 - prog(f, next.f, 8, ease.expoOut)), 1, 0, prog(f, next.f, 6) * clear);
    };
  };

  /** Builds one library scene into compositions/scene-<id>.html's camera div and drives it; beats default to the scene's anchors. */
  function scene(kind, sceneId, beats = REEL.anchors.filter((a) => a.scene === sceneId).map((a) => [a.label ?? a.token.toUpperCase(), a.t])) {
    const comp = `scene-${sceneId}`, cam = document.getElementById(`${comp}-cam`);
    const sc = K.scene(sceneId), i = REEL.scenes.indexOf(sc), next = REEL.scenes[i + 1];
    const START = F(sc.start), NEXT = next ? F(next.start) : REEL.frames, END = next ? NEXT + 10 : REEL.frames;
    const slots = assign(kind, beats);
    K.fonts(() => {
      const root = G.mk(cam, "div", `${comp}-lib`, { left: "0px", top: "0px", width: px(K.L.W), height: px(K.L.H) });
      const render = KINDS[kind]({ root, slots, START, NEXT, END, id: sceneId });
      K.drive(comp, (END - START) / K.FPS, (t) => {
        const f = START + Math.round(t * K.FPS);
        K.applyCam(cam, f / K.FPS);
        render(f);
      });
    });
  }

  window.Library = { scene, SLOTS };
})();
