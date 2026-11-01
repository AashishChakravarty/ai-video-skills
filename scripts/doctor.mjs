/**
 * doctor.mjs: checks everything ai-video-skills needs on this machine and prints how to fix what is missing.
 * Required items fail the run; optional ones (a second TTS engine, the app being open) only warn.
 *
 *   node doctor.mjs [--fix]     --fix runs the safe fixes (npm install in the skill folder)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statfsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG, CONFIG_PATH, SKILL, USER_CONFIG, checkTheme, resolveTheme, sfxDir } from './lib.mjs';

const { values: opt } = parseArgs({ options: { fix: { type: 'boolean' } } });
const HOME = os.homedir(), HUB = path.join(HOME, '.cache/huggingface/hub'), MAC = process.platform === 'darwin';
const install = (pkg) => (MAC ? `brew install ${pkg}` : `install ${pkg} with your package manager`);
const rows = [];
const add = (level, name, ok, detail, fix) => rows.push({ level, name, ok, detail, fix });
const version = (cmd, args = ['--version']) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || r.stderr).split('\n')[0].trim() : null;
};
const dirSize = (dir) => {
  const r = spawnSync('du', ['-skL', dir], { encoding: 'utf8' });
  return r.status === 0 ? Number(r.stdout.split('\t')[0]) / 1048576 : 0;
};

if (opt.fix && !existsSync(path.join(SKILL, 'node_modules/playwright'))) spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: SKILL, stdio: 'inherit' });

add('required', 'your config (handle, language)', Boolean(USER_CONFIG.handle), existsSync(CONFIG_PATH) ? `${CONFIG_PATH} · ${CONFIG.handle ?? 'no handle'} · ${CONFIG.language}` : `${CONFIG_PATH} (missing)`, `node ${path.join(SKILL, 'scripts/config.mjs')} set handle=@yourhandle channel="Your Channel" language=en reelsRoot=~/reels`);
const nodeMajor = Number(process.versions.node.split('.')[0]);
add('required', 'node ≥ 22', nodeMajor >= 22, `v${process.versions.node}`, install('node'));
const ff = version('ffmpeg', ['-version']);
add('required', 'ffmpeg + ffprobe', Boolean(ff && version('ffprobe', ['-version'])), ff?.replace(/ Copyright.*/, '') ?? 'missing', install('ffmpeg'));
add('required', 'uv (python tools)', Boolean(version('uv')), version('uv') ?? 'missing', MAC ? 'brew install uv' : 'curl -LsSf https://astral.sh/uv/install.sh | sh');
const pkgs = existsSync(path.join(SKILL, 'node_modules/playwright')) && existsSync(path.join(SKILL, 'node_modules/simple-icons'));
add('required', 'skill node packages', pkgs, 'playwright, simple-icons', `cd ${SKILL} && npm install`);
let chromium = null;
if (pkgs) {
  try {
    chromium = (await import('playwright')).chromium.executablePath();
  } catch {}
}
add('required', 'playwright chromium', Boolean(chromium && existsSync(chromium)), chromium ?? 'not found', `cd ${SKILL} && npx playwright install chromium`);

const plugins = path.join(HOME, '.claude/plugins/marketplaces');
add('required', 'HyperFrames plugin', existsSync(path.join(plugins, 'hyperframes/skills/hyperframes')), 'skills /hyperframes, /media-use …', 'claude plugin marketplace add heygen-com/hyperframes && claude plugin install hyperframes (reference/build.md §12 if git-lfs blocks the clone)');
const sfx = sfxDir();
add('required', 'SFX library', Boolean(sfx), sfx ?? 'none found', 'install the HyperFrames plugin, or set sfxDir in your config to a folder of .mp3 sound effects');
add('optional', 'Remotion plugin (3D clips)', existsSync(path.join(plugins, 'remotion')), 'skills /remotion-best-practices …', 'claude plugin marketplace add remotion-dev/skills && claude plugin install remotion');
add('required', 'Whisper large-v3 (align)', dirSize(path.join(HUB, 'models--Systran--faster-whisper-large-v3')) > 2.5, 'faster-whisper, ~2.9 GB', 'downloads automatically on the first align.py run (needs ~3 GB and a network)');

let vsUp = false;
try {
  vsUp = (await fetch(`${CONFIG.tts.voicestudioUrl}/health`, { signal: AbortSignal.timeout(2000) })).ok;
} catch {}
const vsApp = MAC ? existsSync('/Applications/VoiceStudio.app') : vsUp;
add('optional', 'VoiceStudio (TTS)', vsApp, vsUp ? `running at ${CONFIG.tts.voicestudioUrl}` : vsApp ? 'installed (opened on demand)' : 'not found', 'curl -fsSL https://voicestudio.sh/install | sh   (https://voicestudio.sh)');
add('optional', 'Chatterbox model (TTS)', dirSize(path.join(HUB, 'models--ResembleAI--chatterbox')) > 1, 'MIT, 23 languages + cloning, ~3 GB', `cd ${SKILL}/scripts/tts && uv run tts_chatterbox.py --warmup`);
const sayVoices = MAC ? (spawnSync('say', ['-v', '?'], { encoding: 'utf8' }).stdout ?? '').split('\n').filter((l) => new RegExp(`\\s${CONFIG.language}_[A-Z]{2,3}\\s+#`).test(l)) : [];
add('optional', `macOS say voice (${CONFIG.language}, drafts)`, sayVoices.length > 0, MAC ? `${sayVoices.length} voice(s)` : 'macOS only', 'System Settings → Accessibility → Spoken Content → System voice → Manage voices');
const engine = CONFIG.tts.default, voice = { voicestudio: CONFIG.tts.voicestudioProfile, chatterbox: CONFIG.tts.chatterboxRef, say: CONFIG.tts.sayVoice ?? 'auto' }[engine];
add('optional', 'default voice', Boolean(voice), voice ? `${engine} · ${voice}${engine === 'voicestudio' && CONFIG.tts.instruct ? ` · ${CONFIG.tts.instruct}` : ''}` : `${engine} · none chosen (asked at the voice step)`, engine === 'chatterbox'
  ? `node ${path.join(SKILL, 'scripts/config.mjs')} set tts.chatterboxRef=~/voice/me.wav   (a clean 5–15 s clip)`
  : `node ${path.join(SKILL, 'scripts/tts.mjs')} --engine voicestudio --voices, then node ${path.join(SKILL, 'scripts/config.mjs')} set tts.voicestudioProfile=<id> ["tts.instruct=indian accent"]`);

let theme = null, themeProblems;
try {
  theme = resolveTheme();
  themeProblems = checkTheme(theme).errors;
} catch (e) {
  themeProblems = [e.message];
}
add('required', 'default theme', !themeProblems.length, theme ? `${CONFIG.theme} · ${theme.background.style} · accent ${theme.palette.accent}${theme.channelLogo ? ' · channel logo' : ''}` : CONFIG.theme, `${themeProblems.join('; ')} (node ${path.join(SKILL, 'scripts/theme.mjs')} show ${CONFIG.theme})`);

const fs = statfsSync(HOME), freeGb = (fs.bavail * fs.bsize) / 1e9;
add('required', 'free disk ≥ 10 GB', freeGb >= 10, `${freeGb.toFixed(0)} GB free`, 'free some space: renders and models are large');

const mark = (row) => (row.ok ? '✓' : row.level === 'required' ? '✗' : '!');
for (const row of rows) console.log(`${mark(row)} ${row.name.padEnd(34)} ${row.detail}${row.ok ? '' : `\n    fix: ${row.fix}`}`);
const failed = rows.filter((x) => !x.ok && x.level === 'required');
const tts = rows.filter((x) => /\(TTS\)|say voice/.test(x.name) && x.ok).map((x) => x.name.replace(/ \(.*/, '').replace(/ model$/, ''));
console.log(failed.length ? `\n${failed.length} required item(s) missing.` : `\nready. Voice engines: ${tts.join(', ') || 'none — use your own recording (tts.mjs --engine file)'}`);
process.exit(failed.length ? 1 : 0);
