/**
 * render-clips.mjs: renders every clips.json entry to a transparent VP9 WebM (yuva420p, PNG frames) and checks
 * each file really carries alpha and the expected frame count. Output defaults to the parent HyperFrames
 * project's assets/clips, so the master always reads the fresh render and there is no copy to forget.
 *
 *   node render-clips.mjs [--out ../assets/clips] [--only id] [--crf 24] [--port 3917]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, 'node_modules/.bin/remotion');

const { values: opt } = parseArgs({
  options: {
    out: { type: 'string', default: path.join(HERE, '../assets/clips') },
    only: { type: 'string' },
    crf: { type: 'string', default: '24' },
    port: { type: 'string' },
  },
});
if (!existsSync(BIN)) throw new Error(`Remotion is not installed: run \`npm install\` in ${HERE}`);
const spec = JSON.parse(readFileSync(path.join(HERE, 'clips.json'), 'utf8'));
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

let failed = 0;
for (const c of clips) {
  const file = path.join(out, `${c.id}.webm`);
  const r = spawnSync(BIN, ['render', 'src/index.ts', c.id, file, '--codec=vp9', '--image-format=png', '--pixel-format=yuva420p', `--crf=${opt.crf}`, '--log=warn', ...(opt.port ? [`--port=${opt.port}`] : [])], { cwd: HERE, stdio: 'inherit' });
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
