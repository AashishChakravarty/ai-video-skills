/**
 * mix.mjs: a version's sound design — the voice-over, an optional synthesized pad bed or a music file ducked
 * under the voice, and SFX cues — mixed into build/<version>/assets/mix.wav at exactly -14 LUFS (two-pass
 * gain correction behind a peak limiter). Cues come from build/<version>/cues.json:
 *
 *   { "bed": { "key": "A", "mode": "minor", "bpm": 100, "volume": 0.17 } | null,
 *     "music": { "file": "path.mp3", "volume": 0.18 } | null,
 *     "cues": [ { "at": ["hook", "आज"], "offset": 0, "sfx": "impact-bass-1", "vol": 0.55 },
 *               { "word": "crash", "from": 30, "sfx": "pop", "vol": 0.4 },
 *               { "scene": "stack", "offset": -0.15, "sfx": "whoosh", "vol": 0.22 },
 *               { "t": 11.05, "sfx": "riser", "vol": 0.35, "trim": 8.2, "dur": 1.8 } ] }
 *
 * "at" is a script anchor (scene, token[, n]); "word" (with an optional "from" seconds, both flat on the cue) is the
 * first spoken match after "from", so cues follow a re-made voice-over; "scene" is that scene's first word (a
 * transition whoosh); "t" is absolute seconds.
 * sfx is a name from the SFX library (node mix.mjs --list; HyperFrames media-use by default, or config sfxDir) or a
 * path to an audio file.
 *
 *   node mix.mjs <version> [--reel dir] [--out file.wav]
 *   node mix.mjs --list
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpeg, loadReel, normalize, probeDuration, readJson, sfxDir } from './lib.mjs';

const NOTES = { C: 130.81, 'C#': 138.59, D: 146.83, 'D#': 155.56, E: 82.41, F: 87.31, 'F#': 92.5, G: 98.0, 'G#': 103.83, A: 110.0, 'A#': 116.54, B: 123.47 };

/** aevalsrc expression for a breathing triad pad over a sub pulse on every beat. */
function bedExpression({ key = 'A', mode = 'minor', bpm = 100 }) {
  const root = NOTES[key] ?? NOTES.A, third = root * 2 ** ((mode === 'major' ? 4 : 3) / 12), fifth = root * 2 ** (7 / 12);
  const beat = (60 / bpm).toFixed(4), f = (x) => x.toFixed(2);
  return `0.16*(sin(2*PI*${f(root)}*t)+0.8*sin(2*PI*${f(third)}*t+0.3)+0.7*sin(2*PI*${f(fifth)}*t+1.1)+0.5*sin(2*PI*${f(root * 2 + 0.6)}*t+2))*(0.6+0.4*sin(2*PI*0.12*t))+0.35*sin(2*PI*${f(root / 2)}*t)*exp(-9*mod(t,${beat}))`;
}

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' }, out: { type: 'string' }, list: { type: 'boolean' } } });

if (opt.list) {
  const dir = sfxDir();
  if (!dir) throw new Error('SFX library not found; install the HyperFrames plugin (see reference/audio.md)');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort()) console.log(`${f.replace(/\.mp3$/, '').padEnd(20)} ${probeDuration(path.join(dir, f)).toFixed(2)}s`);
  process.exit(0);
}

const version = positionals[0];
if (!version) throw new Error('usage: node mix.mjs <version> [--out file.wav] | --list');
const r = loadReel(opt.reel);
if (!r.reel.audio?.vo) throw new Error('reel.json has no approved voice-over (audio.vo); run tts.mjs first');
const vo = r.file(r.reel.audio.vo);
const cueFile = r.file('build', version, 'cues.json');
const sheet = existsSync(cueFile) ? readJson(cueFile) : { bed: { key: 'A', mode: 'minor', bpm: 100 }, cues: [] };
const anchors = existsSync(r.file('anchors.json')) ? readJson(r.file('anchors.json')) : [];
const timing = existsSync(r.file('words.json')) ? readJson(r.file('words.json')) : { words: [], scenes: [] };
const spoken = timing.words;
const bare = (w) => w.normalize('NFC').toLowerCase().replace(/[.,!?;:…।॥"']/g, '');
const out = path.resolve(opt.out ?? r.file('build', version, 'assets/mix.wav'));
const total = probeDuration(vo);

function cueTime(c) {
  if (c.t != null) return c.t + (c.offset ?? 0);
  if (c.scene) {
    const s = timing.scenes.find((x) => x.id === c.scene);
    if (!s) throw new Error(`cue scene "${c.scene}" not in words.json (scenes: ${timing.scenes.map((x) => x.id).join(', ')})`);
    return Math.max(0, s.start + (c.offset ?? 0));
  }
  if (c.word) {
    const w = spoken.find((x) => x.start >= (c.from ?? 0) && bare(x.word) === bare(c.word));
    if (!w) throw new Error(`cue word "${c.word}" not spoken after ${c.from ?? 0}s`);
    return w.start + (c.offset ?? 0);
  }
  const [scene, token, n = 0] = c.at;
  const hit = anchors.filter((a) => a.scene === scene && a.token === token)[n];
  if (!hit) throw new Error(`cue anchor ${JSON.stringify(c.at)} not found in anchors.json`);
  return hit.t + (c.offset ?? 0);
}

function sfxFile(name) {
  if (existsSync(name)) return name;
  const dir = sfxDir();
  const file = dir && path.join(dir, `${name}.mp3`);
  if (!file || !existsSync(file)) throw new Error(`unknown sfx "${name}"; run node mix.mjs --list`);
  return file;
}

const inputs = ['-i', vo];
const chains = ['[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo][key]'];
const labels = ['[vo]'];
let n = 1;
if (sheet.bed) {
  inputs.push('-f', 'lavfi', '-t', total, '-i', `aevalsrc='${bedExpression(sheet.bed)}':s=48000`);
  chains.push(`[${n++}:a]lowpass=f=900,aecho=0.8:0.6:180:0.25,volume=${sheet.bed.volume ?? 0.17},afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5,aformat=channel_layouts=stereo[bed]`);
  labels.push('[bed]');
}
if (sheet.music) {
  inputs.push('-stream_loop', '-1', '-i', path.resolve(r.dir, sheet.music.file));
  chains.push(`[${n++}:a]atrim=duration=${total},aresample=48000,aformat=channel_layouts=stereo,volume=${sheet.music.volume ?? 0.18},afade=t=out:st=${Math.max(0, total - 2)}:d=2[mus]`);
  chains.push('[mus][key]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=300[duck]');
  labels.push('[duck]');
} else chains.push('[key]anullsink');
for (const c of sheet.cues ?? []) {
  const t = cueTime(c);
  if (t >= total) continue;
  inputs.push('-i', sfxFile(c.sfx));
  const ms = Math.round(t * 1000);
  const trim = [c.trim ? `atrim=start=${c.trim}` : '', c.dur ? `atrim=duration=${c.dur},afade=t=out:st=${Math.max(0, c.dur - 0.25)}:d=0.25` : ''].filter(Boolean).join(',');
  chains.push(`[${n}:a]${trim ? `${trim},` : ''}asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${c.vol ?? 0.3},adelay=${ms}|${ms}[c${n}]`);
  labels.push(`[c${n++}]`);
}
chains.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first,atrim=end=${total},asetpts=PTS-STARTPTS[out]`);

const raw = `${out}.raw.wav`;
ffmpeg([...inputs.map(String), '-filter_complex', chains.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', raw]);
const l = normalize(raw, out, { target: -14 });
rmSync(raw);
console.log(`${path.relative(r.dir, out)}: ${probeDuration(out).toFixed(3)}s, ${(sheet.cues ?? []).length} cues${sheet.bed ? ', pad bed' : ''}${sheet.music ? ', ducked music' : ''} → ${l.lufs} LUFS, peak ${l.peak} dBTP`);
