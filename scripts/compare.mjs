/**
 * compare.mjs: two renders side by side under labels, keeping the first one's audio, so versions are judged
 * on the same clip. Portrait renders sit left/right; landscape renders stack top/bottom. The label bar is drawn
 * in headless Chrome because many ffmpeg builds lack drawtext.
 *
 *   node compare.mjs [--reel dir]                       out/a.mp4 vs out/b.mp4 → out/compare.mp4
 *   node compare.mjs <left.mp4> <right.mp4> [--labels "A · KINETIC|B · CINEMATIC"] [--out file.mp4]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { SKILL, ffmpeg, loadReel, probeVideo } from './lib.mjs';

const BAR_H = 88;
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { reel: { type: 'string' }, labels: { type: 'string' }, out: { type: 'string' } } });

let [left, right] = positionals, labels = opt.labels?.split('|'), out = opt.out;
if (!left) {
  const r = loadReel(opt.reel);
  [left, right] = ['a', 'b'].map((v) => r.file('out', `${v}.mp4`));
  labels ??= ['a', 'b'].map((v) => `${v.toUpperCase()} · ${(r.reel.versions[v]?.direction ?? '').toUpperCase()}`.replace(/ · $/, ''));
  out ??= r.file('out/compare.mp4');
}
labels ??= ['A', 'B'];
out = path.resolve(out ?? 'compare.mp4');

const { width, height } = probeVideo(left), portrait = height > width;
const [tw, th] = portrait ? [540, 960] : [960, 540];
const W = portrait ? tw * 2 : tw;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: BAR_H } });
const font = readFileSync(path.join(SKILL, 'assets/fonts/JetBrainsMono-700.ttf')).toString('base64');
const text = portrait ? labels.map((l) => `<div>${l}</div>`).join('') : `<div>${labels[0]}  ▲  ▼  ${labels[1]}</div>`;
await page.setContent(`<style>@font-face{font-family:M;src:url(data:font/ttf;base64,${font})}
  body{margin:0;display:flex;background:#0E0A16;color:#EDE7F6;font:700 ${portrait ? 34 : 30}px M;letter-spacing:3px}
  div{flex:1;display:grid;place-items:center;height:${BAR_H}px}</style>${text}`);
await page.evaluate(() => document.fonts.ready);
const bar = out.replace(/\.mp4$/, '-labels.png');
await page.screenshot({ path: bar });
await browser.close();

const stack = portrait ? `[l][r]hstack=2` : `[l][r]vstack=2`;
const H = portrait ? th : th * 2;
ffmpeg([
  '-i', left, '-i', right, '-i', bar,
  '-filter_complex', `[0:v]scale=${tw}:${th},setsar=1[l];[1:v]scale=${tw}:${th},setsar=1[r];${stack},pad=${W}:${H + BAR_H}:0:${BAR_H}:color=0x0E0A16[s];[s][2:v]overlay=0:0[v]`,
  '-map', '[v]', '-map', '0:a?', '-shortest', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
]);

console.log(`wrote ${out}`);
