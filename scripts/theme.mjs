/**
 * theme.mjs: your brand and look as named themes that new reels reuse. A theme can set the brand (handle, channel,
 * cta.follow, cta.spoken, channelLogo: a PNG/JPG/WebP shown round in the follow button) and the look (palette, whose
 * accent is "topic" to follow each topic's logo or a fixed #hex; fonts; background.style dots | grid | glow with
 * density, drift, glow, grain and vignette). Keys a theme leaves out come from your global config. Starter themes
 * ship in themes/; yours live in your config under themes.<name>, and one of yours named like a starter adjusts it.
 *
 *   node theme.mjs                                   every theme, * marking the default for new reels
 *   node theme.mjs show <name>                       everything a new reel gets from it
 *   node theme.mjs save <name> [--from <theme>] palette.accent=#FF5A5F background.style=grid channelLogo=~/me.png
 *   node theme.mjs default <name>                    new reels use it (new-reel.mjs --theme picks another)
 *   node theme.mjs apply <name> [--reel dir]         switches an existing reel; then scaffold.mjs <v> --sync
 *   node theme.mjs delete <name>                     removes one of yours
 *
 * save without --from adds to (or creates) your theme of that name; --from starts from what another theme sets.
 * key=null removes a key from your theme, so it falls back to the starter or your global config.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, CONFIG_PATH, SKILL, THEME_KEYS, USER_CONFIG, applyTheme, checkTheme, flatten, loadReel, merge, parseValue, readJson, resolveTheme, setPath, starterThemes, writeJson } from './lib.mjs';

const USAGE = 'usage: node theme.mjs [show|save|default|apply|delete] <name> [--from theme] [key=value …] [--reel dir]';
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { from: { type: 'string' }, reel: { type: 'string' } } });
const [command, name, ...pairs] = positionals;
const starters = starterThemes(), mine = USER_CONFIG.themes ?? {};
const names = [...new Set([...Object.keys(starters), ...Object.keys(mine)])];

const summary = (t) => [t.background.style, `accent ${t.palette.accent} on ${t.palette.bg}`, t.handle, t.channelLogo && 'channel logo'].filter(Boolean).join(' · ');

/** Prints a theme's warnings and throws on its errors. */
function check(t) {
  const { errors, warnings } = checkTheme(t);
  for (const w of warnings) console.log(`! ${w}`);
  if (errors.length) throw new Error(errors.join('\n'));
}

function saveConfig(next) {
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  writeJson(CONFIG_PATH, next);
}

if (!command) {
  for (const n of names) {
    const source = starters[n] && mine[n] ? 'starter + yours' : starters[n] ? 'starter' : 'yours', t = resolveTheme(n);
    console.log(`${n === CONFIG.theme ? '*' : ' '} ${n.padEnd(14)} ${source.padEnd(16)} ${summary(t)}`);
    if (t.description) console.log(`  ${''.padEnd(31)} ${t.description}`);
  }
  console.log('\n* = default for new reels (theme.mjs default <name>); new-reel.mjs --theme <name> picks another');
  process.exit(0);
}
if (!name) throw new Error(USAGE);
const next = structuredClone(USER_CONFIG);

if (command === 'show') {
  const t = resolveTheme(name);
  for (const [k, v] of flatten(t)) console.log(`${k.padEnd(22)} ${JSON.stringify(v)}`);
  check(t);
} else if (command === 'save') {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('theme names use a-z, 0-9 and -');
  if (!pairs.length && !opt.from) throw new Error(`nothing to save; ${USAGE}`);
  next.themes ??= {};
  if (opt.from) resolveTheme(opt.from);
  const entry = structuredClone(opt.from ? { ...merge(starters[opt.from] ?? {}, mine[opt.from] ?? {}), description: `Based on ${opt.from}.` } : next.themes[name] ?? {});
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at < 1) throw new Error(`expected key=value, got "${pair}"`);
    const key = pair.slice(0, at);
    if (!THEME_KEYS.includes(key.split('.')[0])) throw new Error(`a theme sets ${THEME_KEYS.join(', ')}; "${key}" is a global setting (config.mjs set)`);
    let value = parseValue(pair.slice(at + 1));
    if (typeof value === 'string' && /^(channelLogo|fonts\.)/.test(key) && !value.startsWith('~') && !path.isAbsolute(value) && existsSync(value)) value = path.resolve(value);
    setPath(entry, key.split('.'), value === null ? undefined : value);
  }
  next.themes[name] = entry;
  const t = resolveTheme(name, next.themes);
  check(t);
  saveConfig(next);
  console.log(`saved theme ${name}: ${summary(t)}`);
} else if (command === 'default') {
  check(resolveTheme(name));
  next.theme = name;
  saveConfig(next);
  console.log(`new reels use theme ${name}`);
} else if (command === 'apply') {
  const r = loadReel(opt.reel), spoken = r.reel.cta?.spoken;
  const t = applyTheme(r, name);
  r.save();
  check(t);
  console.log(`${r.dir}: theme ${name} (${summary(t)})`);
  if (spoken && spoken !== t.cta.spoken) console.log(`! the spoken follow line is narration: change it in script.md's VO if you want "${t.cta.spoken}"`);
  const built = existsSync(r.file('build')) ? readdirSync(r.file('build')).filter((v) => existsSync(r.file('build', v, 'index.html'))) : [];
  for (const v of built) console.log(`  refresh build/${v}: node ${path.join(SKILL, 'scripts/scaffold.mjs')} ${v} --sync --reel ${r.dir}`);
} else if (command === 'delete') {
  if (!mine[name]) throw new Error(starters[name] ? `${name} is a starter theme; only your own themes can be deleted` : `no theme "${name}" of yours`);
  delete next.themes[name];
  if (next.theme === name) delete next.theme;
  saveConfig(next);
  console.log(`deleted theme ${name}${USER_CONFIG.theme === name ? `; new reels use ${readJson(path.join(SKILL, 'config.default.json')).theme} again` : ''}`);
} else throw new Error(USAGE);
