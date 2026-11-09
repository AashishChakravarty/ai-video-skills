/**
 * new-reel.mjs: creates a reel folder with reel.json (the stage tracker), research.md, script.md and
 * pronounce.json from templates/reel, plus the audio/build/out/publish folders.
 *
 *   node new-reel.mjs "<topic>" [--slug elixir-concurrency] [--root ~/reels | --here] [--logo elixir] [--theme midnight] [--fast | --carousel]
 *
 * The folder is <root>/<slug>; root defaults to the config's reelsRoot, --here uses the current directory.
 * The reel keeps a copy of the theme's brand and look (default: the config's theme; theme.mjs lists them), so
 * later edits to the theme don't change it. Needs a handle in the theme or the user config (config.mjs set handle=@you).
 * --fast starts from the 5-scene fast-mode script (templates/reel/script.fast.md: ready-made library scenes) and
 * marks the reel `fast: true`. --carousel makes an Instagram carousel instead (`kind: "carousel"`, stage `slides`):
 * research.md and slides.html (templates/carousel), rendered by carousel.mjs; no script, voice or build folders.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, SKILL, applyTheme, checkTheme, expandHome, loadReel, readJson, resolveTheme, writeJson } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { slug: { type: 'string' }, root: { type: 'string' }, here: { type: 'boolean' }, logo: { type: 'string' }, theme: { type: 'string' }, fast: { type: 'boolean' }, carousel: { type: 'boolean' } },
});
const themeName = opt.theme ?? CONFIG.theme, theme = resolveTheme(themeName), { errors } = checkTheme(theme);
if (errors.length) throw new Error(`theme "${themeName}": ${errors.join('; ')}`);
const topic = positionals.join(' ').trim();
if (!topic) throw new Error('usage: node new-reel.mjs "<topic>" [--slug s] [--root dir | --here] [--logo simple-icons-slug] [--theme name] [--fast | --carousel]');
if (opt.fast && opt.carousel) throw new Error('--fast is for reels; a carousel has no fast mode');

const slug = opt.slug ?? topic.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
if (!slug) throw new Error('could not derive a slug from the topic; pass --slug');
const root = opt.here ? process.cwd() : expandHome(opt.root ?? CONFIG.reelsRoot);
const dir = path.join(root, slug);
if (existsSync(path.join(dir, 'reel.json'))) throw new Error(`${dir} already has a reel.json; resume it instead`);

const subs = opt.carousel ? ['assets', 'out', 'publish'] : ['audio/takes', 'audio/samples', 'assets', 'build', 'out', 'publish'];
for (const sub of subs) mkdirSync(path.join(dir, sub), { recursive: true });

const reel = {
  slug,
  topic,
  title: topic,
  kind: opt.carousel ? 'carousel' : 'reel',
  stage: opt.carousel ? 'slides' : 'script',
  fast: Boolean(opt.fast),
  createdAt: new Date().toISOString().slice(0, 10),
  gates: opt.carousel ? { slides: null } : { script: null, audio: null, version: null },
  language: CONFIG.language,
  fps: CONFIG.fps,
  theme: themeName,
  handle: null,
  channel: null,
  cta: null,
  palette: null,
  accentSource: null,
  fonts: null,
  background: null,
  channelLogo: null,
  logo: null,
  ticker: [],
  tts: { engine: CONFIG.tts.default, voice: null, settings: {} },
  audio: null,
  versions: {},
  publish: null,
};
writeJson(path.join(dir, 'reel.json'), reel);
const r = loadReel(dir);
applyTheme(r, themeName);
r.save();

if (opt.logo) {
  const run = spawnSync(process.execPath, [path.join(SKILL, 'scripts/logo.mjs'), opt.logo, '--reel', dir], { stdio: 'inherit' });
  if (run.status !== 0) console.warn('logo lookup failed; run logo.mjs again with another slug');
}
const { palette } = readJson(path.join(dir, 'reel.json'));

const fill = (text) =>
  text
    .replaceAll('{{TOPIC}}', topic).replaceAll('{{TITLE}}', topic)
    .replaceAll('{{BG}}', palette.bg).replaceAll('{{ACCENT}}', palette.accent).replaceAll('{{SUCCESS}}', palette.success).replaceAll('{{TEXT}}', palette.text)
    .replaceAll('{{LOGO}}', opt.logo ?? '<simple-icons slug>').replaceAll('{{CTA_SPOKEN}}', theme.cta.spoken)
    .replaceAll('{{LANGUAGE}}', CONFIG.language).replaceAll('{{VOICE_STYLE}}', CONFIG.voiceStyle).replaceAll('{{ONSCREEN}}', CONFIG.onScreenLanguage);
const files = opt.carousel
  ? [['reel/research.md', 'research.md'], ['carousel/slides.html', 'slides.html']]
  : [['reel/research.md', 'research.md'], [`reel/${opt.fast ? 'script.fast.md' : 'script.md'}`, 'script.md'], ['reel/pronounce.json', 'pronounce.json']];
for (const [src, name] of files) writeFileSync(path.join(dir, name), fill(readFileSync(path.join(SKILL, 'templates', src), 'utf8')));

console.log(`created ${opt.carousel ? 'carousel ' : ''}${dir} (theme ${themeName}: ${theme.background.style}, accent ${palette.accent}${theme.channelLogo ? ', channel logo' : ''})`);
