# ai-video-skills Remotion clip kit

Remotion 4 (+ React Three Fiber) renders a reel's 3D shots as **transparent VP9 WebM clips**; the HyperFrames
master places them as muted video layers. Clips carry no background, chrome or captions — HyperFrames owns those.

## Setup
Copy this folder into the version's HyperFrames project as `remotion/`, then `npm install` (~30 s).
`npm run studio` previews clips; `npm run typecheck` runs tsc.

## Add a clip
1. Write `src/clips/MyShot.tsx` from the `Example.tsx` pattern; for a topic logo just use `Logo3D` (any 24×24 simple-icons path).
2. Register it in `src/registry.ts`.
3. Add an entry to `clips.json`: `id` (letters, digits, hyphens — no underscores), `component`, absolute reel frames `from`/`to`
   (trim to the on-screen span), and `props` with anchors as absolute frames and positions/sizes in canvas px.

Rules: animate only from `const f = props.from + useCurrentFrame()` — never `useFrame()`, `Math.random()` or `Date`.
`OrthoStage` is 1 unit = 1 canvas px; place objects with `px(x, y, width, height)`. Every clip is wrapped in `FontGate`.

## Render
```
node render-clips.mjs            # all clips → ../assets/clips/<id>.webm
node render-clips.mjs --only id  # one clip;  --out <dir> to write elsewhere
node render-clips.mjs --port 3917 # when something else (e.g. Docker) holds Remotion's port 3000
```
Each file is checked for ALPHA_MODE=1, the exact frame count and size; the line printed also gives its `data-start`.

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
- `clips.json` is bundled at render time: re-run `render-clips.mjs` after any edit.
- ffprobe shows `pix_fmt=yuv420p` for VP9 alpha; the `ALPHA_MODE=1` tag is the real check. Decode with `-c:v libvpx-vp9` to see alpha.
- `Glow` is an alpha gradient, not additive blending (a transparent clip can't carry additive); it reads as additive on the dark bg.
