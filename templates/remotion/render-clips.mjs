/**
 * render-clips.mjs: renders every clips.json entry to a transparent VP9 WebM (yuva420p, PNG frames) and checks
 * each file really carries alpha and the expected frame count. Output defaults to the parent HyperFrames
 * project's assets/clips, so the master always reads the fresh render and there is no copy to forget. Timing
 * references (resolve-clips.mjs) are resolved first into clips.resolved.json, which the bundle reads.
 *
 *   node render-clips.mjs [--out ../assets/clips] [--only id] [--crf 24] [--port 3917] [--resolve-only] [--write-html]
 *
 * --resolve-only resolves and prints each clip's <video> timing without rendering; --write-html also writes that
 * data-start/data-duration into the matching <video id="clip-<id>"> of ../index.html.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadTiming, resolveClips } from './resolve-clips.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, 'node_modules/.bin/remotion');

const { values: opt } = parseArgs({
  options: {
    out: { type: 'string', default: path.join(HERE, '../assets/clips') },
    only: { type: 'string' },
    crf: { type: 'string', default: '24' },
    port: { type: 'string' },
    'resolve-only': { type: 'boolean' },
    'write-html': { type: 'boolean' },
  },
});
const spec = resolveClips(JSON.parse(readFileSync(path.join(HERE, 'clips.json'), 'utf8')), loadTiming(HERE));
writeFileSync(path.join(HERE, 'clips.resolved.json'), `${JSON.stringify(spec, null, 2)}\n`);
const placement = (c) => ({ start: (c.from / spec.fps).toFixed(6), duration: ((c.to - c.from) / spec.fps).toFixed(6) });
for (const c of spec.clips) console.log(`${c.id}: frames ${c.from}–${c.to}  data-start="${placement(c).start}" data-duration="${placement(c).duration}"`);
if (opt['write-html']) {
  const html = path.join(HERE, '../index.html');
  let text = readFileSync(html, 'utf8');
  for (const c of spec.clips) {
    const tag = text.match(new RegExp(`<video\\b[^>]*\\bid="clip-${c.id}"[^>]*>`))?.[0];
    if (!tag || !/data-start="[^"]*"/.test(tag) || !/data-duration="[^"]*"/.test(tag)) {
      console.warn(`index.html: no <video id="clip-${c.id}"> with data-start and data-duration; place it by hand`);
      continue;
    }
    const { start, duration } = placement(c);
    text = text.replace(tag, () => tag.replace(/data-start="[^"]*"/, `data-start="${start}"`).replace(/data-duration="[^"]*"/, `data-duration="${duration}"`));
  }
  writeFileSync(html, text);
  console.log(`updated clip timing in ${path.relative(process.cwd(), html)}`);
}
if (opt['resolve-only']) process.exit(0);
if (!existsSync(BIN)) throw new Error(`Remotion is not installed: run \`npm install\` in ${HERE}`);
const clips = spec.clips.filter(c => !opt.only || c.id === opt.only);
if (!clips.length) throw new Error(opt.only ? `no clip "${opt.only}" in clips.json` : 'clips.json has no clips');
const out = path.resolve(opt.out);
mkdirSync(out, { recursive: true });

/** Width, height, packet count and whether the stream is tagged ALPHA_MODE=1, via ffprobe. */
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,nb_read_packets:stream_tags', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}:\n${r.stderr}`);
  const s = JSON.parse(r.stdout).streams[0];
  const alpha = Object.entries(s.tags ?? {}).some(([k, v]) => k.toLowerCase() === 'alpha_mode' && String(v) === '1');
  return { w: s.width, h: s.height, frames: Number(s.nb_read_packets), alpha };
}

/** A port nothing listens on: Remotion's default 3000 can look free while Docker serves it on another interface. */
const freePort = () => new Promise((ok, fail) => {
  const s = net.createServer().once('error', fail).listen(0, () => {
    const { port } = s.address();
    s.close(() => ok(port));
  });
});
const port = opt.port ?? String(await freePort());

let failed = 0;
for (const c of clips) {
  const file = path.join(out, `${c.id}.webm`);
  const r = spawnSync(BIN, ['render', 'src/index.ts', c.id, file, '--codec=vp9', '--image-format=png', '--pixel-format=yuva420p', `--crf=${opt.crf}`, '--log=warn', `--port=${port}`], { cwd: HERE, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`remotion render failed for "${c.id}"`);
  const p = probe(file), want = c.to - c.from;
  const ok = p.alpha && p.frames === want && p.w === spec.width && p.h === spec.height;
  if (!ok) failed++;
  const mb = (statSync(file).size / 1048576).toFixed(1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(process.cwd(), file)}  ${p.w}x${p.h}  ${p.frames}/${want} frames  alpha ${p.alpha ? 'yes' : 'NO'}  ${mb} MB  (data-start ${(c.from / spec.fps).toFixed(6)}s)`);
}
if (failed) {
  console.error(`${failed} clip(s) failed the alpha/frame/size check`);
  process.exit(1);
}
