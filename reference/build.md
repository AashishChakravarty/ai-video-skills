# Build the reel (stage 5) and the 16:9 cut

Contents: 1 Creative direction · 2 Per-version workflow · 3 Several versions · 4 Layout and legibility ·
5 Timing and anchors · 6 direction.js · 7 3D clips · 8 Motion lessons · 9 Review checklist · 10 Gate 3 ·
11 16:9 cut · 12 Troubleshooting

Engine: **HyperFrames is the master timeline and final render** (HTML + GSAP, seekable, deterministic);
**Remotion renders 3D shots as transparent clips** placed inside it. Load the `/hyperframes` skill before
writing compositions — it carries the framework contract this guide assumes.

## 1. Creative direction

Build one version, `build/a`, in the **Living Diagram** direction unless the user asked for more than one.
Before building, write `build/a/DIRECTION.md` (10–20 lines) applying it to this topic: the hero object, how
the hook lands, the hand-off object between every pair of scenes, what the dot field does, and the sound
palette. Set `reel.json → versions.a.direction` to `"Living Diagram"`.

**Living Diagram**: a whiteboard diagram that draws itself and comes alive, like the topic's docs diagram
brought to life.

- **Hero object**: one flat, glowing shape in the accent colour (e.g. a ring-orb with a mono state chip
  inside) stays on screen and changes role scene to scene; around it everything is clean vector lines,
  arrows, chips and mono code labels.
- **Hook**: a huge card (code, a number, a claim) legible by 0.4 s gets challenged (a stamp slams with a
  camera hit, a counter keeps rolling), a one-word question flashes huge, and the card collapses into the
  hero object as its name is spoken.
- **Motion**: one continuous camera; the diagram keeps building in the same space. Strokes draw on
  (stroke-dashoffset), springy pops (back.out), objects fly on curved paths, kinetic mono type. Hero words
  ≥ 140 px, code labels ≥ 56 px.
- **3D**: none. Pure 2D (SVG/CSS) so it reads like a diagram.
- **Hand-offs**: the hero object carries every cut: it swallows the hook card, slides aside and shrinks to
  a halo, becomes one dot among many when the camera pulls back, and re-forms for the CTA, dropping the
  recap chips.
- **Field**: the dot field is a character: it drifts toward the hero when things fly (`streams`), breathes
  during loops, swarms or multiplies for scale moments and collapses back for the CTA.
- **Sound**: soft pad bed; pen-scribble or whoosh on strokes, light clicks on counter ticks, whooshes on
  flights, a bass impact on the one or two big reveals, a riser into the biggest number.

Put the hero object, its resting poses and shared clocks in `build/a/assets/diagram.js` as pure functions
of the frame, so neighbouring scenes draw the same object on the same frame and hand-offs line up exactly.

### More than one version (only when asked)

When the user asks for versions, options or a comparison, build that many (usually two: A in Living
Diagram, B in something clearly different). All use the same script, voice, words and chrome; they differ
in **concept**, so the user chooses between real ideas, not polish levels. Write a DIRECTION.md for each
(also naming which shots are 3D). Contrasts that work:

- **Cinematic 3D**: one hero 3D object per scene (Remotion, §7), camera moves, fewer words on screen.
- **Kinetic type**: huge single words slamming on the beats, punchy cuts.

Other axes: metaphor (traffic vs beehive), pacing (punchy cuts vs one continuous camera), type (huge single
words vs labelled diagrams). Set each `reel.json → versions.<v>.direction` to a 1–3 word name; compare.mjs
uses it as the label. If the user asks for another version after seeing A, build B the same way and compare.

## 2. Per-version workflow

```bash
S=~/.claude/skills/ai-video-skills/scripts
node $S/scaffold.mjs a                         # build/a from templates/hyperframes, data from words/anchors
node $S/starter.mjs a                          # optional: a starter scene per script scene + cues.json, renderable at once
# edit build/a/assets/direction.js             camera hits/pushes/punches, field events, ticker, CTA flight
# write build/a/compositions/<scene>.html      copy compositions/scene-template.html, one per script scene
# add each scene host to build/a/index.html at <!-- @scenes -->
# optional 3D: cp -r ~/.claude/skills/ai-video-skills/templates/remotion build/a/remotion  (see §7)
# write build/a/cues.json                      SFX on beats (format in scripts/mix.mjs header)
node $S/mix.mjs a                              # → build/a/assets/mix.wav at −14 LUFS
node $S/render.mjs a                           # check → render → out/a.mp4 + out/a-contact.png
```

Shared layers (`bg`, `chrome`, `captions`, `assets/reel-kit.js`) are generic — steer them through
direction.js rather than editing them, so fixes to the template keep applying. After a voice re-take and
re-align, `node $S/scaffold.mjs a --sync` refreshes the data and durations without touching scenes.

## 3. Several versions: parallel build agents

Only when building more than one version: build them at the same time with one subagent per version
(Agent tool, run in the background). Give each:
the reel folder, its version letter, its DIRECTION.md, this file, `script.timed.md`, and the rules:
only write inside `build/<v>/` and `out/<v>*`; never edit words.json, anchors.json, reel-data.js or the
other version; load `/hyperframes` first (and `/remotion-best-practices` for 3D); finish with
`render.mjs <v>` and report the check result, the probe line and the contact-sheet path. Review every
contact sheet yourself before showing the user (§9), and fix once if needed.

## 4. Layout and legibility (phone-first)

`ReelKit.L` holds the layout for the format; read positions from it instead of hard-coding.

| Portrait 1080×1920 | y range | Notes |
|---|---|---|
| Header (logo, wordmark, handle) | 0–210 | ticker below it from scene 2: 210–302 |
| **Scene content** | 320–1340 | key text inside x 60–1020 |
| Captions band | 1373–1488 | scene text never enters it |
| Progress bar | 1538 | |
| Follow footer | 1580–1676 | platform UI also covers this zone — nothing important below 1540 except the CTA |

Landscape 1920×1080: header 0–130 with the FOLLOW pill on the right, ticker 126–194, scene content
y 220–850 × x 120–1800, captions 880–980, progress 1050.

Fonts: `Reel Sans` and `Reel Mono` load `assets/fonts/reel-sans.ttf` / `reel-mono.ttf`, which scaffold copies from the
config's `fonts.sans` / `fonts.mono` (default Noto Sans Devanagari 800, covering Latin + Devanagari, and JetBrains
Mono 700). Sizes: body text ≥ 56 px,
hero text ≥ 140 px, labels ≥ 44 px, captions 56 px. Declare the `@font-face` rules in every composition
that uses them (the linter checks per file). Contrast ≥ 4.5:1 — the accent from logo.mjs already is.

## 5. Timing and anchors

- `script.timed.md` lists every beat with its spoken time; `frame = round(t × 30)`.
- In compositions use `K.anchor("scene", "token")` (and `A(...)` in direction.js) instead of pasting
  numbers: if the voice is re-made, `script.mjs time` + `scaffold --sync` move every beat for free.
  `K.wordAt("crash", 30)` finds any spoken word after 30 s that is not a script anchor.
- Scene compositions run on **local time**: `const f = START + Math.round(t * K.FPS)`, with
  `START = K.F(K.scene(id).start)`. Overlap neighbouring scenes by ~10 frames so hand-offs can cross.
- Total frames = `ceil(duration × 30)` (scaffold writes it; render.mjs warns if the output differs).

## 6. direction.js (shared layers)

```js
camera: { hits: [[t, amp, dur]], pushes: [{ from, to, amount, release }], punches: [{ at, amount, decay }] },
field:  { density: 1, drift: 1, events: [ /* swarm | breathe | split | shockwave | ring | streams | pulse */ ] },
ticker: { from: null /* s; default scene 2 */, label: "LIVE", speed: 2.5 },
header: { logoFlashAt: null, wordmark: null },
cta:    { pulseEvery: 2.5, flyAt: null /* s: FOLLOW flies into the final title */, next: "GenServer in 60s" },
```

Field event fields are documented at the top of `compositions/bg.html`. Every layer calls the same
`K.camAt(t)`, so scenes (`K.applyCam(cam, f / K.FPS)`), clip wrappers and the background (40% depth) move
together — use hits on slams (amp 6–24 px), a push across the hook, a punch on the reveal.

## 7. 3D clips (Remotion)

Use 3D where an object is the story (a server rack that docks into a badge, processes as spheres, the
spinning topic logo) — not for text. Setup, clip pattern, `clips.json` and rendering are in
`~/.claude/skills/ai-video-skills/templates/remotion/README.md`. Key facts: ~1.4 s per frame to render, so trim
each clip to its on-screen span and render early; `render-clips.mjs` writes straight into
`build/<v>/assets/clips/`; place each clip in index.html at `@clips` inside a `.camwrap` div with an `id`
on the `<video>` (the renderer freezes videos without one). Keep the 2D labels in HyperFrames and line
them up with the clip's geometry (both use canvas pixels).

## 8. Motion lessons from earlier reels

- Counters: snap fast-spinning digits to whole values — half-rolled digits look broken in stills.
- Scramble/decode effects resolve within ~8 frames, or paused frames read as typos.
- Keep motion blur off text; enable `data-motion-blur` only on fast non-text movers.
- A caption or label that changes must fade out before the next fades in — never cross-fade text.
- Objects leaving upward pass through the header: fade them over ~5 frames before they reach y 300.
- Text on screen for less than ~0.5 s gets flagged by `check` and is unreadable; hold it to the next beat.
- Deterministic only: `K.rng(seed)` / `K.hash(...)`, never `Math.random()` or `Date`.
- Search `/hyperframes-registry` before hand-building a named effect (headline slam, number wheel,
  scramble reveal, strikethrough, success check and karaoke captions are already in compositions/components).

## 9. Review checklist (before showing the user)

1. `render.mjs` printed check passed, frames = `reel.json audio.frames`, audio ≈ −14 LUFS.
2. Read `out/<v>-contact.png`: header, footer and a moving background in every tile; no tile without a
   new element for more than 2 tiles in a row; scene text never touches the captions band or header.
3. Snapshot the hand-offs (`npx hyperframes snapshot --at <t1>,<t2>` in build/<v>) and look at them.
4. Hook: something large and legible by 0.5 s.
Fix what fails and render once more; mention anything left over to the user.

## 10. Gate 3 — approve the version

One version: show `out/a.mp4`, `out/a-contact.png` and one paragraph on how the direction plays out; the
user approves it or asks for fixes. Several: `node compare.mjs` → `out/compare.mp4` (A and B side by side
with A's audio); show every MP4, contact sheet, the compare video and one paragraph per direction; they pick,
ask for fixes, or ask to merge ideas. Record `gates.version` and `reel.json → picked`.

## 11. The 16:9 cut (after the pick)

```bash
node $S/scaffold.mjs a-16x9 --from a          # copies scenes, direction and hosts; resizes host attributes
# re-lay every scene for K.L (landscape): wider, shorter; move text into x 120–1800, y 220–850
# 3D: set clips.json to 1920×1080, re-place props, node render-clips.mjs --out ../assets/clips (inside build/a-16x9/remotion)
cp build/a/cues.json build/a-16x9/ && node $S/mix.mjs a-16x9 && node $S/render.mjs a-16x9
```

Captions, header (FOLLOW pill instead of a footer), ticker and progress re-lay themselves. Snapshot and
review it like §9 before publishing.

## 12. Troubleshooting

- `check` says *missing_timeline_registry*: each composition must assign `window.__timelines["<id>"]`
  literally (K.drive does it at runtime, but index.html also needs the literal line — the template has it).
- A composition never appears: its host `data-composition-id` must match the id passed to `K.drive`.
- Fonts render as boxes: the composition lacks the `@font-face` rules, or the font file path is wrong.
- HyperFrames plugin install fails on `git-lfs`: re-run the clone with
  `GIT_CONFIG_COUNT=3 GIT_CONFIG_KEY_0=filter.lfs.process GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=filter.lfs.smudge GIT_CONFIG_VALUE_1=cat GIT_CONFIG_KEY_2=filter.lfs.required GIT_CONFIG_VALUE_2=false`
  (or `brew install git-lfs`).
