/**
 * notes.mjs: prints a reel's notes document (the freebie a "comment KEYWORD" CTA promises, notes/<name>.html,
 * started from templates/notes/notes.html) to publish/<name>.pdf with Playwright's Chromium, using the page's own
 * @page size, margins and footer. Reports the page count and any font that failed to load.
 *
 *   node notes.mjs [name] [--reel dir]        # name defaults to the only .html in notes/
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { loadReel } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' } } });
const r = loadReel(opt.reel);
if (!existsSync(r.file('notes'))) throw new Error(`no notes/ folder in ${r.dir}: copy templates/notes/notes.html to notes/<name>.html first`);
const pages = readdirSync(r.file('notes')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
const name = positionals[0] ?? (pages.length === 1 ? pages[0] : null);
if (!name) throw new Error(`notes/ has ${pages.length ? pages.join(', ') : 'no .html files'}; pass the name to print`);
const src = r.file('notes', `${name}.html`), out = r.file('publish', `${name}.pdf`);
if (!existsSync(src)) throw new Error(`no ${src}`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
  const failed = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
  });
  if (failed.length) console.warn(`warning: fonts failed to load: ${failed.join(', ')} (check the @font-face paths)`);
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
} finally {
  await browser.close();
}
// Chromium writes one uncompressed "/Type /Page" object per page.
const count = (readFileSync(out, 'latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
console.log(`wrote ${out} (${count} pages)`);
