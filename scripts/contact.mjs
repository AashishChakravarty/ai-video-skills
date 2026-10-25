/**
 * contact.mjs: contact sheet of a rendered video — every 30th frame (one per second at 30fps) in a grid.
 *
 *   node contact.mjs <video.mp4> [--every 30] [--out sheet.png]
 */
import { parseArgs } from 'node:util';
import { contactSheet } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { every: { type: 'string', default: '30' }, out: { type: 'string' } } });
if (!positionals[0]) throw new Error('usage: node contact.mjs <video.mp4> [--every 30] [--out sheet.png]');
console.log(`wrote ${contactSheet(positionals[0], opt.out ?? positionals[0].replace(/\.\w+$/, '-contact.png'), { every: Number(opt.every) })}`);
