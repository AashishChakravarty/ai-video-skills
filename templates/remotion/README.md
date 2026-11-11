# ai-video-skills Remotion clip kit

Remotion 4 (+ React Three Fiber) renders a reel's 3D shots as **transparent VP9 WebM clips**; the HyperFrames
master places them as muted video layers. Clips carry no background, chrome or captions — HyperFrames owns those.

## Setup
Copy this folder into the version's HyperFrames project as `remotion/`, then `npm install` (~30 s).
`npm run studio` previews clips; `npm run typecheck` runs tsc.

## Add a clip
1. Write `src/clips/MyShot.tsx` from the `Example.tsx` pattern; for a topic logo just use `Logo3D` (any 24×24 simple-icons path).
2. Register it in `src/registry.ts`.
3. Add an entry to `clips.json`: `id` (letters, digits, hyphens — no underscores), `component`, reel frames `from`/`to`
   (trim to the on-screen span), and `props` with timing as reel frames and positions/sizes in canvas px.

### Timing from the voice
Any frame in `from`, `to` or props (nested ones too, e.g. `legs[].arrive`) may be a reference instead of a number;
`render-clips.mjs` resolves them from the reel's `anchors.json`, `words.json` and `assets/reel-data.js` (frame =
round(t × fps) + `offset`, default 0) into `clips.resolved.json`, so components still get plain numbers:
```jsonc
{ "anchor": ["route", "पहला"], "offset": -6 }            // @beat in anchors.json; 3rd item = n-th (0-based) repeat
{ "word": "company", "after": ["route", "पहला"] }        // first spoken word "company" after that beat
{ "scene": "clues", "edge": "start", "offset": 10 }      // scene's first ("start") or last ("end") spoken word
```
After a voice re-take and re-align, just re-run `render-clips.mjs` (add `--write-html` to update the `<video>` timing).
A reference that no longer resolves stops the render and names the clip.

Rules: animate only from `const f = props.from + useCurrentFrame()` — never `useFrame()`, `Math.random()` or `Date`.
`OrthoStage` is 1 unit = 1 canvas px; place objects with `px(x, y, width, height)`. Every clip is wrapped in `FontGate`.

## Render
```
node render-clips.mjs            # all clips → ../assets/clips/<id>.webm
node render-clips.mjs --only id  # one clip;  --out <dir> to write elsewhere
node render-clips.mjs --resolve-only --write-html  # no render: print each clip's frames and <video> timing, update ../index.html
```
It picks a free port itself (`--port` to choose one). Each file is checked for ALPHA_MODE=1, the exact frame count
and size; the run first prints each clip's resolved frames and `data-start`/`data-duration`, and `--write-html` writes
them into the matching `<video id="clip-<id>">` of `../index.html`. `npm run studio` resolves before it opens.

## Place in HyperFrames
Inside the camera wrapper so clips shake/punch with the 2D layers:
```html
<video id="clip-<id>" class="clip" src="assets/clips/<id>.webm" data-start="<from/fps>" data-duration="<(to-from)/fps>"
       data-track-index="1" data-layout-allow-occlusion muted playsinline></video>
```

## 16:9 cut
Set `width`/`height` to 1920×1080 in `clips.json`, re-place the props in landscape pixels, and render into the 16:9
project's `assets/clips` (`--out`).

## Gotchas
- Speed: ~1.4 s per 1080×1920 frame (PNG frames + VP9 alpha), so keep clips short.
- The bundle reads `clips.resolved.json`, written by `render-clips.mjs`: re-run it (or `--resolve-only`) after any edit.
- ffprobe shows `pix_fmt=yuv420p` for VP9 alpha; the `ALPHA_MODE=1` tag is the real check. Decode with `-c:v libvpx-vp9` to see alpha.
- `Glow` is an alpha gradient, not additive blending (a transparent clip can't carry additive); it reads as additive on the dark bg.
