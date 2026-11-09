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
- **Hook**: a huge card (code, a number, a claim), on screen from frame 0 (the autoplay preview and the first
  contact-sheet tile), gets challenged (a stamp slams with a
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
  during loops, swarms or multiplies for scale moments and collapses back for the CTA. The reel's theme sets
  the background style (`reel.json → background`): `grid` keeps fewer dots under a blueprint grid; `glow` has
  no dots, so field moments come from `streams`, `pulse` and the scenes themselves. `background.gradient` (#hex)
  fades the base from `palette.bg` at the top left to that colour at the bottom right; keep it a small step.
- **Sound**: soft pad bed; pen-scribble or whoosh on strokes, light clicks on counter ticks, whooshes on
  flights, a bass impact on the one or two big reveals, a riser into the biggest number. Keep the long
  `glitch-*` effects out from under narration (they read as noise); a block or a filter gets `whoosh-short` +
  `click-soft`.

Put the hero object, its resting poses and shared clocks in `build/a/assets/diagram.js` as pure functions
of the frame, so neighbouring scenes draw the same object on the same frame and hand-offs line up exactly.

### Design system (every version)

`assets/design.js` (`window.Design`) is the shared system; diagram.js builds the topic's objects on top of it.

- **One type scale**: every word comes from `text(…, { kind })`, `tag`, `flowRow`, `terminal` or `stamp` —
  hero 96 (big numbers), title 64 (one per scene, on `GRID.title`), stamp 56, label 40 (names of things), chip
  30 mono (tags, sub-lines, code), note 28. Never set a font size by hand, and never put text inside a scaled
  object: labels sit beside or under the object at their own size.
- **Standard object sizes**: each object (hero card, safe, key, signature, node, icon box 132 px) has one scale
  used in every scene, so things read as one family; keep them in diagram.js (`SIZE`). A small object inside a
  bigger one is centred in it and clearly smaller (the Binance key box: 0.32 inside a 0.85 card).
- **Grid and spacing**: read positions from `GRID` and `CX`, which follow the format. Portrait: title row y 470,
  stage rows 640 / 820 / 1000 / 1180, columns x 300 / 780, flow rows 680 / 900 / 1120, note row 1300. Landscape:
  title 270, rows 400 / 560 / 720, columns 640 / 1280, flow rows 390 / 585 / 780, note 810. Keep ≥ 24 px between
  any two boxes. When a spot is needed again, the old element fades out before the new one
  fades in. Never shrink a crowded scene with `camera.scale` — re-lay it out on the grid.
- **Explain with flows**: how-it-works scenes are vertical step flows (`flowRow` + `flowLink`, one step per
  spoken name, the active step lit) or two-column comparisons; code and alerts go in a large `terminal` with
  small mono text; the attacker is always the `hacker` icon (a user with a hat).
- **No invented numbers**: illustrative values are symbolic ("NONCE n", "n+1"), never made-up digits.
- **Phones and app screens look real**: `phone(parent, id, { x, y })` draws a modern phone (dark frame, side keys,
  Dynamic Island, status bar, home bar; 340 × 690, two fit side by side in portrait at x 230 / 850, y 985). Build the
  app inside `screen` with `ui()` — app-UI sizes `UI.xs` 28 (the legibility floor) to `UI.xl` 64, regular weight
  unless `bold`, sentence case like a real app — and `glyph()` for 36–54 px icons. Show the real flow (Paying →
  amount → Pay → Processing… → Pending, a bank notification under the island, a merchant's recent-payments list),
  never a card with type-scale text and big icons standing in for a phone.

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
S=$R/scripts   # $R: the plugin folder (skills/reel/SKILL.md)
node $S/scaffold.mjs a                         # build/a from templates/hyperframes, data from words/anchors
node $S/starter.mjs a                          # optional: a starter scene per script scene + cues.json, renderable at once
# edit build/a/assets/direction.js             camera hits/pushes/punches, field events, ticker, CTA flight
# write build/a/compositions/<scene>.html      copy compositions/scene-template.html, one per script scene
# add each scene host to build/a/index.html at <!-- @scenes -->
# optional 3D: cp -r $R/templates/remotion build/a/remotion  (see §7)
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

Even for one version, build the two scenes that set the look first (one explanation flow and the CTA), show
their frames for approval, then build the rest — with helpers in parallel if you like. Give each helper the
design-system rules above, the approved scenes as references, the exact hand-off poses and labels, and the
checks from §9 (check, the font-size grep, a snapshot per beat); let each helper own only its scene files.

## 4. Layout and legibility (phone-first)

`ReelKit.L` holds the layout for the format; read positions from it instead of hard-coding.

| Portrait 1080×1920 | y range | Notes |
|---|---|---|
| Platform top bar | 0–250 | Reels/Shorts/TikTok draw their own UI here — nothing of ours but the dark band |
| Header (logo, wordmark, handle) | 260–324 | optional ticker below it (off by default): 360–432, one item at a time, never scrolling |
| **Scene content** | 450–1340 | `GRID`: title row 470, stage rows 640–1180, note row 1300; key text inside x 60–1020 |
| Captions band | 1373–1469 | scene text never enters it |
| Progress bar | 1538 | |
| Follow footer | 1590–1666 | platform UI also covers this zone — nothing important below 1540 except the CTA |

Header and footer come from the theme's `chrome.style`: `bar` (default: wordmark + handle over an accent hairline, a
gradient footer band) or `card` (an ink rule with an accent segment and the FOLLOW pill + handle on a rounded surface card). Both keep the zones above, so scenes never
change with the style. Set the wordmark to the topic in direction.js (`header.wordmark`); a light theme (`paper`) uses
`K.surface` for cards and `K.shadow()` for depth, so build objects with those instead of `C.bg` fills and black shadows.
The theme's `cards.style` sets the card look: `soft` (hairline edges, layered accent-tinted shadows, traffic-light window
bars, highlighter titles) or `hard` (solid ink edges, offset ink shadows, an accent window bar). Give every card and cell
`K.edge(a)` for its border, `K.lit(act, a)` when it lights up and `K.shadow(depth)` for depth (glows join with a comma),
and use `Design.winBar` for window title bars, so one reel can switch looks by theme.

Landscape 1920×1080: header 0–130 with the FOLLOW pill on the right, ticker 126–194, scene content
y 220–850 × x 120–1800, captions 880–980, progress 1050.

Fonts: `Reel Sans` and `Reel Mono` load `assets/fonts/reel-sans.ttf` / `reel-mono.ttf`, which scaffold copies from the
reel's theme `fonts.sans` / `fonts.mono` (default Noto Sans Devanagari 800, covering Latin + Devanagari, and JetBrains
Mono 700). Colours come from `REEL.palette` (the theme's, with the topic accent); never hard-code them. Text on an
accent fill uses `K.onAccent` (white, or the background colour when the accent is light, like Binance yellow). Sizes come from the
type scale in `design.js` (§1 Design system); captions are 46 px and nothing on screen is under 28 px. Declare the `@font-face` rules in every composition
that uses them (the linter checks per file). Contrast ≥ 4.5:1 — the accent from logo.mjs already is.

## 5. Timing and anchors

- `script.timed.md` lists every beat with its spoken time; `frame = round(t × 30)`.
- In compositions use `K.anchor("scene", "token")` (and `A(...)` in direction.js) instead of pasting
  numbers: if the voice is re-made, `script.mjs time` + `scaffold --sync` move every beat for free.
  `K.wordAt("crash", 30)` finds any spoken word after 30 s that is not a script anchor.
- Scene compositions run on **local time**: `const f = START + Math.round(t * K.FPS)`, with
  `START = K.F(K.scene(id).start)` and `END` = the next scene's start + 10 frames (the last scene: `K.DUR`), as in
  scene-template.html; fade out against `END`, never against the scene's last word. The host in index.html spans
  START to END: `scaffold.mjs --sync` sets it after every re-take or re-align.
- A one-scene helper (`const at = (tok) => F(K.anchor("hook", tok))`, then `at("कट")`) is fine: the stale-anchor
  check (script.mjs time, scaffold --sync, render.mjs) reads it like `K.anchor` and `A(...)`.
- Scene-change whooshes in cues.json follow the scene: `{ "scene": "stack", "offset": -0.15, "sfx": "whoosh" }`.
- Total frames = `ceil(duration × 30)` (scaffold writes it; render.mjs warns if the output differs).

## 6. direction.js (shared layers)

```js
camera: { scale: 1 /* < 1 shrinks every scene around camOrigin for more breathing room */, hits: [[t, amp, dur]], pushes: [{ from, to, amount, release }], punches: [{ at, amount, decay }] },
field:  { density: 1, drift: 1, events: [ /* swarm | breathe | split | shockwave | ring | streams | pulse */ ] },
ticker: null,  // off by default; { from: null /* s; default scene 2 */, label: "LIVE" } shows REEL.ticker items one at a time
header: { logoFlashAt: null, wordmark: null },
cta:    { pulseEvery: 2.5, flyAt: null /* s: FOLLOW flies into the final title */, next: "GenServer in 60s" },
```

Field event fields are documented at the top of `compositions/bg.html`. Every layer calls the same
`K.camAt(t)`, so scenes (`K.applyCam(cam, f / K.FPS)`), clip wrappers and the background (40% depth) move
together — use hits on slams (amp 6–24 px), a push across the hook, a punch on the reveal.

## 7. 3D clips (Remotion)

Use 3D where an object is the story (a server rack that docks into a badge, processes as spheres, the
spinning topic logo) — not for text. Setup, clip pattern, `clips.json` and rendering are in
`$R/templates/remotion/README.md`. Key facts: ~1.4 s per frame to render, so trim
each clip to its on-screen span and render early; `render-clips.mjs` writes straight into
`build/<v>/assets/clips/`; place each clip in index.html at `@clips` inside a `.camwrap` div with an `id`
on the `<video>` (the renderer freezes videos without one). Keep the 2D labels in HyperFrames and line
them up with the clip's geometry (both use canvas pixels). Take every position from `props` (lanes, rows,
spawn heights, the x of the hero lane), never a literal pixel in the component, so the 16:9 cut only edits
`clips.json`. If port 3000 is taken (Docker), pass `--port 3917` to `render-clips.mjs`.

## 8. Motion lessons from earlier reels

- Counters: snap fast-spinning digits to whole values — half-rolled digits look broken in stills.
- Scramble/decode effects resolve within ~8 frames, or paused frames read as typos.
- Keep motion blur off text; enable `data-motion-blur` only on fast non-text movers.
- A caption or label that changes must fade out before the next fades in — never cross-fade text.
- Objects leaving upward pass through the header: fade them over ~5 frames before they reach y 440.
- Nothing scrolls sideways as a marquee — no running ticker, header or footer; text holds still and swaps in place.
- Text must stay on screen long enough to read: `check` (craft `line_unread`) wants about 0.5 s + 0.3 s per word,
  at least 1.5 s for a line of 4–5 words. A note row that swaps on every beat fails this; start the line on an
  earlier spoken word or shorten it ("PRICE = HOPE" instead of "THE PRICE GROWS ON HOPE").
- Deterministic only: `K.rng(seed)` / `K.hash(...)`, never `Math.random()` or `Date`.
- Search `/hyperframes-registry` before hand-building a named effect (headline slam, number wheel,
  scramble reveal, strikethrough, success check and karaoke captions are already in compositions/components).
- Show the literal thing the voice names. "The page spins" is the app's own page (a browser window with its
  URL) under a loader card; "payment gets stuck" is a payment screen whose progress bar stalls; a spoken
  question opens on a question card that builds word by word with the voice. Abstract chips come after.
- A spoken headline number or time gets its own beat: hero size, alone on screen for about a second and a half,
  then it settles to make room for the supporting cards.
- Maps use real outlines, never hand-drawn ones: Natural Earth admin-0, projected into the scene box and
  simplified to about 1 px. For India use the India point-of-view file
  (`geojson/ne_10m_admin_0_countries_ind.geojson` in nvkelso/natural-earth-vector), which has the official
  boundary.
- A named machine or system (servers, a router, a database) is drawn at icon-box size or bigger, not as a small
  glyph beside a chip.
- No empty stage: every spoken phrase has a visual, including the first two seconds of each scene. Snapshot
  each scene's opening.

## 9. Review checklist (before showing the user)

1. `render.mjs` printed check passed, frames = `reel.json audio.frames`, audio ≈ −14 LUFS.
2. Read `out/<v>-contact.png`: header, footer and a moving background in every tile; no tile without a
   new element for more than 2 tiles in a row; scene text never touches the captions band or header.
3. Snapshot the hand-offs (`npx hyperframes snapshot --at <t1>,<t2> --output ../../out/preview/<name>` in build/<v>)
   and look at them. Frames go to `out/preview/` so the user can open them; the default `.hyperframes/` is hidden.
4. Hook: something large and legible at frame 0 — the first tile of the contact sheet must not be empty.
5. Design system: `grep -nE "fontSize|font-size|size: [0-9]" compositions/scene-*.html` prints nothing; the same
   object is the same size in every tile; no two elements overlap or touch (≥ 24 px); `check` reports no
   `content_overlap` or `text_below_floor` in any scene.
Fix what fails and render once more; mention anything left over to the user.

## 10. Gate 3 — approve the version

One version: show `out/a.mp4`, `out/a-contact.png` and one paragraph on how the direction plays out; the
user approves it or asks for fixes. Several: `node compare.mjs` → `out/compare.mp4` (A and B side by side
with A's audio); show every MP4, contact sheet, the compare video and one paragraph per direction; they pick,
ask for fixes, or ask to merge ideas. Record `gates.version` and `reel.json → picked`.

## 11. The 16:9 cut (after the pick)

```bash
node $S/scaffold.mjs a-16x9 --from a          # copies scenes, direction and hosts; resizes host attributes
# re-lay every scene for K.L (landscape): wider, shorter; move text into x 120–1800, y 220–850. Text, chips and
# flows that read GRID / CX / FLOW_X move by themselves; re-pose the hero objects (diagram.js POS) and any literal x/y
# 3D: set clips.json to 1920×1080, re-place props, node render-clips.mjs --out ../assets/clips (inside build/a-16x9/remotion)
cp build/a/cues.json build/a-16x9/ && node $S/mix.mjs a-16x9 && node $S/render.mjs a-16x9
```

Captions, header (FOLLOW pill instead of a footer), ticker and progress re-lay themselves. The landscape chrome has
no flying FOLLOW footer, so the CTA scene adds its own "FOLLOW @handle" line under its lockup. A vertical flow fits
three steps at `GRID.flow`; a longer flow goes horizontal (boxes in a row, labels under them). Put the hero on the
left (x 120–1000) and its numbers and chips in a right-hand column (x 1100–1800); scene titles go at the top of
that column (`x: 1450, cy: GRID.title`), not centred over the hero. The landscape `GRID.rows` has three rows, so a
four-layer stack gets its own landscape rows in diagram.js `POS` (e.g. `[300, 440, 580, 720]`). With more than
three scenes, re-lay them with parallel agents (scenes split between them, one agent for the 3D clips) that share a
written geometry contract: hero and clip stages, label columns, title row, and who edits the shared files
(diagram.js, direction.js and its field-event positions stay with you). Snapshot and review it like §9 before
publishing.

## 12. Troubleshooting

- `check` says *missing_timeline_registry*: each composition must assign `window.__timelines["<id>"]`
  literally (K.drive does it at runtime, but index.html also needs the literal line — the template has it).
- A composition never appears: its host `data-composition-id` must match the id passed to `K.drive`.
- Fonts render as boxes: the composition lacks the `@font-face` rules, or the font file path is wrong.
- HyperFrames plugin install fails on `git-lfs`: re-run the clone with
  `GIT_CONFIG_COUNT=3 GIT_CONFIG_KEY_0=filter.lfs.process GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=filter.lfs.smudge GIT_CONFIG_VALUE_1=cat GIT_CONFIG_KEY_2=filter.lfs.required GIT_CONFIG_VALUE_2=false`
  (or `brew install git-lfs`).

## 13. Library scenes (fast mode)

`assets/library.js` holds ready-made portrait scenes. A script scene with a `Kind:` line becomes one when
`starter.mjs` runs; its beats are the scene's @anchors with their quoted labels (fields split on " | "), read
from reel-data.js, so after a label or timing change run `script.mjs time` and `scaffold.mjs <v> --sync`.
Beats fill the slots in order; a label that starts with a slot name (`"stamp: NOT AVAILABLE"`) fills that slot.

| Kind | Slots, in order |
|---|---|
| `hook-app` | question `LINE 1 \| LINE 2` · page `url \| HEADING \| ITEM \| ITEM SUB \| BUTTON` · loader `TEXT` · stuck `HEADING \| AMOUNT \| STATUS \| OPT, OPT, OPT` · stamp `TEXT` · why `TEXT \| TAG` |
| `big-number` | big `VALUE \| SUB` (alone at hero size, then it settles) · stat `VALUE \| CAPTION` ×2 (digits roll) |
| `stack` | title · layer `NAME \| SUB \| icon` ×4 (each drops in and lights; dots flow down) |
| `steps` | title (window bar) · step `KEY \| TEXT` ×6 (rows wipe in, ticks as the next starts) |
| `bottleneck` | title · label (chip under the lock) · note (tag) · wait (spinner + text) |
| `end` | comment `SMALL \| KEYWORD` · follow (last beat; clears for the chrome's FOLLOW) · next only as `"next: A \| B"` |

Keep fields to 2–5 words; the library shrinks text that would overflow, but short reads better. Land each
scene's last beat at least 1.5 s before the scene ends, or `check` flags it as unread. `check`'s `line_unread` on
"0 1 2 3 4 5 6 7 8 9" is the big-number odometer: it goes away when the counter has 3.5 s on screen. Icons:
globe, shield, server, router, db, lock, cloud, chat, train, clock, phone, bank, user, laptop, key. To go beyond
a kind, replace that scene's file with a hand-built one; the library is plain Design-kit code to copy from.
