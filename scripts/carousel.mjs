/**
 * carousel.mjs: renders a carousel's slides.html (started from templates/carousel by new-reel.mjs --carousel) to
 * publish/slide-01.png … — one PNG per <section class="slide"> at its CSS size (1080×1350) — and out/slides-sheet.png
 * for review. First it writes assets/theme.css from reel.json (palette, fonts, background, card style), so
 * theme.mjs apply restyles the slides; then it fills every .handle with the handle and adds each slide's footer.
 * Warns, and exits 1, when content runs off a slide, into its footer or out of its box, a font fails to load, or
 * the slide count is outside what Instagram takes (2–20). With --animate it also writes publish/slide-NN.mp4
 * (SECONDS long): each slide's blocks and rows rise in one after another and every .big number counts up, then
 * the finished slide holds; the PNGs and the checks use that finished frame.
 *
 *   node carousel.mjs [--reel dir] [--animate]
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { CONFIG, configPath, ffmpeg, loadReel } from './lib.mjs';

const { values: opt } = parseArgs({ options: { reel: { type: 'string' }, animate: { type: 'boolean' } } });
const FPS = 30, SECONDS = 4;
const r = loadReel(opt.reel), reel = r.reel;
const src = r.file('slides.html');
if (!existsSync(src)) throw new Error(`no slides.html in ${r.dir}; start a carousel with new-reel.mjs "<topic>" --carousel`);

/** assets/theme.css: the reel's palette as CSS variables, its four fonts, its background and its card style. */
function themeCss() {
  const p = reel.palette, b = reel.background ?? {}, fonts = { ...CONFIG.fonts, ...reel.fonts };
  const face = (family, weight, key) => `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url("${pathToFileURL(configPath(fonts[key])).href}"); }`;
  const ink = (pct) => `color-mix(in srgb, var(--ink) ${pct}%, transparent)`;
  const step = Math.round(54 / Math.max(b.density ?? 1, 0.2)), cell = `0 0 / ${step}px ${step}px`;
  const pattern = {
    grid: `linear-gradient(${ink(7)} 2px, transparent 2px) ${cell}, linear-gradient(90deg, ${ink(7)} 2px, transparent 2px) ${cell}`,
    dots: `radial-gradient(${ink(12)} 3px, transparent 3.5px) ${cell}`,
  }[b.style];
  const glow = `radial-gradient(circle at 85% 0%, color-mix(in srgb, var(--accent) ${Math.round(16 * (b.glow ?? 1))}%, transparent), transparent 55%)`;
  const card = reel.cards?.style === 'hard'
    ? 'border: 4px solid var(--ink); box-shadow: 10px 10px 0 var(--ink);'
    : `border: 1px solid var(--line); box-shadow: 0 2px 6px ${ink(6)}, 0 18px 48px ${ink(10)};`;
  return [
    face('Reel Sans', 800, 'sans'), face('Reel Sans', 400, 'sansRegular'), face('Reel Mono', 700, 'mono'), face('Reel Mono', 400, 'monoRegular'),
    `:root { --bg: ${p.bg}; --surface: ${p.surface ?? `color-mix(in srgb, ${p.bg} 90%, ${p.white})`}; --text: ${p.text}; --ink: ${p.white}; --accent: ${p.accent}; --success: ${p.success};`,
    `  --muted: color-mix(in srgb, var(--text) 72%, var(--bg)); --line: ${ink(12)}; --sans: "Reel Sans", sans-serif; --mono: "Reel Mono", ui-monospace, monospace; --body: "Reel Sans", sans-serif; }`,
    `.slide { background: ${[glow, pattern, `linear-gradient(180deg, ${p.bg}, ${b.gradient ?? p.bg})`].filter(Boolean).join(', ')}; }`,
    `.card { ${card} }`,
    '.anim { animation: rise 450ms cubic-bezier(0.2, 0.7, 0.2, 1) calc(120ms + var(--i) * 90ms) both; }',
    '@keyframes rise { from { opacity: 0; transform: translateY(48px); } }',
  ].join('\n') + '\n';
}

for (const sub of ['assets', 'out', 'publish']) mkdirSync(r.file(sub), { recursive: true });
writeFileSync(r.file('assets/theme.css'), themeCss());
for (const f of readdirSync(r.file('publish'))) if (/^slide-\d+\.(png|mp4)$/.test(f)) rmSync(r.file('publish', f));

const browser = await chromium.launch();
let report;
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
  await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
  report = await page.evaluate(async ({ handle, logo, animate }) => {
    const slides = [...document.querySelectorAll('.slide')];
    for (const el of document.querySelectorAll('.handle')) el.textContent = handle;
    slides.forEach((s, i) => {
      const foot = document.createElement('footer');
      foot.innerHTML = `<span class="who">${logo ? `<img src="${logo}" alt="">` : ''}<span></span></span><span>${i + 1} / ${slides.length}</span>`;
      foot.querySelector('.who > span').textContent = handle;
      s.append(foot);
    });
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    await document.fonts.ready;
    let buildMs = 0;
    if (animate) {
      const counters = [];
      for (const s of slides) {
        const order = [...s.querySelectorAll(':scope > :not(footer)')].flatMap((el) => [el, ...el.querySelectorAll(':scope > .row')]);
        order.forEach((el, i) => {
          el.classList.add('anim');
          el.style.setProperty('--i', i);
          const m = el.matches('.big') && !el.children.length && el.textContent.trim().match(/^(\D*)(\d+(?:\.(\d+))?)(.*)$/s);
          if (m) counters.push({ el, start: parseFloat(getComputedStyle(el).animationDelay) * 1000, pre: m[1], to: Number(m[2]), dp: m[3]?.length ?? 0, post: m[4] });
        });
      }
      const COUNT_MS = 700, anims = document.getAnimations();
      anims.forEach((a) => a.pause());
      buildMs = Math.max(...anims.map((a) => a.effect.getComputedTiming().endTime), ...counters.map((c) => c.start + COUNT_MS));
      window.__seek = (ms) => {
        for (const a of anims) a.currentTime = ms;
        for (const c of counters) {
          const p = Math.min(Math.max((ms - c.start) / COUNT_MS, 0), 1), eased = 1 - (1 - p) ** 3;
          c.el.textContent = c.pre + (c.to * eased).toFixed(c.dp) + c.post;
        }
      };
      window.__seek(buildMs);
    }
    const fonts = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
    const problems = [];
    slides.forEach((s, i) => {
      const box = s.getBoundingClientRect(), footTop = s.querySelector(':scope > footer').getBoundingClientRect().top;
      for (const el of s.querySelectorAll(':scope > :not(footer), :scope > :not(footer) *')) {
        const b = el.getBoundingClientRect();
        if (!b.width) continue;
        const where = b.top < box.top - 0.5 || b.left < box.left - 0.5 || b.right > box.right + 0.5 ? 'runs off the slide'
          : b.bottom > footTop + 0.5 ? 'runs into the footer'
          : el.clientWidth && el.scrollWidth > el.clientWidth + 1 ? 'is wider than its box' : null;
        if (where) { problems.push(`slide ${i + 1}: "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}" ${where}`); break; }
      }
    });
    return { count: slides.length, fonts, problems, buildMs };
  }, { handle: reel.handle, logo: reel.channelLogo, animate: !!opt.animate });

  const slides = await page.locator('.slide').all(), nn = (i) => String(i + 1).padStart(2, '0');
  for (const [i, s] of slides.entries()) await s.screenshot({ path: r.file('publish', `slide-${nn(i)}.png`) });
  if (opt.animate) {
    const frames = Math.ceil((report.buildMs / 1000) * FPS) + 1;
    if (frames > SECONDS * FPS) report.problems.push(`slides take ${Math.round(report.buildMs)} ms to build in; cut blocks so they fit ${SECONDS} s`);
    for (const [i] of slides.entries()) mkdirSync(r.file('out', 'frames', nn(i)), { recursive: true });
    for (let f = 0; f < frames; f++) {
      await page.evaluate((ms) => window.__seek(ms), (f * 1000) / FPS);
      for (const [i, s] of slides.entries()) await s.screenshot({ path: r.file('out', 'frames', nn(i), `${String(f).padStart(4, '0')}.png`) });
    }
    for (const [i] of slides.entries()) {
      ffmpeg(['-framerate', String(FPS), '-i', r.file('out', 'frames', nn(i), '%04d.png'),
        '-vf', `tpad=stop_mode=clone:stop_duration=${Math.max(SECONDS - frames / FPS, 0)},format=yuv420p`,
        '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', r.file('publish', `slide-${nn(i)}.mp4`)]);
    }
    rmSync(r.file('out', 'frames'), { recursive: true, force: true });
  }
} finally {
  await browser.close();
}

const { count, fonts, problems } = report;
if (!count) throw new Error('slides.html has no <section class="slide">');
const cols = Math.min(count, 4);
ffmpeg(['-start_number', '1', '-i', r.file('publish', 'slide-%02d.png'), '-vf', `scale=324:405,tile=${cols}x${Math.ceil(count / cols)}:padding=16:margin=16:color=0x777777`, '-frames:v', '1', r.file('out', 'slides-sheet.png')]);

if (fonts.length) problems.push(`fonts failed to load: ${[...new Set(fonts)].join(', ')} (reel.json fonts)`);
if (count < 2 || count > 20) problems.push(`${count} slides; an Instagram carousel takes 2–20`);
console.log(`wrote ${count} slides: ${r.file('publish', 'slide-01.png')} … slide-${String(count).padStart(2, '0')}.png`);
if (opt.animate) console.log(`animated: slide-01.mp4 … slide-${String(count).padStart(2, '0')}.mp4 (${SECONDS} s each; upload these instead of the PNGs)`);
console.log(`review sheet: ${r.file('out', 'slides-sheet.png')}`);
for (const p of problems) console.log(`! ${p}`);
if (problems.length) process.exitCode = 1;
