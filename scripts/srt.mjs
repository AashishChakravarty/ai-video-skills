/**
 * srt.mjs: SRT and WebVTT subtitle files from words.json (the script's exact spelling), for YouTube, LinkedIn
 * and any platform that takes a caption upload.
 *
 *   node srt.mjs [--reel dir] [--out publish/captions]
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadReel, readJson, writeSubtitles } from './lib.mjs';

const { values: opt } = parseArgs({ options: { reel: { type: 'string' }, out: { type: 'string' } } });
const r = loadReel(opt.reel);
const base = path.resolve(opt.out ?? r.file('publish/captions'));
mkdirSync(path.dirname(base), { recursive: true });
const n = writeSubtitles(readJson(r.file('words.json')).words, base);
console.log(`wrote ${path.relative(r.dir, base)}.srt and .vtt (${n} cues)`);
