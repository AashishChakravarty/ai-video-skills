/**
 * tts.mjs: makes the reel's voice-over from vo.txt, one take per scene, then stitches the takes into
 * audio/vo.wav (48 kHz mono, -16 LUFS) and records it in reel.json. Pronunciation entries (pronounce.mjs: starter
 * list, your dictionary, the reel's pronounce.json) respell words for the voice only ({"data": "डाटा"}); subtitles
 * keep the script's spelling. --voice and --instruct default to the config's tts.* voice and tts.instruct. Audio tags in the narration
 * (vo.tagged.txt) are translated per engine (lib.mjs forEngine); emotion tags drive Chatterbox's exaggeration.
 *
 *   node tts.mjs --engine voicestudio|chatterbox|say [--voice id|ref.wav|SayVoice] [--sample] [--scene id …]
 *                [--speed 1] [--seed 7] [--quality 16] [--instruct "indian accent"] [--gap 0.35] [--tail 1.5]
 *   node tts.mjs --engine file --input my-recording.m4a           (whole reel, e.g. an ElevenLabs export)
 *   node tts.mjs --engine file --scene hook --input hook.mp3      (one scene; stitches once all scenes have takes)
 *   node tts.mjs --engine voicestudio|say --voices
 *
 * --sample renders only the opening sentence to audio/samples/<engine>-<voice>[-<instruct>]-x<speed>-s<seed>.wav for
 * picking a voice; --scene re-takes just those scenes and re-stitches. --tail pads silence after the last word so the
 * end card can hold. --speed defaults to the config's tts.speed. VoiceStudio is the local OmniVoice app (opened if not
 * running); a --voice that is an audio file clones that voice on the fly (VoiceStudio and Chatterbox).
 * Stitching cuts a take's leading stall (a faint breath, then a pause before the first word), prints each scene's
 * length and its pauses of 0.3 s or more, and the measured speaking rate against the config's wordsPerSecond.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, SKILL, exaggerationFor, ffmpeg, forEngine, loadPronounce, loadReel, loudness, normalize, parseVo, probeDuration, run, speakable } from './lib.mjs';

const { values: opt } = parseArgs({
  options: {
    engine: { type: 'string', default: CONFIG.tts.default },
    voice: { type: 'string' },
    sample: { type: 'boolean' },
    scene: { type: 'string', multiple: true },
    input: { type: 'string' },
    speed: { type: 'string', default: String(CONFIG.tts.speed ?? 1) },
    seed: { type: 'string', default: '7' },
    quality: { type: 'string', default: '16' },
    instruct: { type: 'string' },
    gap: { type: 'string', default: '0.35' },
    tail: { type: 'string', default: '1.5' },
    voices: { type: 'boolean' },
    reel: { type: 'string' },
  },
});

const r = opt.voices && !opt.reel ? null : loadReel(opt.reel);
const VS = (process.env.OMNIVOICE_API_URL || CONFIG.tts.voicestudioUrl).replace(/\/$/, '');
const instruct = opt.instruct ?? (opt.engine === 'voicestudio' ? CONFIG.tts.instruct : null) ?? null;
const isFile = (v) => v && existsSync(v) && /\.(wav|mp3|m4a|flac|aiff?|ogg|webm)$/i.test(v);
const slug = (s) => String(s ?? 'default').replace(/[^\w.-]+/g, '-').slice(0, 40);

async function voicestudioUp() {
  const ok = async () => {
    try {
      return (await fetch(`${VS}/health`, { signal: AbortSignal.timeout(3000) })).ok;
    } catch {
      return false;
    }
  };
  if (await ok()) return;
  console.log('VoiceStudio is not running; opening it…');
  spawnSync('open', ['-a', 'VoiceStudio']);
  for (let i = 0; i < 90; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    if (await ok()) return;
  }
  throw new Error(`VoiceStudio backend did not answer at ${VS}/health within 3 minutes; open the app and load the OmniVoice model`);
}

/** Cuts a 6–10 s passage from a recording and transcribes it, cached in audio/refs/ (clone reference). */
function prepRef(file, key) {
  const out = r.file(`audio/refs/${key}.wav`), meta = `${out}.json`;
  if (existsSync(meta)) return JSON.parse(readFileSync(meta, 'utf8'));
  mkdirSync(r.file('audio/refs'), { recursive: true });
  console.log(`preparing a clone reference from ${path.basename(file)}…`);
  const json = run('uv', ['run', path.join(SKILL, 'scripts/tts/prep_ref.py'), '--audio', file, '--out', out, '--lang', r.reel.language ?? CONFIG.language]).trim().split('\n').at(-1);
  writeFileSync(meta, json);
  return JSON.parse(json);
}

let preparedRef = null;
const refPrepared = (voice) => existsSync(r.file(`audio/refs/${slug(voice)}.wav.json`));

/** The clone reference for a voice: a recording on disk, or a saved VoiceStudio clone's own clip downloaded. */
async function cloneRef(voice) {
  if (preparedRef) return preparedRef;
  if (isFile(voice)) return (preparedRef = prepRef(voice, slug(path.basename(voice, path.extname(voice)))));
  const full = r.file(`audio/refs/${slug(voice)}-full.audio`);
  if (!refPrepared(voice)) {
    mkdirSync(r.file('audio/refs'), { recursive: true });
    const res = await fetch(`${VS}/profiles/${voice}/audio`);
    if (!res.ok) throw new Error(`could not download VoiceStudio voice ${voice}'s reference (${res.status})`);
    writeFileSync(full, Buffer.from(await res.arrayBuffer()));
  }
  return (preparedRef = prepRef(full, slug(voice)));
}

async function voicestudioTake(text, out) {
  const voice = opt.voice ?? CONFIG.tts.voicestudioProfile;
  const send = async (ref, retries = 3) => {
    const form = new FormData();
    form.set('text', text);
    form.set('language', r.reel.language ?? CONFIG.language);
    form.set('speed', opt.speed);
    form.set('num_step', opt.quality);
    form.set('seed', opt.seed);
    if (instruct) form.set('instruct', instruct);
    if (ref) {
      form.set('ref_audio', new Blob([readFileSync(ref.audio)]), path.basename(ref.audio));
      form.set('ref_text', ref.text);
    } else if (voice) form.set('profile_id', voice);
    try {
      return await fetch(`${VS}/generate`, { method: 'POST', body: form, signal: AbortSignal.timeout(15 * 60 * 1000) });
    } catch (err) {
      // Keep-alive sockets the backend closed during a long reference prep fail with EPIPE; each retry discards one.
      if (!retries || err.name === 'TimeoutError') throw err;
      return send(ref, retries - 1);
    }
  };
  // A clone already cut and transcribed for this reel skips the profile request VoiceStudio would reject (and can crash on).
  let res = await send(isFile(voice) || (voice && refPrepared(voice)) ? await cloneRef(voice) : preparedRef);
  if (!res.ok) {
    const detail = await res.text();
    // A clone saved from a long clip needs a speech-to-text model in VoiceStudio; cut and transcribe it here instead.
    if (!voice || isFile(voice) || !/clone_ref_too_long|reference transcription/.test(detail)) throw new Error(`VoiceStudio /generate ${res.status}: ${detail.slice(0, 500)}`);
    res = await send(await cloneRef(voice));
    if (!res.ok) throw new Error(`VoiceStudio /generate ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const raw = `${out}.raw`;
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  ffmpeg(['-i', raw, '-ac', '1', '-ar', '48000', out]);
  rmSync(raw);
}

/** macOS voices for a language code ("hi" → hi_IN voices such as Lekha), from `say -v ?`. */
function sayVoices(lang) {
  if (process.platform !== 'darwin') throw new Error('--engine say needs macOS; use voicestudio, chatterbox or file');
  return spawnSync('say', ['-v', '?'], { encoding: 'utf8' }).stdout.split('\n')
    .map((l) => l.match(/^(.+?)\s+([a-z]{2,3})_[A-Z]{2,3}\s+#/))
    .filter((m) => m && m[2] === lang)
    .map((m) => m[1].trim())
    .filter((name, i, all) => all.indexOf(name) === i)
    .sort((a, b) => rank(a) - rank(b));
}

const PREFERRED_SAY = ['Samantha', 'Daniel', 'Karen', 'Moira', 'Rishi', 'Lekha'];
const rank = (name) => {
  const i = PREFERRED_SAY.findIndex((p) => name.startsWith(p));
  return i < 0 ? PREFERRED_SAY.length : i;
};

function sayTake(text, out) {
  const aiff = `${out}.aiff`;
  const voice = opt.voice ?? CONFIG.tts.sayVoice ?? sayVoices(r.reel.language ?? CONFIG.language)[0];
  if (!voice) throw new Error(`no macOS voice for language "${r.reel.language}"; add one in System Settings → Accessibility → Spoken Content, or pass --voice`);
  spawnSync('say', ['-v', voice, '-o', aiff, text], { stdio: 'inherit' });
  ffmpeg(['-i', aiff, '-ac', '1', '-ar', '48000', out]);
  rmSync(aiff);
}

function chatterboxTakes(jobs) {
  const file = r.file('audio/takes/jobs.json');
  writeFileSync(file, JSON.stringify(jobs, null, 2));
  const args = ['run', path.join(SKILL, 'scripts/tts/tts_chatterbox.py'), '--jobs', file, '--lang', r.reel.language ?? CONFIG.language, '--seed', opt.seed];
  const voice = opt.voice ?? CONFIG.tts.chatterboxRef;
  if (voice) {
    if (!isFile(voice)) throw new Error(`chatterbox --voice must be an audio file to clone, got "${voice}"`);
    args.push('--ref', prepRef(voice, slug(path.basename(voice, path.extname(voice)))).audio);
  }
  return new Promise((res, rej) => spawn('uv', args, { stdio: 'inherit' }).on('exit', (c) => (c ? rej(new Error(`chatterbox exited ${c}`)) : res())));
}

/** Translates each job's tagged text for the engine, reports tags it cannot voice, then renders the takes. */
async function render(raw) {
  const jobs = raw.map((job) => {
    const t = forEngine(job.text, opt.engine);
    // Only Chatterbox can act on emotion tags (as exaggeration); OmniVoice's instruct is voice design, not emotion.
    const unvoiced = opt.engine === 'chatterbox' ? t.dropped : [...t.style, ...t.dropped];
    if (unvoiced.length) console.log(`${opt.engine}: [${job.id}] cannot voice ${unvoiced.map((d) => `[${d}]`).join(' ')} — delivery follows punctuation; add sound effects as SFX cues`);
    return { id: job.id, out: job.out, text: t.text, exaggeration: exaggerationFor(t.style) };
  });
  if (opt.engine === 'chatterbox') return chatterboxTakes(jobs);
  if (opt.engine === 'voicestudio') await voicestudioUp();
  for (const job of jobs) {
    process.stdout.write(`${opt.engine}: [${job.id}] ${job.text.slice(0, 60)}…\n`);
    if (opt.engine === 'voicestudio') await voicestudioTake(job.text, job.out);
    else if (opt.engine === 'say') sayTake(job.text, job.out);
    else throw new Error(`unknown --engine ${opt.engine}; use voicestudio, chatterbox, say or file`);
  }
}

/** Silences of at least `min` seconds in an audio file (below -38 dB), as [start, end] pairs in seconds. */
function silences(file, min) {
  const err = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=-38dB:d=${min}`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return [...err.matchAll(/silence_start: (-?[\d.]+)/g)].map((m, i) => [Math.max(0, Number(m[1])), ends[i] ?? probeDuration(file)]);
}

/** Peak level (dBFS) of the first `secs` seconds of a file. */
function peakDb(file, secs) {
  const err = spawnSync('ffmpeg', ['-hide_banner', '-t', String(secs), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return Number(err.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -99);
}

/**
 * Cuts a take's leading stall: a faint breath or click, then a pause before the first word. The edge trim keeps it
 * because the breath is louder than its threshold, and stitched between scenes it sounds like a stop. Only sound
 * quieter than -30 dB counts as a breath, so a short spoken word followed by a pause is never cut. Returns the cut.
 */
function trimLeadingStall(file) {
  const lead = silences(file, 0.25).find(([s, e]) => s < 0.5 && e < 1.5);
  if (!lead || (lead[0] > 0.02 && peakDb(file, lead[0]) > -30)) return 0;
  const cut = Math.max(0, lead[1] - 0.04), tmp = file.replace(/\.wav$/, '.trim.wav');
  ffmpeg(['-ss', cut.toFixed(3), '-i', file, '-af', 'afade=t=in:d=0.03', tmp]);
  renameSync(tmp, file);
  return cut;
}

/** Prints each scene's length, any stall cut and its inner pauses, then the speaking rate against wordsPerSecond. */
function reportTakes(scenes, takes) {
  let words = 0, speech = 0;
  scenes.forEach((s, i) => {
    const cut = trimLeadingStall(takes[i]), d = probeDuration(takes[i]);
    const inner = silences(takes[i], 0.3).filter(([a, b]) => a > 0.05 && b < d - 0.05);
    words += s.text.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    speech += d;
    const notes = [cut ? `cut a ${cut.toFixed(2)}s stall before the first word` : '', inner.length ? `pauses ${inner.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}s`).join(', ')}` : ''].filter(Boolean);
    console.log(`  [${s.id}] ${d.toFixed(2)}s${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
  });
  const rate = words / speech, set = CONFIG.wordsPerSecond;
  console.log(`speaking rate ${rate.toFixed(2)} words/s (config wordsPerSecond ${set})${Math.abs(rate - set) > 0.2 ? `: node config.mjs set wordsPerSecond=${rate.toFixed(2)} makes script.mjs estimates match this voice` : ''}`);
  console.log('a pause of 0.3 s or more inside a scene sounds like a stop; if one is unwanted, re-take that scene with another --seed');
}

/** Trims each take's edge silence, joins them with --gap seconds between scenes and normalises to -16 LUFS. */
function stitch(scenes) {
  const takes = scenes.map((s) => r.file(`audio/takes/${s.id}.wav`));
  const missing = takes.filter((t) => !existsSync(t));
  if (missing.length) throw new Error(`missing takes: ${missing.map((m) => path.basename(m)).join(', ')}; render them with --scene`);
  reportTakes(scenes, takes);
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse';
  const parts = takes.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,${trim}[t${i}]`);
  const chain = takes.map((_, i) => `[t${i}]${i < takes.length - 1 ? `[g${i}]` : ''}`).join('');
  const gaps = takes.slice(0, -1).map((_, i) => `aevalsrc=0:d=${opt.gap}:s=48000[g${i}]`);
  const joined = r.file('audio/vo.joined.wav');
  ffmpeg([...takes.flatMap((t) => ['-i', t]), '-filter_complex', [...parts, ...gaps, `${chain}concat=n=${takes.length * 2 - 1}:v=0:a=1,apad=pad_dur=${opt.tail}[out]`].join(';'), '-map', '[out]', joined]);
  normalize(joined, r.file('audio/vo.wav'), { target: -16, channels: 1 });
  rmSync(joined);
}

function record(settings) {
  const duration = probeDuration(r.file('audio/vo.wav'));
  r.reel.tts = { engine: opt.engine, voice: opt.voice ?? null, settings };
  r.reel.audio = { vo: 'audio/vo.wav', duration: Number(duration.toFixed(3)), frames: Math.ceil(duration * (r.reel.fps ?? 30)) };
  r.reel.stage = 'audio';
  r.save();
  const l = loudness(r.file('audio/vo.wav'));
  console.log(`audio/vo.wav: ${duration.toFixed(3)}s → ${r.reel.audio.frames} frames, ${l.lufs} LUFS, peak ${l.peak} dBTP`);
}

if (opt.voices) {
  if (opt.engine === 'voicestudio') {
    await voicestudioUp();
    const profiles = await (await fetch(`${VS}/profiles`)).json();
    for (const p of profiles) console.log(`${String(p.id).padEnd(38)} ${p.name ?? ''}  (${p.type ?? p.kind ?? 'voice'}${p.language ? `, ${p.language}` : ''})`);
    if (!profiles.length) console.log('no saved voices; pass --voice <ref.wav> to clone, or omit --voice for the default');
  } else if (opt.engine === 'say') {
    const lang = r?.reel.language ?? CONFIG.language;
    console.log(sayVoices(lang).join('\n') || `no macOS voices for "${lang}"`);
  } else console.log('chatterbox has one default voice; pass --voice <clean 5–15s clip.wav> to clone any voice');
  process.exit(0);
}

const EDGE_TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse';

if (!existsSync(r.file('vo.txt'))) throw new Error('vo.txt missing; run node script.mjs vo first');
const scenes = parseVo(readFileSync(r.file(existsSync(r.file('vo.tagged.txt')) ? 'vo.tagged.txt' : 'vo.txt'), 'utf8'));
const pron = loadPronounce(r);

if (opt.engine === 'file') {
  if (!opt.input || !existsSync(opt.input)) throw new Error('--engine file needs --input <audio file>');
  if (opt.scene?.length) {
    if (opt.scene.length > 1 || !scenes.some((s) => s.id === opt.scene[0])) throw new Error(`--scene takes one scene id: ${scenes.map((s) => s.id).join(', ')}`);
    ffmpeg(['-i', opt.input, '-ac', '1', '-ar', '48000', r.file(`audio/takes/${opt.scene[0]}.wav`)]);
    const missing = scenes.filter((s) => !existsSync(r.file(`audio/takes/${s.id}.wav`))).map((s) => s.id);
    if (missing.length) {
      console.log(`take for [${opt.scene[0]}] saved; still needed: ${missing.join(', ')}`);
      process.exit(0);
    }
    stitch(scenes);
  } else {
    const trimmed = r.file('audio/vo.import.wav');
    ffmpeg(['-i', opt.input, '-af', `${EDGE_TRIM},apad=pad_dur=${opt.tail}`, '-ac', '1', '-ar', '48000', trimmed]);
    normalize(trimmed, r.file('audio/vo.wav'), { target: -16, channels: 1 });
    rmSync(trimmed);
  }
  record({ input: path.resolve(opt.input) });
  process.exit(0);
}
const settings = { speed: Number(opt.speed), seed: Number(opt.seed), quality: Number(opt.quality), instruct, gap: Number(opt.gap), tail: Number(opt.tail) };

if (opt.sample) {
  const sentences = scenes[0].text.match(/[^।?!]+[।?!]*/gu) ?? [scenes[0].text];
  let first = '';
  for (const s of sentences) if (first.split(/\s+/).filter(Boolean).length < 10) first += s;
  const out = r.file(`audio/samples/${opt.engine}-${slug(opt.voice && path.basename(opt.voice))}${instruct ? `-${slug(instruct)}` : ''}-x${opt.speed}-s${opt.seed}.wav`);
  mkdirSync(path.dirname(out), { recursive: true });
  await render([{ id: 'sample', text: speakable(first.trim(), pron), out }]);
  console.log(`sample: ${out} (${probeDuration(out).toFixed(2)}s)`);
  process.exit(0);
}

const wanted = opt.scene?.length ? scenes.filter((s) => opt.scene.includes(s.id)) : scenes;
if (opt.scene?.length && wanted.length !== opt.scene.length) throw new Error(`unknown --scene; scenes are ${scenes.map((s) => s.id).join(', ')}`);
await render(wanted.map((s) => ({ id: s.id, text: speakable(s.text, pron), out: r.file(`audio/takes/${s.id}.wav`) })));
stitch(scenes);
record(settings);
