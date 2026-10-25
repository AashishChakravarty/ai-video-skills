/**
 * script.mjs: script.md is the single source of the narration and the scene plan.
 *
 *   node script.mjs vo    [--reel dir]  writes vo.txt ([scene-id] blocks, audio tags removed — what subtitles and
 *                                       alignment use) and vo.tagged.txt (tags kept, for TTS) from each scene's VO:
 *                                       line, then the audio script below; prints word counts, an estimated duration,
 *                                       numerals to spell out and any Latin words a non-Latin narration has not
 *                                       respelled (pronounce.mjs)
 *   node script.mjs audio [--reel dir]  writes audio-script.txt (the whole narration with tags kept and pronunciation
 *                                       fixes applied, ready to paste into a TTS) and audio-script.md (that text for
 *                                       ElevenLabs, a plain copy for any other platform / a recording, per scene)
 *   node script.mjs time [--reel dir]   after align.py: resolves every @word / @{two words} beat to its
 *                                       spoken time, writing script.timed.md and anchors.json
 *
 * Scene headers look like `## S2 · PROCESSES · [processes]`; a beat token matches the next occurrence of
 * that word (punctuation and case ignored) in the same scene, searching forward from the previous beat.
 * The reel's own handle is never an anchor; write any other literal @ in on-screen text as \@. Each anchor also
 * records a label — the first "quoted" on-screen text after it on the line, else the word — for starter.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { CONFIG, SKILL, appliedFixes, forEngine, loadPronounce, loadReel, numerals, readJson, speakable, stripTags, unrespelled, writeJson } from './lib.mjs';

const WORDS_PER_SECOND = CONFIG.wordsPerSecond;

const HEAD = /^##\s+(.*?)\[([\w-]+)\]\s*$/;
const TOKEN = /(?<!\\)@\{([^}]+)\}|(?<!\\)@([^\s:;,()"]+)/g;

/** Normalises a word for matching: NFC, lower case, no punctuation (Latin, or Devanagari danda). */
export const norm = (w) => w.normalize('NFC').toLowerCase().replace(/[\s.,!?;:'"“”‘’…()\[\]\-–—।॥]/g, '');

/** Parses script.md into scenes: { id, title, vo, lines: [{ index, text }] } (lines = every line of the scene). */
export function parseScript(md) {
  const lines = md.split(/\r?\n/), scenes = [];
  lines.forEach((text, index) => {
    const head = text.match(HEAD);
    if (head) return scenes.push({ id: head[2], title: head[1].replace(/[·\s]+$/, ''), vo: '', lines: [] });
    const scene = scenes.at(-1);
    if (!scene) return;
    scene.lines.push({ index, text });
  });
  for (const scene of scenes) {
    const at = scene.lines.findIndex((l) => /^VO:/.test(l.text));
    if (at < 0) throw new Error(`script.md scene [${scene.id}] has no "VO:" line`);
    const vo = [scene.lines[at].text.replace(/^VO:\s*/, '')];
    for (let i = at + 1; i < scene.lines.length && scene.lines[i].text.trim() && !/^(- |Filler:)/.test(scene.lines[i].text); i++) vo.push(scene.lines[i].text.trim());
    scene.voTagged = vo.join(' ').replace(/\s+/g, ' ').trim();
    scene.vo = stripTags(scene.voTagged);
    if (!scene.vo || scene.vo.startsWith('<')) throw new Error(`script.md scene [${scene.id}] VO is still a placeholder`);
  }
  if (!scenes.length) throw new Error('script.md has no scene headers like "## S1 · HOOK · [hook]"');
  return scenes;
}

function writeVo(r) {
  const scenes = parseScript(readFileSync(r.file('script.md'), 'utf8'));
  writeFileSync(r.file('vo.txt'), `${scenes.map((s) => `[${s.id}]\n${s.vo}\n`).join('\n')}`);
  writeFileSync(r.file('vo.tagged.txt'), `${scenes.map((s) => `[${s.id}]\n${s.voTagged}\n`).join('\n')}`);
  let total = 0;
  for (const s of scenes) {
    const n = s.vo.split(/\s+/).length, tags = (s.voTagged.match(/\[[^\]]+\]/g) ?? []).length;
    total += n;
    console.log(`[${s.id}] ${n} words ≈ ${(n / WORDS_PER_SECOND).toFixed(1)}s${tags ? `, ${tags} audio tag${tags > 1 ? 's' : ''}` : ''}`);
  }
  console.log(`vo.txt: ${scenes.length} scenes, ${total} words ≈ ${(total / WORDS_PER_SECOND).toFixed(0)}s at ${WORDS_PER_SECOND} words/s`);
  const pron = loadPronounce(r), gaps = [...new Set(scenes.flatMap((s) => unrespelled(s.vo, pron)))];
  const digits = [...new Set(scenes.flatMap((s) => numerals(s.vo, pron)))];
  if (digits.length) console.log(`! ${digits.length} numeral(s) the voice may misread: ${digits.join(', ')}\n  write them as spoken words in VO: (70% → seventy percent, 8.5.12 → eight point five point twelve)`);
  if (gaps.length) console.log(`! ${gaps.length} Latin word(s) with no respelling will be read with an English accent: ${gaps.join(', ')}\n  respell them: node ${path.join(SKILL, 'scripts/pronounce.mjs')} set ${gaps.map((w) => `${w}=…`).join(' ')}`);
  writeAudioScript(r, scenes);
}

/** Splits words.json words into scenes by each scene's narration word count. */
function wordsByScene(words) {
  const out = new Map();
  let i = 0;
  for (const scene of words.scenes) {
    const n = scene.narration.split(/\s+/).filter(Boolean).length;
    out.set(scene.id, words.words.slice(i, i + n).map((w, k) => ({ ...w, index: i + k, key: norm(w.word) })));
    i += n;
  }
  if (i !== words.words.length) throw new Error(`words.json: scenes cover ${i} words but words[] has ${words.words.length}`);
  return out;
}

function findPhrase(list, phrase, from) {
  const keys = phrase.split(/\s+/).map(norm).filter(Boolean);
  const hit = (k) => keys.every((key, j) => list[k + j] && list[k + j].key === key);
  for (let k = from; k < list.length; k++) if (hit(k)) return k;
  for (let k = 0; k < from; k++) if (hit(k)) return k;
  return -1;
}

function timeScript(r) {
  const fps = r.reel.fps ?? 30;
  const md = readFileSync(r.file('script.md'), 'utf8');
  const scenes = parseScript(md);
  const words = readJson(r.file('words.json'));
  const byScene = wordsByScene(words);
  const out = md.split(/\r?\n/), anchors = [], missing = [];
  for (const scene of scenes) {
    const list = byScene.get(scene.id);
    if (!list) throw new Error(`script.md scene [${scene.id}] is not in words.json; re-run script.mjs vo, TTS and align`);
    const spoken = words.scenes.find((s) => s.id === scene.id).narration;
    if (norm(spoken) !== norm(scene.vo)) throw new Error(`[${scene.id}] VO in script.md differs from the aligned narration; re-run vo → tts → align`);
    let cursor = 0;
    for (const line of scene.lines) {
      if (/^VO:/.test(line.text)) continue;
      const hits = [...line.text.matchAll(TOKEN)];
      let n = 0;
      out[line.index] = line.text.replace(TOKEN, (m, phrase, word, offset) => {
        const text = phrase ?? word, next = hits[++n]?.index ?? line.text.length;
        const label = line.text.slice(offset + m.length, next).match(/"([^"]+)"/)?.[1] ?? text.replace(/[.,!?;:…।॥]+$/u, '').toUpperCase();
        if (`@${text}` === r.reel.handle) return m;
        const k = findPhrase(list, text, cursor);
        if (k < 0) {
          missing.push(`[${scene.id}] ${m}`);
          return m;
        }
        cursor = k + 1;
        const w = list[k];
        anchors.push({ scene: scene.id, token: text, word: w.word, index: w.index, t: w.start, frame: Math.round(w.start * fps), label });
        return `${w.start.toFixed(2)} "${text}"`;
      }).replaceAll('\\@', '@');
    }
  }
  if (missing.length) throw new Error(`anchors not found in their scene's narration:\n  ${missing.join('\n  ')}`);
  const frames = Math.ceil(words.duration * fps);
  out.splice(1, 0, '', `Audio: ${words.audio} (${words.duration}s) → TOTAL_FRAMES = ${frames} at ${fps}fps. Timing: words.json (frame = round(t × ${fps})).`);
  writeFileSync(r.file('script.timed.md'), out.join('\n'));
  writeJson(r.file('anchors.json'), anchors);
  console.log(`script.timed.md: ${anchors.length} anchors resolved across ${scenes.length} scenes; TOTAL_FRAMES ${frames}`);
}

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' } } });
/** audio-script.txt and audio-script.md: the narration for ElevenLabs or any TTS (tags kept), and for other platforms or a recording. */
function writeAudioScript(r, scenes = parseScript(readFileSync(r.file('script.md'), 'utf8'))) {
  const pron = loadPronounce(r), lang = r.reel.language ?? CONFIG.language;
  const tagged = scenes.map((s) => ({ id: s.id, eleven: speakable(s.voTagged, pron), plain: forEngine(speakable(s.voTagged, pron), 'plain'), words: s.vo.split(/\s+/).length }));
  const seconds = tagged.reduce((n, s) => n + s.words, 0) / WORDS_PER_SECOND;
  const styles = tagged.filter((s) => s.plain.style.length).map((s) => `${s.id}: ${s.plain.style.join(', ')}`);
  const fixes = appliedFixes(scenes.map((s) => s.vo).join(' '), pron).map(([a, b]) => `${a} → ${b}`);
  const tts = path.join(SKILL, 'scripts/tts.mjs');
  const md = [
    `# Audio script — ${r.reel.title}`,
    '',
    `Language: ${lang} · ≈ ${Math.round(seconds)} s · ${scenes.length} scenes · style: ${CONFIG.voiceStyle}`,
    `Pronunciation fixes applied: ${fixes.length ? fixes.join(', ') : 'none'} (pronounce.mjs)`,
    '',
    '## ElevenLabs (Eleven v3 — keeps the audio tags)',
    '',
    `Paste as one generation (the same text is in audio-script.txt); blank lines separate scenes. Model **Eleven v3**, language **${lang}**, then download the MP3.`,
    '',
    '```text',
    tagged.map((s) => s.eleven).join('\n\n'),
    '```',
    '',
    '## Any other platform, or recording yourself (tags removed, pauses as "…")',
    '',
    'Sarvam Bulbul, Google Gemini TTS, OpenAI TTS, Azure Speech, VoiceStudio\'s app, or read it aloud. Where the',
    `platform has a style or instructions field, describe the delivery there instead of tags${styles.length ? `: ${styles.join('; ')}` : ''}.`,
    '',
    '```text',
    tagged.map((s) => s.plain.text).join('\n\n'),
    '```',
    '',
    '## Per scene (platforms with length limits, or redoing one scene)',
    '',
    '| Scene | Narration (tagged) | ≈ s |',
    '|---|---|---|',
    ...tagged.map((s) => `| ${s.id} | ${s.eleven.replaceAll('|', '\\|')} | ${(s.words / WORDS_PER_SECOND).toFixed(1)} |`),
    '',
    '## Bring the audio back',
    '',
    `One file for the whole reel: \`node ${tts} --engine file --input <file> --reel ${r.dir}\``,
    `One file per scene: \`node ${tts} --engine file --scene <id> --input <file> --reel ${r.dir}\` for each scene; it stitches once every scene has a take.`,
    '',
  ].join('\n');
  writeFileSync(r.file('audio-script.md'), md);
  writeFileSync(r.file('audio-script.txt'), `${tagged.map((s) => s.eleven).join('\n\n')}\n`);
  console.log(`audio-script.txt + .md: ${scenes.length} scenes, ≈ ${Math.round(seconds)} s${styles.length ? `, style tags: ${styles.join('; ')}` : ''}`);
}

const r = loadReel(opt.reel);
if (positionals[0] === 'vo') writeVo(r);
else if (positionals[0] === 'time') timeScript(r);
else if (positionals[0] === 'audio') writeAudioScript(r);
else throw new Error('usage: node script.mjs vo|audio|time [--reel dir]');
