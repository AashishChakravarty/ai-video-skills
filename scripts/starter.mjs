/**
 * starter.mjs: gives a scaffolded version a renderable baseline — one scene per script scene that has no composition
 * yet, their hosts in index.html, and a starter cues.json (a whoosh per scene, a pop per beat, bass hits on the
 * hook's last beat and the last scene's first) if none exists. A scene whose script block has a `Kind: <kind>` line
 * becomes that ready-made library scene (assets/library.js; fast mode), filled from its beats' labels; any other
 * scene gets a simple one where each beat's label slams in at its spoken time. When it makes a library scene and
 * direction.js is still the template's, it also writes a simple direction: a camera hit on each scene's first beat,
 * punches on the hook's last beat and the end card, the script's `Wordmark:` in the header and the FOLLOW fly-in
 * on the end scene's last beat.
 *
 *   node starter.mjs <version> [--reel dir]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadReel, readJson, sceneSpans, writeJson } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' } } });
const version = positionals[0];
if (!version) throw new Error('usage: node starter.mjs <version> [--reel dir]');
const r = loadReel(opt.reel);
const dir = r.file('build', version);
if (!existsSync(path.join(dir, 'index.html'))) throw new Error(`build/${version} is not scaffolded; run node scaffold.mjs ${version}`);

const fps = r.reel.fps ?? 30;
const words = readJson(r.file('words.json'));
const anchors = readJson(r.file('anchors.json'));
const total = Math.ceil(words.duration * fps);
const data = readFileSync(path.join(dir, 'assets/reel-data.js'), 'utf8');
const [W, H] = [Number(data.match(/"W":(\d+)/)[1]), Number(data.match(/"H":(\d+)/)[1])];
const template = readFileSync(path.join(dir, 'compositions/scene-template.html'), 'utf8');

// `Kind:` lines in script.md pick a library scene; `Wordmark:` is the header's topic text.
const md = existsSync(r.file('script.md')) ? readFileSync(r.file('script.md'), 'utf8') : '';
const kinds = {};
let current = null;
for (const ln of md.split(/\r?\n/)) {
  current = ln.match(/^##\s+.*\[([\w-]+)\]\s*$/)?.[1] ?? current;
  const kind = current && ln.match(/^Kind:\s*([\w-]+)\s*$/);
  if (kind) kinds[current] = kind[1];
}
const wordmark = md.match(/^Wordmark:\s*(.+?)\s*$/m)?.[1] ?? null;
const libFile = path.join(dir, 'assets/library.js');
const slots = existsSync(libFile) ? readFileSync(libFile, 'utf8').match(/const SLOTS = \{([\s\S]*?)\n {2}\};/)?.[1] ?? '' : '';
const LIB = [...slots.matchAll(/^\s+"?([a-z-]+)"?: \[/gm)].map((m) => m[1]);
for (const [id, kind] of Object.entries(kinds)) {
  if (!LIB.includes(kind)) throw new Error(`script.md [${id}] Kind: ${kind} is not a library scene (${LIB.length ? LIB.join(', ') : 'build/' + version + '/assets/library.js is missing; scaffold a new version'})`);
}
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A scene composition whose beats are [label, seconds] pairs, built from scene-template.html. */
function sceneHtml(id, beats) {
  const comp = `scene-${id}`;
  const lines = beats.map(([label], i) => `      <div id="${comp}-b${i}" class="ln">${escape(label)}</div>`).join('\n');
  const script = `<script>
    (function () {
      const K = window.ReelKit, { REEL, F, prog, lerp, ease } = K, C = REEL.palette, L = K.L;
      const sc = K.scene("${id}"), next = REEL.scenes[REEL.scenes.indexOf(sc) + 1];
      const START = F(sc.start), END = next ? F(next.start) + 10 : REEL.frames;
      const BEATS = ${JSON.stringify(beats.map(([, t]) => t))}.map(F);
      const cam = document.getElementById("${comp}-cam");
      const els = BEATS.map((_, i) => document.getElementById("${comp}-b" + i));
      const mid = (L.safe.top + L.safe.bottom) / 2;
      els.forEach((el, i) => {
        const size = el.textContent.length > 14 ? 84 : el.textContent.length > 8 ? 110 : 140;
        Object.assign(el.style, { top: mid - size * 0.6 + "px", fontSize: size + "px", color: i % 2 ? C.accent : C.white,
          left: L.safe.left + "px", right: L.W - L.safe.right + "px", whiteSpace: "normal" });
      });

      function render(t) {
        const f = START + Math.round(t * K.FPS);
        K.applyCam(cam, f / K.FPS);
        els.forEach((el, i) => {
          const until = i + 1 < BEATS.length ? BEATS[i + 1] : END - 6;
          const a = prog(f, BEATS[i], 8, ease.expoOut) * (1 - prog(f, until - 6, 6));
          el.style.opacity = String(f < BEATS[i] ? 0 : a);
          el.style.transform = "scale(" + lerp(1.3, 1, prog(f, BEATS[i], 8, ease.expoOut)).toFixed(4) + ")";
        });
      }

      K.fonts(() => K.drive("${comp}", (END - START) / K.FPS, render));
    })();
  </script>`;
  return template
    .replace(/<!--[\s\S]*?-->/, `<!--\n  ${comp}: starter scene for script scene [${id}] written by starter.mjs — each beat's label slams in at its\n  spoken time. Replace it with the direction's real scene.\n-->`)
    .replace(/<div id="scene-id-cam"[\s\S]*?<\/div>\n    <\/div>/, `<div id="${comp}-cam" data-layout-allow-overflow>\n${lines}\n    </div>`)
    .replace(/<script>[\s\S]*<\/script>/, script)
    .replaceAll('scene-id', comp);
}

/** A library scene: an empty camera div that Library.scene fills from the scene's anchors at load time. */
function libraryHtml(id, kind) {
  const comp = `scene-${id}`;
  return template
    .replace(/<!--[\s\S]*?-->/, `<!--\n  ${comp}: library scene "${kind}" for script scene [${id}] written by starter.mjs; its beats are the scene's\n  @anchors and their quoted labels (slots in assets/library.js). Change the labels in script.md, then script.mjs time\n  and scaffold.mjs --sync; or replace this file with a hand-built scene.\n-->`)
    .replace(/<div id="scene-id-cam"[\s\S]*?<\/div>\n    <\/div>/, `<div id="${comp}-cam" data-layout-allow-overflow data-layout-allow-overlap></div>`)
    .replace(/<script>[\s\S]*<\/script>/, `<script>\n    window.Library.scene(${JSON.stringify(kind)}, ${JSON.stringify(id)});\n  </script>`)
    .replaceAll('scene-id', comp);
}

const index = path.join(dir, 'index.html');
let html = readFileSync(index, 'utf8');
const made = [];
const spans = sceneSpans(words.scenes, fps, total);
words.scenes.forEach((scene, i) => {
  const comp = `scene-${scene.id}`, file = path.join(dir, 'compositions', `${comp}.html`);
  if (existsSync(file) || html.includes(`data-composition-id="${comp}"`)) return;
  const beats = anchors.filter((a) => a.scene === scene.id).map((a) => [a.label ?? a.token.toUpperCase(), a.t]);
  if (!beats.length) beats.push([scene.id.toUpperCase(), scene.start]);
  writeFileSync(file, kinds[scene.id] ? libraryHtml(scene.id, kinds[scene.id]) : sceneHtml(scene.id, beats));
  const { start, end } = spans[i];
  html = html.replace('<!-- @scenes', `<div id="${comp}" class="scene" data-composition-id="${comp}" data-composition-src="compositions/${comp}.html" data-start="${(start / fps).toFixed(6)}" data-duration="${((end - start) / fps).toFixed(6)}" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>\n      <!-- @scenes`);
  made.push(scene.id);
});
writeFileSync(index, html);

/** [scene, token, n] for an anchor, n counting earlier anchors with the same token in its scene. */
const ref = (a) => [a.scene, a.token, anchors.filter((b) => b.scene === a.scene && b.token === a.token).indexOf(a)];
const first = (id) => anchors.find((a) => a.scene === id), last = (id) => anchors.findLast((a) => a.scene === id);
const hookLast = last(words.scenes[0].id), endFirst = first(words.scenes.at(-1).id);

const cueFile = path.join(dir, 'cues.json');
if (!existsSync(cueFile)) {
  const big = new Set([hookLast, endFirst].filter(Boolean));
  const cues = [
    ...words.scenes.map((s) => ({ scene: s.id, offset: -0.15, sfx: 'whoosh', vol: 0.22 })),
    ...anchors.map((a, i) => (big.has(a) ? { at: ref(a), sfx: 'impact-bass-1', vol: 0.4 } : { at: ref(a), sfx: i % 2 ? 'pop' : 'click-soft', vol: 0.22 })),
  ];
  writeJson(cueFile, { bed: { key: 'A', mode: 'minor', bpm: 100 }, cues });
}

const dirFile = path.join(dir, 'assets/direction.js');
const pristine = existsSync(dirFile) && /concept: ""/.test(readFileSync(dirFile, 'utf8')) && /hits: \[\]/.test(readFileSync(dirFile, 'utf8'));
let directed = false;
if (made.some((id) => kinds[id]) && pristine) {
  const A = (a) => `A(${ref(a).map((v) => JSON.stringify(v)).join(', ')})`;
  const hits = words.scenes.map((s) => first(s.id)).filter(Boolean).map((a) => `        [${A(a)}, 6, 0.2],`);
  const punches = [hookLast, endFirst].filter(Boolean).map((a) => `        { at: ${A(a)}, amount: 0.05, decay: 0.35 },`);
  const endScene = words.scenes.at(-1).id, follow = kinds[endScene] === 'end' ? last(endScene) : null;
  writeFileSync(dirFile, readFileSync(dirFile, 'utf8')
    .replace('concept: ""', 'concept: "Fast mode: ready-made library scenes"')
    .replace('hits: [],', `hits: [\n${hits.join('\n')}\n      ],`)
    .replace('punches: [],', `punches: [\n${punches.join('\n')}\n      ],`)
    .replace('events: [] }', `events: [${hookLast ? `{ type: "pulse", at: ${A(hookLast)}, frames: 16 }` : ''}] }`)
    .replace('wordmark: null', `wordmark: ${JSON.stringify(wordmark)}`)
    .replace('flyAt: null', `flyAt: ${follow ? A(follow) : 'null'}`));
  directed = true;
}
console.log(`library scenes: ${made.filter((id) => kinds[id]).join(', ') || 'none'}${directed ? '; wrote a fast-mode direction.js' : ''}`);
console.log(`starter scenes: ${made.length ? made.join(', ') : 'none needed'}; cues.json ${existsSync(cueFile) ? 'ready' : 'missing'}`);
