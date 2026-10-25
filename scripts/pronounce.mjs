/**
 * pronounce.mjs: how the voice says words the narration writes in another script. English tech terms in a Hindi
 * voice-over are respelled in Devanagari as the audience says them ("data" → "डाटा"), so the voice doesn't read
 * them with an English accent. Entries come from three layers, later ones winning: the skill's starter list
 * (pronounce/<lang>.json), your dictionary (~/.config/ai-video-skills/pronounce/<lang>.json, shared by every reel) and
 * the reel's pronounce.json. The voice reads the respelling; subtitles keep the script's spelling.
 *
 *   node pronounce.mjs [--reel dir]                   Latin words in the narration with no respelling, per scene
 *   node pronounce.mjs set data=डाटा "genserver=जेन सर्वर" [--reel-only]   saves to the reel and your dictionary
 *   node pronounce.mjs unset data [--reel-only]       removes from the reel and your dictionary
 *   node pronounce.mjs list [--reel dir]              the respellings this narration uses, and where each comes from
 *
 * Keys are stored lower-case and match any capitalisation. Outside a reel folder set/unset/list work on your
 * dictionary for the configured language (or --lang).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, appliedFixes, loadPronounce, loadReel, nonLatin, parseVo, pronounceLayers, readJson, unrespelled, writeJson } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { reel: { type: 'string' }, lang: { type: 'string' }, 'reel-only': { type: 'boolean' } },
});
const [command = 'check', ...pairs] = positionals;

let r = null;
try {
  r = loadReel(opt.reel);
} catch (err) {
  if (opt.reel || command === 'check') throw err;
}
const lang = opt.lang ?? r?.reel.language ?? CONFIG.language;
const layers = pronounceLayers(r, lang);
const personal = layers.find((l) => l.source === 'personal').file;
const short = (file) => file.replace(os.homedir(), '~');

function narration() {
  if (!existsSync(r.file('vo.txt'))) throw new Error('vo.txt missing; run node script.mjs vo first');
  return parseVo(readFileSync(r.file('vo.txt'), 'utf8'));
}

function save(update) {
  const files = [...(r ? [r.file('pronounce.json')] : []), ...(opt['reel-only'] ? [] : [personal])];
  for (const file of files) {
    const map = existsSync(file) ? readJson(file) : {};
    update(map);
    mkdirSync(path.dirname(file), { recursive: true });
    writeJson(file, Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))));
  }
  return files.map(short).join(' and ');
}

if (command === 'check') {
  const scenes = narration(), map = loadPronounce(r);
  if (!scenes.some((s) => nonLatin(s.text))) {
    console.log('narration is in Latin script: nothing to respell (pronounce.json can still fix single words)');
    process.exit(0);
  }
  const missing = new Set();
  for (const s of scenes) {
    const words = unrespelled(s.text, map);
    words.forEach((w) => missing.add(w));
    if (words.length) console.log(`[${s.id}] ${words.join(', ')}`);
  }
  const used = appliedFixes(scenes.map((s) => s.text).join(' '), map).length;
  if (!missing.size) console.log(`pronunciation: every Latin word is respelled (${used} respellings in use, ${lang})`);
  else console.log(`\n${missing.size} word(s) will be read with an English accent (${used} already respelled). Respell them as your audience says them:\n  node ${process.argv[1]} set ${[...missing].map((w) => `${w}=…`).join(' ')}`);
} else if (command === 'set') {
  const entries = pairs.map((p) => {
    const i = p.indexOf('=');
    if (i < 1 || !p.slice(i + 1).trim()) throw new Error(`expected word=respelling, got "${p}"`);
    return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()];
  });
  if (!entries.length) throw new Error('nothing to set: node pronounce.mjs set data=डाटा');
  const where = save((map) => entries.forEach(([k, v]) => (map[k] = v)));
  console.log(`pronounce: ${entries.map(([k, v]) => `${k} → ${v}`).join(', ')} saved to ${where}`);
} else if (command === 'unset') {
  if (!pairs.length) throw new Error('nothing to unset: node pronounce.mjs unset data');
  const where = save((map) => pairs.forEach((k) => {
    delete map[k];
    delete map[k.toLowerCase()];
  }));
  console.log(`pronounce: removed ${pairs.join(', ')} from ${where}`);
  const starter = layers[0].map;
  const kept = pairs.filter((k) => starter[k.toLowerCase()]);
  if (kept.length) console.log(`  still respelled by the starter list: ${kept.map((k) => `${k} → ${starter[k.toLowerCase()]}`).join(', ')}; set your own to override`);
} else if (command === 'list') {
  const map = loadPronounce(r);
  const pairsInUse = r ? appliedFixes(narration().map((s) => s.text).join(' '), map) : Object.entries(layers[1].map);
  const source = (w) => [...layers].reverse().find((l) => Object.keys(l.map).some((k) => k.toLowerCase() === w))?.source ?? '?';
  for (const [w, v] of pairsInUse) console.log(`${w.padEnd(18)} → ${v.padEnd(16)} ${r ? source(w) : 'personal'}`);
  console.log(`${pairsInUse.length} respelling(s) · dictionaries: ${layers.map((l) => `${l.source} ${short(l.file)}${existsSync(l.file) ? '' : ' (none yet)'}`).join(' · ')}`);
} else {
  throw new Error(`unknown command "${command}"; use check, set, unset or list`);
}
