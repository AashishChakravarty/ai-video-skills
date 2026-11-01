/**
 * config.mjs: shows or changes your ai-video-skills settings. Defaults ship in config.default.json; your values live
 * in ~/.config/ai-video-skills/config.json (or $AI_VIDEO_SKILLS_CONFIG) and win over the defaults.
 *
 *   node config.mjs                                  effective settings, marking what you have set
 *   node config.mjs set handle=@you language=hi reelsRoot=~/reels "cta.spoken=Follow for more."
 *   node config.mjs unset tts.sayVoice               back to the default
 *
 * Keys use dots for nesting; values parse as JSON when they can (2.4, true, ["a"]) and are strings otherwise.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { CONFIG, CONFIG_PATH, USER_CONFIG, flatten, parseValue, setPath, writeJson } from './lib.mjs';

const [command, ...pairs] = process.argv.slice(2);

if (command === 'set' || command === 'unset') {
  if (!pairs.length) throw new Error(`usage: node config.mjs ${command} key${command === 'set' ? '=value' : ''} …`);
  const next = structuredClone(USER_CONFIG);
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (command === 'set' && at < 1) throw new Error(`expected key=value, got "${pair}"`);
    const key = command === 'set' ? pair.slice(0, at) : pair;
    setPath(next, key.split('.'), command === 'set' ? parseValue(pair.slice(at + 1)) : undefined);
  }
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  writeJson(CONFIG_PATH, next);
  console.log(`saved ${CONFIG_PATH}`);
  process.exit(0);
}
if (command) throw new Error('usage: node config.mjs [set key=value … | unset key …]');

const mine = new Set(flatten(USER_CONFIG).map(([k]) => k));
console.log(`config: ${CONFIG_PATH}${mine.size ? '' : ' (not created yet — run: node config.mjs set handle=@you language=en)'}\n`);
for (const [k, v] of flatten(CONFIG)) console.log(`${mine.has(k) ? '*' : ' '} ${k.padEnd(24)} ${JSON.stringify(v)}`);
console.log('\n* = set in your config; everything else is the default');
