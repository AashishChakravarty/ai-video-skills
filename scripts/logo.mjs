/**
 * logo.mjs: sets a reel's topic logo and accent colour from simple-icons (CC0 brand SVGs). Writes
 * assets/logo.svg (24×24 path) and stores the logo plus a contrast-safe accent in reel.json.
 *
 *   node logo.mjs <slug-or-title> [--reel dir]
 *   node logo.mjs --search <text>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import * as icons from 'simple-icons';
import { contrast, loadReel, readableAccent } from './lib.mjs';

const ALL = Object.values(icons).filter((i) => i && i.slug && i.path);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Finds an icon by exact slug or title, ignoring case and punctuation. */
export function findIcon(query) {
  const q = norm(query);
  return ALL.find((i) => i.slug === q || norm(i.title) === q);
}

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' }, search: { type: 'string' } } });

if (opt.search) {
  const q = norm(opt.search);
  for (const i of ALL.filter((i) => i.slug.includes(q) || norm(i.title).includes(q)).slice(0, 20)) console.log(`${i.slug.padEnd(24)} ${i.title}  #${i.hex}`);
  process.exit(0);
}

const query = positionals[0];
if (!query) throw new Error('usage: node logo.mjs <slug-or-title> [--reel dir]');
const icon = findIcon(query);
if (!icon) {
  const q = norm(query);
  const near = ALL.filter((i) => i.slug.includes(q) || norm(i.title).includes(q)).slice(0, 8).map((i) => i.slug);
  throw new Error(`no simple-icons logo for "${query}"${near.length ? `; close: ${near.join(', ')}` : '; use node logo.mjs --search <text>, or put an SVG at assets/logo.svg by hand'}`);
}

const r = loadReel(opt.reel);
mkdirSync(r.file('assets'), { recursive: true });
writeFileSync(r.file('assets/logo.svg'), `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${icon.path}"/></svg>\n`);
const brandHex = `#${icon.hex}`;
const accent = readableAccent(brandHex, r.reel.palette.bg);
r.reel.logo = { slug: icon.slug, title: icon.title, hex: brandHex, path: icon.path };
r.reel.palette.accent = accent;
r.save();
console.log(`logo: ${icon.title} (${icon.slug}) brand ${brandHex} → accent ${accent} (contrast ${contrast(accent, r.reel.palette.bg).toFixed(2)}:1 on ${r.reel.palette.bg})`);
console.log(`wrote ${r.file('assets/logo.svg')}`);
