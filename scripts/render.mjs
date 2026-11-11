/**
 * render.mjs: renders a version for review — HyperFrames check (must pass), render with the version's mix,
 * contact sheet and a probe of the result — to out/<version>.mp4 and out/<version>-contact.png.
 *
 *   node render.mjs <version> [--nosubs] [--skip-check] [--low-memory] [--reel dir]
 *
 * --nosubs renders the same version without burned-in captions to out/<version>-nosubs.mp4.
 * --low-memory renders with one Chrome worker (PRODUCER_LOW_MEMORY_MODE=1); it switches on by itself, with a
 * warning, when the reel's disk has under 6 GB free, since macOS swap on that disk can fill it mid-render (ENOSPC).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statfsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { contactSheet, loadReel, loudness, probeVideo, readJson, staleAnchors } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { nosubs: { type: 'boolean' }, 'skip-check': { type: 'boolean' }, 'low-memory': { type: 'boolean' }, reel: { type: 'string' } } });
const version = positionals[0];
if (!version) throw new Error('usage: node render.mjs <version> [--nosubs] [--skip-check] [--low-memory]');
const r = loadReel(opt.reel);
const dir = r.file('build', version);
if (!existsSync(path.join(dir, 'index.html'))) throw new Error(`build/${version} is not scaffolded`);
if (!existsSync(path.join(dir, 'assets/mix.wav'))) throw new Error(`build/${version}/assets/mix.wav missing; run node mix.mjs ${version}`);

const stale = opt['skip-check'] || !existsSync(r.file('anchors.json')) ? [] : staleAnchors(dir, readJson(r.file('anchors.json')));
if (stale.length) throw new Error(`build/${version} uses anchors that anchors.json no longer has (a script edit or re-align moved them), so those scenes would break at load:\n  ${stale.join('\n  ')}\nPoint them at current @beats (script.timed.md), or add the beat back to script.md and run script.mjs time.`);

const npm = (args, env) => spawnSync('npm', args, { cwd: dir, stdio: 'inherit', env: { ...process.env, ...env } }).status;
if (!opt['skip-check'] && npm(['run', '--silent', 'check']) !== 0) throw new Error(`hyperframes check failed for build/${version}; fix the errors above, then render again`);

mkdirSync(r.file('out'), { recursive: true });
const name = `${version}${opt.nosubs ? '-nosubs' : ''}`;
const out = r.file('out', `${name}.mp4`);
const args = ['run', '--silent', 'render', '--', '--quiet', '-o', out];
if (opt.nosubs) args.push('--variables', '{"captions":false}');
const { bavail, bsize } = statfsSync(r.dir), freeGB = (bavail * bsize) / 1024 ** 3;
const lowMemory = opt['low-memory'] || freeGB < 6;
if (!opt['low-memory'] && lowMemory) console.warn(`WARNING: only ${freeGB.toFixed(1)} GB free on the disk holding ${r.dir}; a full render can fill it (macOS swap shares that disk) and die with ENOSPC. Rendering in low-memory mode (one Chrome worker, slower). For full speed, free at least 6 GB or close memory-hungry apps, then render again.`);
if (npm(args, lowMemory && { PRODUCER_LOW_MEMORY_MODE: '1' }) !== 0) throw new Error(`render failed for build/${version}${lowMemory ? '' : '; if it ran out of disk (ENOSPC), free space or pass --low-memory'}`);

const v = probeVideo(out), l = loudness(out);
const sheet = contactSheet(out, r.file('out', `${name}-contact.png`));
const expected = r.reel.audio?.frames;
r.reel.versions[version] = { ...(r.reel.versions[version] || {}), [opt.nosubs ? 'nosubs' : 'file']: path.relative(r.dir, out), contact: opt.nosubs ? r.reel.versions[version]?.contact : path.relative(r.dir, sheet), renderedAt: new Date().toISOString() };
r.save();
console.log(`${path.relative(r.dir, out)}: ${v.width}x${v.height} ${v.fps}fps ${v.frames} frames${expected && v.frames !== expected ? ` (expected ${expected}!)` : ''}, ${v.duration.toFixed(2)}s, audio ${v.audio ? `${l.lufs} LUFS` : 'MISSING'}`);
console.log(`contact sheet: ${path.relative(r.dir, sheet)}`);
