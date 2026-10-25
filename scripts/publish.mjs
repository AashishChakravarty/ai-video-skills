/**
 * publish.mjs: assembles the publish pack for the picked version in publish/ and verifies every file:
 *   <slug>-9x16.mp4          the reel (Instagram Reels, YouTube Shorts, TikTok, Facebook Reels, LinkedIn)
 *   <slug>-9x16-nosubs.mp4   same without burned-in captions (rendered here if out/<v>-nosubs.mp4 is missing)
 *   <slug>-16x9.mp4          the landscape cut, when out/<v>-16x9.mp4 exists
 *   captions.srt / .vtt      subtitle uploads; cover-9x16.png and cover-16x9.jpg (1280x720)
 *   captions.md              per-platform copy written from reference/publish.md (length-checked here)
 *
 *   node publish.mjs <version> [--cover-at 1.5] [--cover16-at 1.5] [--skip-nosubs] [--reel dir]
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SKILL, ffmpeg, loadReel, loudness, probeVideo, readJson, writeJson, writeSubtitles } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'cover-at': { type: 'string' }, 'cover16-at': { type: 'string' }, 'skip-nosubs': { type: 'boolean' }, reel: { type: 'string' } },
});
const version = positionals[0];
if (!version) throw new Error('usage: node publish.mjs <version> [--cover-at s] [--cover16-at s] [--skip-nosubs]');
const r = loadReel(opt.reel);
const slug = r.reel.slug, pub = (name) => r.file('publish', name), outFile = (name) => r.file('out', name);
mkdirSync(r.file('publish'), { recursive: true });

if (!existsSync(outFile(`${version}.mp4`))) throw new Error(`out/${version}.mp4 missing; run node render.mjs ${version}`);
if (!existsSync(outFile(`${version}-nosubs.mp4`)) && !opt['skip-nosubs']) {
  const s = spawnSync(process.execPath, [path.join(SKILL, 'scripts/render.mjs'), version, '--nosubs', '--skip-check', '--reel', r.dir], { stdio: 'inherit' });
  if (s.status !== 0) throw new Error('no-subtitle render failed');
}

const files = [];
const copy = (src, name) => {
  if (!existsSync(src)) return false;
  copyFileSync(src, pub(name));
  files.push(name);
  return true;
};
copy(outFile(`${version}.mp4`), `${slug}-9x16.mp4`);
copy(outFile(`${version}-nosubs.mp4`), `${slug}-9x16-nosubs.mp4`);
const has16 = copy(outFile(`${version}-16x9.mp4`), `${slug}-16x9.mp4`);

const words = readJson(r.file('words.json'));
writeSubtitles(words.words, pub('captions'));
files.push('captions.srt', 'captions.vtt');

const firstBeat = readJson(r.file('anchors.json'))[0]?.t ?? 0;
const coverAt = Number(opt['cover-at'] ?? firstBeat + 0.8);
ffmpeg(['-ss', coverAt, '-i', pub(`${slug}-9x16.mp4`), '-frames:v', '1', pub('cover-9x16.png')]);
files.push('cover-9x16.png');
if (has16) {
  ffmpeg(['-ss', Number(opt['cover16-at'] ?? coverAt), '-i', pub(`${slug}-16x9.mp4`), '-frames:v', '1', '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720', '-q:v', '2', pub('cover-16x9.jpg')]);
  files.push('cover-16x9.jpg');
}

const LIMITS = { Instagram: 2200, 'YouTube Shorts title': 100, 'YouTube Shorts description': 5000, 'YouTube title': 100, 'YouTube description': 5000, TikTok: 4000, LinkedIn: 3000, X: 280, Facebook: 63206 };
const problems = [];
if (existsSync(pub('captions.md'))) {
  files.push('captions.md');
  const md = readFileSync(pub('captions.md'), 'utf8');
  for (const block of md.split(/^## /m).slice(1)) {
    const [head, ...rest] = block.split('\n');
    const body = rest.join('\n').trim(), title = head.trim();
    const parts = { [title]: body };
    const t = body.match(/^Title:\s*(.+)$/m), d = body.match(/^Description:\s*([\s\S]+?)(?=^\w[\w ]*:|$(?![\s\S]))/m);
    if (t) parts[`${title} title`] = t[1].trim();
    if (d) parts[`${title} description`] = d[1].trim();
    for (const [key, text] of Object.entries(parts)) {
      const limit = LIMITS[key];
      if (limit && [...text].length > limit) problems.push(`${key}: ${[...text].length} chars > ${limit}`);
    }
  }
} else problems.push('publish/captions.md missing — write it from reference/publish.md');

const rows = [];
for (const name of files.filter((f) => f.endsWith('.mp4'))) {
  const v = probeVideo(pub(name)), l = loudness(pub(name));
  rows.push({ file: name, size: `${v.width}x${v.height}`, fps: v.fps, frames: v.frames, seconds: Number(v.duration.toFixed(2)), lufs: v.audio ? l.lufs : null });
  if (!v.audio) problems.push(`${name} has no audio`);
  if (r.reel.audio?.frames && Math.abs(v.frames - r.reel.audio.frames) > 1) problems.push(`${name}: ${v.frames} frames, expected ${r.reel.audio.frames}`);
}
if (!has16) problems.push(`no 16:9 cut yet (out/${version}-16x9.mp4) — scaffold ${version}-16x9 --from ${version}, re-lay the scenes out, mix, render`);

writeJson(pub('manifest.json'), { slug, version, createdAt: new Date().toISOString(), files, videos: rows, problems });
r.reel.publish = { version, files, problems };
r.reel.stage = problems.length ? 'publish' : 'done';
r.save();
console.table(rows);
console.log(`publish/: ${files.join(', ')}`);
console.log(problems.length ? `TO FIX:\n  ${problems.join('\n  ')}` : 'publish pack complete');
