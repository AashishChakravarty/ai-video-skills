/**
 * new-reel.mjs: creates a reel folder with reel.json (the stage tracker), research.md, script.md and
 * pronounce.json from templates/reel, plus the audio/build/out/publish folders.
 *
 *   node new-reel.mjs "<topic>" [--slug elixir-concurrency] [--root ~/reels | --here] [--logo elixir]
 *
 * The folder is <root>/<slug>; root defaults to the config's reelsRoot, --here uses the current directory.
 * Needs a handle in the user config (node config.mjs set handle=@you).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, CONFIG_PATH, SKILL, expandHome, readJson, writeJson } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { slug: { type: 'string' }, root: { type: 'string' }, here: { type: 'boolean' }, logo: { type: 'string' } },
});
if (!CONFIG.handle) throw new Error(`no handle configured in ${CONFIG_PATH}; run: node config.mjs set handle=@yourhandle channel="Your Channel" language=en`);
const topic = positionals.join(' ').trim();
if (!topic) throw new Error('usage: node new-reel.mjs "<topic>" [--slug s] [--root dir | --here] [--logo simple-icons-slug]');

const slug = opt.slug ?? topic.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
if (!slug) throw new Error('could not derive a slug from the topic; pass --slug');
const root = opt.here ? process.cwd() : expandHome(opt.root ?? CONFIG.reelsRoot);
const dir = path.join(root, slug);
if (existsSync(path.join(dir, 'reel.json'))) throw new Error(`${dir} already has a reel.json; resume it instead`);

for (const sub of ['audio/takes', 'audio/samples', 'assets', 'build', 'out', 'publish']) mkdirSync(path.join(dir, sub), { recursive: true });

const palette = { ...CONFIG.palette, accent: '#9B5DE5' };
const reel = {
  slug,
  topic,
  title: topic,
  stage: 'script',
  createdAt: new Date().toISOString().slice(0, 10),
  gates: { script: null, audio: null, version: null },
  language: CONFIG.language,
  fps: CONFIG.fps,
  handle: CONFIG.handle,
  palette,
  logo: null,
  ticker: [],
  tts: { engine: CONFIG.tts.default, voice: null, settings: {} },
  audio: null,
  versions: {},
  publish: null,
};
writeJson(path.join(dir, 'reel.json'), reel);

if (opt.logo) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts/logo.mjs'), opt.logo, '--reel', dir], { stdio: 'inherit' });
  if (r.status !== 0) console.warn('logo lookup failed; run logo.mjs again with another slug');
}
Object.assign(palette, readJson(path.join(dir, 'reel.json')).palette);

const fill = (text) =>
  text
    .replaceAll('{{TOPIC}}', topic).replaceAll('{{TITLE}}', topic)
    .replaceAll('{{BG}}', palette.bg).replaceAll('{{ACCENT}}', palette.accent).replaceAll('{{SUCCESS}}', palette.success).replaceAll('{{TEXT}}', palette.text)
    .replaceAll('{{LOGO}}', opt.logo ?? '<simple-icons slug>').replaceAll('{{CTA_SPOKEN}}', CONFIG.cta.spoken)
    .replaceAll('{{LANGUAGE}}', CONFIG.language).replaceAll('{{VOICE_STYLE}}', CONFIG.voiceStyle).replaceAll('{{ONSCREEN}}', CONFIG.onScreenLanguage);
for (const name of ['research.md', 'script.md', 'pronounce.json']) {
  writeFileSync(path.join(dir, name), fill(readFileSync(path.join(SKILL, 'templates/reel', name), 'utf8')));
}

console.log(`created ${dir}`);
