/**
 * starter.mjs: gives a scaffolded version a renderable baseline — one simple scene per script scene that has no
 * composition yet (each beat's on-screen label slams in at its spoken time and holds until the next beat), their
 * hosts in index.html, and a starter cues.json (a whoosh per scene, a hit per beat) if none exists. Use it to
 * test the pipeline end to end, or as the first draft a creative direction replaces scene by scene.
 *
 *   node starter.mjs <version> [--reel dir]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadReel, readJson, writeJson } from './lib.mjs';

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

const index = path.join(dir, 'index.html');
let html = readFileSync(index, 'utf8');
const made = [];
words.scenes.forEach((scene, i) => {
  const comp = `scene-${scene.id}`, file = path.join(dir, 'compositions', `${comp}.html`);
  if (existsSync(file) || html.includes(`data-composition-id="${comp}"`)) return;
  const beats = anchors.filter((a) => a.scene === scene.id).map((a) => [a.label ?? a.token.toUpperCase(), a.t]);
  if (!beats.length) beats.push([scene.id.toUpperCase(), scene.start]);
  writeFileSync(file, sceneHtml(scene.id, beats));
  const start = Math.round(scene.start * fps), end = words.scenes[i + 1] ? Math.round(words.scenes[i + 1].start * fps) + 10 : total;
  html = html.replace('<!-- @scenes', `<div id="${comp}" class="scene" data-composition-id="${comp}" data-composition-src="compositions/${comp}.html" data-start="${(start / fps).toFixed(6)}" data-duration="${((Math.min(end, total) - start) / fps).toFixed(6)}" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>\n      <!-- @scenes`);
  made.push(scene.id);
});
writeFileSync(index, html);

const cueFile = path.join(dir, 'cues.json');
if (!existsSync(cueFile)) {
  const cues = [
    ...words.scenes.map((s) => ({ t: Math.max(0, s.start - 0.15), sfx: 'whoosh', vol: 0.25 })),
    ...anchors.map((a, i) => ({ at: [a.scene, a.token, anchors.slice(0, i).filter((b) => b.scene === a.scene && b.token === a.token).length], sfx: i % 3 ? 'pop' : 'impact-bass-1', vol: i % 3 ? 0.25 : 0.4 })),
  ];
  writeJson(cueFile, { bed: { key: 'A', mode: 'minor', bpm: 100 }, cues });
}
console.log(`starter scenes: ${made.length ? made.join(', ') : 'none needed'}; cues.json ${existsSync(cueFile) ? 'ready' : 'missing'}`);
