/**
 * lib.mjs: shared helpers for the ai-video-skills scripts — skill paths, the merged config, reel.json loading,
 * vo.txt parsing, ffmpeg/ffprobe wrappers and colour contrast maths.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The user's settings, outside the repo so updates never overwrite them; AI_VIDEO_SKILLS_CONFIG points elsewhere. */
export const CONFIG_PATH = expandHome(process.env.AI_VIDEO_SKILLS_CONFIG || '~/.config/ai-video-skills/config.json');
export const USER_CONFIG = existsSync(CONFIG_PATH) ? readJson(CONFIG_PATH) : {};
export const CONFIG = merge(readJson(path.join(SKILL, 'config.default.json')), USER_CONFIG);

/** Deep-merges plain objects; arrays and scalars in `over` replace those in `base`. */
export function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    const plain = (x) => x && typeof x === 'object' && !Array.isArray(x);
    out[k] = plain(v) && plain(base?.[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/** A path from the config: absolute, ~-relative, or relative to the skill folder. */
export function configPath(p) {
  return p.startsWith('~') || path.isAbsolute(p) ? expandHome(p) : path.join(SKILL, p);
}

/** Expands a leading ~ to the home directory and resolves the result. */
export function expandHome(p) {
  return path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()));
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Frame span of each scene's host: from the scene's first word to 10 frames into the next scene (the hand-off
 * overlap); the last scene runs to `total`.
 */
export function sceneSpans(scenes, fps, total) {
  return scenes.map((s, i) => ({
    id: s.id,
    start: Math.round(s.start * fps),
    end: Math.min(scenes[i + 1] ? Math.round(scenes[i + 1].start * fps) + 10 : total, total),
  }));
}

/**
 * Anchor references in build/<v> that anchors.json no longer has, as ["file: scene/token#n", …]: A(scene, token[, n])
 * in direction.js, K.anchor(scene, token[, n]) and one-scene helpers (`const at = (tok) => F(K.anchor("hook", tok))`,
 * then at("कट")) in compositions, and every cue "at" in cues.json. A stale one throws at page load or in mix.mjs.
 */
export function staleAnchors(dir, anchors) {
  const has = (scene, token, n = 0) => anchors.filter((a) => a.scene === scene && a.token === token).length > n;
  const missing = [];
  const check = (file, refs) => refs.forEach(([scene, token, n = 0]) => has(scene, token, n) || missing.push(`${file}: ${scene}/${token}${n ? `#${n}` : ''}`));
  const scan = (file, text) => {
    const refs = [...text.matchAll(/\b(?:A|anchor)\(\s*(["'])([\w-]+)\1\s*,\s*(["'])(.+?)\3\s*(?:,\s*(\d+))?\s*\)/g)].map((m) => [m[2], m[4], Number(m[5] ?? 0)]);
    for (const h of text.matchAll(/const (\w+) = \((\w+)(?:,\s*(\w+)(?:\s*=\s*\d+)?)?\) =>[^\n]*?anchor\(\s*(["'])([\w-]+)\4\s*,\s*\2\s*(,\s*\3)?\s*\)/g)) {
      // A helper's second argument is an occurrence only when it is passed on to anchor(); otherwise it is the helper's own (an offset).
      for (const c of text.matchAll(new RegExp(`\\b${h[1]}\\(\\s*(["'])(.+?)\\1\\s*(?:,\\s*(\\d+))?\\s*\\)`, 'g'))) refs.push([h[5], c[2], Number((h[3] && h[6] && c[3]) || 0)]);
    }
    check(file, refs);
  };
  const direction = path.join(dir, 'assets/direction.js');
  if (existsSync(direction)) scan('assets/direction.js', readFileSync(direction, 'utf8'));
  const comps = path.join(dir, 'compositions');
  for (const name of existsSync(comps) ? readdirSync(comps).filter((n) => n.endsWith('.html') && n !== 'scene-template.html') : []) scan(`compositions/${name}`, readFileSync(path.join(comps, name), 'utf8'));
  const cues = path.join(dir, 'cues.json');
  if (existsSync(cues)) check('cues.json', (readJson(cues).cues ?? []).filter((c) => c.at).map((c) => c.at));
  return missing;
}

/** A key=value value: JSON when it parses (2.4, true, ["a"]), otherwise the string itself. */
export function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Sets a dotted path's keys in obj, creating objects on the way; value undefined deletes the key. */
export function setPath(obj, keys, value) {
  const last = keys.pop();
  let node = obj;
  for (const k of keys) node = node[k] = node[k] && typeof node[k] === 'object' ? node[k] : {};
  if (value === undefined) delete node[last];
  else node[last] = value;
}

/** Nested objects as [["a.b", value], …]; arrays count as values. */
export function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
}

/** The SFX library: AI_VIDEO_SKILLS_SFX or config sfxDir, else the HyperFrames media-use library; null when none has MP3s. */
export function sfxDir() {
  const home = os.homedir();
  const dirs = [process.env.AI_VIDEO_SKILLS_SFX, CONFIG.sfxDir && configPath(CONFIG.sfxDir),
    path.join(home, '.claude/plugins/marketplaces/hyperframes/skills/media-use/audio/assets/sfx'),
    path.join(home, '.claude/skills/media-use/audio/assets/sfx')];
  return dirs.find((d) => d && existsSync(d) && readdirSync(d).some((f) => f.endsWith('.mp3'))) ?? null;
}

/** Finds the reel folder (the nearest ancestor holding reel.json) from `start`, or throws. */
export function findReel(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, 'reel.json'))) return dir;
    if (dir === path.dirname(dir)) throw new Error(`no reel.json in ${start} or its parents; run new-reel.mjs first`);
  }
}

/** Loads a reel: { dir, reel, file(rel) → absolute path, save() }. */
export function loadReel(start) {
  const dir = findReel(start);
  const reel = readJson(path.join(dir, 'reel.json'));
  return { dir, reel, file: (...rel) => path.join(dir, ...rel), save: () => writeJson(path.join(dir, 'reel.json'), reel) };
}

/** Parses vo.txt: `[scene-id]` headers, each followed by that scene's narration. */
export function parseVo(text) {
  const scenes = [];
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^\s*\[([\w-]+)\]\s*$/);
    if (head) scenes.push({ id: head[1], text: '' });
    else if (line.trim()) {
      if (!scenes.length) throw new Error(`vo.txt: text before the first [scene-id] header: "${line.trim()}"`);
      scenes.at(-1).text = `${scenes.at(-1).text} ${line.trim()}`.trim();
    }
  }
  if (!scenes.length) throw new Error('vo.txt has no [scene-id] blocks');
  return scenes;
}

/** Runs a command synchronously; throws with its stderr on failure, returns stdout. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args.map(String), { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 6).join(' ')} … failed (${r.status}):\n${(r.stderr || '').slice(-2000)}`);
  return r.stdout;
}

export function ffmpeg(args) {
  return run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
}

/** Media duration in seconds. */
export function probeDuration(file) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
}

/** Integrated loudness (LUFS) and true peak (dBTP) of an audio or video file. */
export function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const block = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!block) throw new Error(`loudness: no loudnorm report for ${file}`);
  const json = JSON.parse(block[0]);
  return { lufs: Number(json.input_i), peak: Number(json.input_tp), lra: Number(json.input_lra), thresh: Number(json.input_thresh) };
}

/**
 * Normalises `input` to `target` LUFS behind a peak limiter at `ceiling` dBFS, re-measuring and correcting the
 * gain until it lands within 0.1 LU (plain linear loudnorm stops short when SFX peaks would clip).
 */
export function normalize(input, output, { target = -14, ceiling = -2.5, channels } = {}) {
  let gain = target - loudness(input).lufs;
  for (let i = 0; i < 5; i++) {
    ffmpeg(['-i', input, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${(10 ** (ceiling / 20)).toFixed(4)}:attack=1:release=60:level=false,aresample=48000`, ...(channels ? ['-ac', String(channels)] : []), '-c:a', 'pcm_s16le', output]);
    const got = loudness(output).lufs;
    if (Math.abs(got - target) <= 0.1) break;
    gain += target - got;
  }
  return loudness(output);
}

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) / 255) + 0.7152 * channel(((n >> 8) & 255) / 255) + 0.0722 * channel((n & 255) / 255);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Lightens a brand colour (keeping hue, lifting saturation for dull ones) until it reaches `ratio` contrast on `bg`. */
export function readableAccent(hex, bg = CONFIG.palette.bg, ratio = 4.5) {
  let [h, s, l] = toHsl(hex);
  s = Math.max(s, 0.55);
  let out = fromHsl(h, s, l);
  while (contrast(out, bg) < ratio && l < 0.95) out = fromHsl(h, s, (l += 0.01));
  return out;
}

/** Video facts for review: size, fps, frame count, duration and whether it carries audio. */
export function probeVideo(file) {
  const out = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,nb_read_frames:format=duration', '-of', 'json', file]));
  const v = out.streams.find((s) => s.codec_type === 'video'), a = out.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = v.r_frame_rate.split('/').map(Number);
  return { width: v.width, height: v.height, fps: num / den, frames: Number(v.nb_read_frames), duration: Number(out.format.duration), audio: Boolean(a) };
}

/** Tiles every `every`-th frame of a video into a contact sheet PNG (9 columns portrait, 5 landscape). */
export function contactSheet(video, out, { every = 30 } = {}) {
  const { width, height, frames } = probeVideo(video);
  const landscape = width > height, cols = landscape ? 5 : 9, tw = landscape ? 384 : 270;
  const rows = Math.ceil(Math.ceil(frames / every) / cols);
  ffmpeg(['-i', video, '-vf', `select='not(mod(n\\,${every}))',scale=${tw}:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-fps_mode', 'passthrough', out]);
  return out;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (s, sep) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}${sep}${pad(Math.round((s % 1) * 1000) % 1000, 3)}`;

/** Groups aligned words into subtitle cues like the burned-in captions: ≤4 words, ≤38 chars, split on pauses over 0.25s. */
export function subtitleCues(words) {
  const cues = [];
  for (const w of words) {
    const cue = cues.at(-1), text = cue ? `${cue.words.map((x) => x.word).join(' ')} ${w.word}` : '';
    if (cue && w.start - cue.words.at(-1).end <= 0.25 && cue.words.length < 4 && text.length <= 38) cue.words.push(w);
    else cues.push({ words: [w] });
  }
  return cues.map((c, i) => {
    const next = cues[i + 1], last = c.words.at(-1).end;
    return { start: c.words[0].start, end: next && next.words[0].start - last <= 0.6 ? next.words[0].start : last + 0.4, text: c.words.map((x) => x.word).join(' ') };
  });
}

/** Writes <base>.srt and <base>.vtt from words.json words. */
export function writeSubtitles(words, base) {
  const cues = subtitleCues(words);
  writeFileSync(`${base}.srt`, cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'));
  writeFileSync(`${base}.vtt`, `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`);
  return cues.length;
}

/** Audio tags: ElevenLabs-style [cues] inside VO lines — never shown or aligned, translated per TTS engine. */
export const TAG_RE = /\[([^\]\n]+)\]/g;
const tidy = (s) => s.replace(/\s+([,.!?;:…।॥])/gu, '$1').replace(/\s+/g, ' ').trim();

/** Narration without audio tags: what subtitles and alignment use. */
export function stripTags(text) {
  return tidy(text.replace(TAG_RE, ' '));
}

const PAUSES = { pause: 400, 'short pause': 250, 'long pause': 800 };
const OMNIVOICE_VOCAL = { laughing: 'laughter', laughs: 'laughter', chuckling: 'laughter', chuckles: 'laughter', sighing: 'sigh', sighs: 'sigh', gasping: 'surprise-ah', gasps: 'surprise-ah', scoffing: 'dissatisfaction-hnn', scoffs: 'dissatisfaction-hnn' };
const VOCAL = new Set([...Object.keys(OMNIVOICE_VOCAL), 'clears throat', 'coughing', 'sniffling', 'yawning', 'sharp exhale', 'humming', 'panting']);
const SFX = new Set(['keyboard typing', 'echoing', 'knocking on door', 'bell ringing', 'phone ringing', 'dog barking', 'crowd cheering', 'applause', 'rain falling', 'drum roll', 'heartbeat', 'engine starting']);
const LIVELY = new Set(['excited', 'angry', 'playful', 'menacing', 'shouting', 'cheerful', 'enthusiastic']);
const CALM = new Set(['weak', 'bored', 'tired', 'softly', 'whispering', 'whispers', 'slowly', 'sleepy drowsy voice', 'sad', 'calm']);

/** What an audio tag is: { kind: 'pause', ms } | { kind: 'vocal', omni? } | { kind: 'sfx' } | { kind: 'style' }. */
export function tagKind(tag) {
  const t = tag.trim().toLowerCase(), ms = t.match(/^pause\s+(\d+)\s*m?s$/);
  if (ms) return { kind: 'pause', ms: Number(ms[1]) };
  if (t in PAUSES) return { kind: 'pause', ms: PAUSES[t] };
  if (VOCAL.has(t)) return { kind: 'vocal', omni: OMNIVOICE_VOCAL[t] };
  if (SFX.has(t)) return { kind: 'sfx' };
  return { kind: 'style' };
}

/**
 * Translates a tagged line for one engine → { text, style, dropped }. elevenlabs keeps every tag; voicestudio gets
 * its [pause Nms] marker and OmniVoice's nonverbal tags; say gets [[slnc N]]; chatterbox and plain get "…" for
 * pauses. Emotion/delivery tags come back in `style` (only Chatterbox can act on them, as exaggeration).
 */
export function forEngine(text, engine) {
  const style = [], dropped = [];
  const out = text.replace(TAG_RE, (m, tag) => {
    if (engine === 'elevenlabs') return m;
    const k = tagKind(tag);
    if (k.kind === 'pause') return engine === 'voicestudio' ? ` [pause ${k.ms}ms] ` : engine === 'say' ? ` [[slnc ${k.ms}]] ` : '… ';
    if (k.kind === 'vocal' && engine === 'voicestudio' && k.omni) return ` [${k.omni}] `;
    (k.kind === 'style' ? style : dropped).push(tag.trim().toLowerCase());
    return ' ';
  });
  return { text: tidy(out), style, dropped };
}

/** Chatterbox exaggeration for a scene's style tags: livelier for excited/angry, calmer for tired/whispering. */
export function exaggerationFor(style, base = 0.5) {
  if (style.some((s) => LIVELY.has(s))) return 0.75;
  if (style.some((s) => CALM.has(s))) return 0.3;
  return base;
}

/** Personal pronunciation dictionaries, one per language, next to the config: <config dir>/pronounce/<lang>.json. */
export const PRONOUNCE_DIR = path.join(path.dirname(CONFIG_PATH), 'pronounce');

/** Pronunciation layers, weakest first: the skill's starter list for the language, yours, then the reel's. */
export function pronounceLayers(r, lang = r?.reel.language ?? CONFIG.language) {
  const layer = (source, file) => ({ source, file, map: existsSync(file) ? readJson(file) : {} });
  return [
    layer('starter', path.join(SKILL, 'pronounce', `${lang}.json`)),
    layer('personal', path.join(PRONOUNCE_DIR, `${lang}.json`)),
    ...(r ? [layer('reel', r.file('pronounce.json'))] : []),
  ];
}

/** The merged pronunciation map: starter < personal < the reel's pronounce.json. */
export function loadPronounce(r) {
  return Object.assign({}, ...pronounceLayers(r).map((l) => l.map));
}

const TOKEN_PARTS = /^([("'“‘]*)(.*?)([)"'”’.,!?;:…।॥]*)$/u;
const entry = (map, word) => map[word] ?? map[word.toLowerCase()];
/** A word's respelling; a hyphenated word without its own entry is respelled part by part ("twenty-seven"). */
const lookup = (map, word) => {
  const hit = entry(map, word);
  if (hit || !/\p{L}-\p{L}/u.test(word)) return hit;
  const parts = word.split('-').map((p) => entry(map, p));
  return parts.every(Boolean) ? parts.join(' ') : undefined;
};

/** Respells words for the voice only; leading/trailing punctuation is kept around the replacement. */
export function speakable(text, map) {
  return text
    .split(/(\s+)/)
    .map((tok) => {
      const m = tok.match(TOKEN_PARTS);
      if (!m || !m[2]) return tok;
      const hit = lookup(map, m[2]);
      return hit ? `${m[1]}${hit}${m[3]}` : tok;
    })
    .join('');
}

/** True when the narration is written in a non-Latin script (Hindi in Devanagari, Russian, …). */
export const nonLatin = (text) => /[\p{L}--\p{Script=Latin}]/v.test(text);

const LATIN_WORD = /^(?=.*\p{Script=Latin})[\p{Script=Latin}\d'’-]+$/u;
const bareWords = (text) => text.split(/\s+/).map((tok) => tok.match(TOKEN_PARTS)?.[2] ?? '');

/** Latin-script words of a non-Latin narration (tags removed) that no entry respells, lower-cased and unique. */
export function unrespelled(text, map) {
  if (!nonLatin(text)) return [];
  return [...new Set(bareWords(text).filter((w) => LATIN_WORD.test(w) && !lookup(map, w)).map((w) => w.toLowerCase()))];
}

/** Numerals with no respelling (70%, 8.5.12): voices read them unpredictably, so the script spells them out. */
export function numerals(text, map) {
  return [...new Set(bareWords(text).filter((w) => /\d/.test(w) && !LATIN_WORD.test(w) && !lookup(map, w)))];
}

/** The respellings speakable() applies to this text, as [word, respelling] pairs in order of first use. */
export function appliedFixes(text, map) {
  const fixes = new Map();
  for (const tok of text.split(/\s+/)) {
    const w = tok.match(TOKEN_PARTS)?.[2];
    if (w && lookup(map, w) && !fixes.has(w.toLowerCase())) fixes.set(w.toLowerCase(), lookup(map, w));
  }
  return [...fixes];
}

/** Keys a theme may set: the brand (handle, channel, follow CTA, channel logo) and the look; the rest stays global. */
export const THEME_KEYS = ['description', 'handle', 'channel', 'cta', 'channelLogo', 'palette', 'fonts', 'background', 'chrome', 'cards'];
export const BACKGROUND_STYLES = ['dots', 'grid', 'glow'];
/** Header/footer looks the chrome layer draws (theme key chrome.style); bar is the default. */
export const CHROME_STYLES = ['bar', 'card'];
export const CARD_STYLES = ['soft', 'hard'];
const PLACEHOLDER_ACCENT = '#9B5DE5';

/** Starter themes shipped as themes/<name>.json. */
export function starterThemes() {
  const dir = path.join(SKILL, 'themes');
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), readJson(path.join(dir, f))]));
}

/** A theme as a new reel gets it: your global brand and look, then the starter of that name, then your theme. */
export function resolveTheme(name = CONFIG.theme, themes = CONFIG.themes) {
  const starter = starterThemes()[name], mine = themes?.[name];
  if (!starter && !mine) throw new Error(`no theme "${name}"; node theme.mjs lists them`);
  const base = Object.fromEntries(THEME_KEYS.slice(1).map((k) => [k, CONFIG[k] ?? null]));
  return merge(merge(base, starter ?? {}), mine ?? {});
}

/** What is wrong with a resolved theme: errors block it (bad colour, style, missing file), warnings flag low contrast. */
export function checkTheme(t) {
  const errors = [], warnings = [], hex = /^#[0-9A-Fa-f]{6}$/, p = t.palette ?? {}, b = t.background ?? {};
  for (const k of ['bg', 'text', 'success', 'white']) if (!hex.test(p[k] ?? '')) errors.push(`palette.${k} must be #RRGGBB, got ${p[k]}`);
  if (p.accent !== 'topic' && !hex.test(p.accent ?? '')) errors.push(`palette.accent must be "topic" or #RRGGBB, got ${p.accent}`);
  if (p.surface != null && !hex.test(p.surface)) errors.push(`palette.surface must be #RRGGBB, got ${p.surface}`);
  if (t.chrome?.style != null && !CHROME_STYLES.includes(t.chrome.style)) errors.push(`chrome.style must be ${CHROME_STYLES.join(' | ')}, got ${t.chrome.style}`);
  if (!BACKGROUND_STYLES.includes(b.style)) errors.push(`background.style must be ${BACKGROUND_STYLES.join(' | ')}, got ${b.style}`);
  if (t.cards?.style != null && !CARD_STYLES.includes(t.cards.style)) errors.push(`cards.style must be ${CARD_STYLES.join(' | ')}, got ${t.cards.style}`);
  if (b.gradient != null && !hex.test(b.gradient)) errors.push(`background.gradient must be #RRGGBB, got ${b.gradient}`);
  for (const k of ['density', 'drift', 'glow', 'grain', 'vignette']) if (!(typeof b[k] === 'number' && b[k] >= 0)) errors.push(`background.${k} must be a number ≥ 0, got ${b[k]}`);
  for (const k of ['sans', 'mono']) if (!t.fonts?.[k] || !existsSync(configPath(t.fonts[k]))) errors.push(`fonts.${k} not found: ${t.fonts?.[k]}`);
  if (t.channelLogo && !/\.(png|jpe?g|webp)$/i.test(t.channelLogo)) errors.push(`channelLogo must be a PNG, JPG or WebP image, got ${t.channelLogo}`);
  else if (t.channelLogo && !existsSync(configPath(t.channelLogo))) errors.push(`channelLogo not found: ${t.channelLogo}`);
  if (!t.handle) errors.push('no handle: set one in the theme or globally (config.mjs set handle=@you)');
  if (!errors.length && contrast(p.text, p.bg) < 4.5) warnings.push(`text on bg is ${contrast(p.text, p.bg).toFixed(2)}:1; aim for 4.5:1`);
  if (!errors.length && b.gradient && contrast(p.text, b.gradient) < 4.5) warnings.push(`text on background.gradient is ${contrast(p.text, b.gradient).toFixed(2)}:1; aim for 4.5:1`);
  if (!errors.length && p.accent !== 'topic' && contrast(p.accent, p.bg) < 4.5) warnings.push(`accent on bg is ${contrast(p.accent, p.bg).toFixed(2)}:1; aim for 4.5:1 (a lighter tint: ${readableAccent(p.accent, p.bg)})`);
  return { errors, warnings };
}

/** Writes a theme's brand and look into a reel (reel.json, assets/channel-logo.png); a "topic" accent follows its logo. */
export function applyTheme(r, name) {
  const t = resolveTheme(name), { errors } = checkTheme(t);
  if (errors.length) throw new Error(`theme "${name}": ${errors.join('; ')}`);
  const topic = t.palette.accent === 'topic';
  const accent = !topic ? t.palette.accent : r.reel.logo ? readableAccent(r.reel.logo.hex, t.palette.bg) : PLACEHOLDER_ACCENT;
  Object.assign(r.reel, {
    theme: name, handle: t.handle, channel: t.channel, cta: t.cta, palette: { ...t.palette, accent },
    accentSource: topic ? 'topic' : 'theme', fonts: t.fonts, background: t.background, chrome: t.chrome ?? null, cards: t.cards ?? null, channelLogo: null,
  });
  if (t.channelLogo) {
    mkdirSync(r.file('assets'), { recursive: true });
    ffmpeg(['-i', configPath(t.channelLogo), '-vf', 'scale=256:256:force_original_aspect_ratio=increase,crop=256:256', '-frames:v', '1', r.file('assets/channel-logo.png')]);
    r.reel.channelLogo = 'assets/channel-logo.png';
  }
  return t;
}
