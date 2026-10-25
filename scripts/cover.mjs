/**
 * cover.mjs: a cover/thumbnail still from a rendered video — full size PNG by default, or scaled and
 * centre-cropped to --size (1280x720 for a YouTube thumbnail).
 *
 *   node cover.mjs <video.mp4> --at <seconds> [--out cover.png] [--size 1280x720]
 */
import { parseArgs } from 'node:util';
import { ffmpeg } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { at: { type: 'string' }, out: { type: 'string' }, size: { type: 'string' } } });
if (!positionals[0] || opt.at == null) throw new Error('usage: node cover.mjs <video.mp4> --at <seconds> [--out cover.png] [--size WxH]');
const out = opt.out ?? positionals[0].replace(/\.\w+$/, `-cover.png`);
const vf = opt.size ? (([w, h]) => [`-vf`, `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`])(opt.size.split('x')) : [];
ffmpeg(['-ss', opt.at, '-i', positionals[0], '-frames:v', '1', ...vf, '-q:v', '2', out]);
console.log(`wrote ${out}`);
