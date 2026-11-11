/**
 * resolve-clips.mjs: turns timing references in clips.json into absolute reel frames, so clips follow the voice after
 * a re-take. Any frame number in a clip's `from`, `to` or props may instead be
 *   { "anchor": ["scene", "token", n?], "offset": -6 }      the n-th (0-based, as in K.anchor) @beat in anchors.json
 *   { "word": "company", "after": ["scene", "token"] }      the first spoken word (words.json) after that beat
 *   { "scene": "clues", "edge": "start" | "end" }           a scene's first / last spoken word (assets/reel-data.js)
 * frame = round(t × fps) + offset (default 0). Timing comes from the nearest folder above holding reel.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const KEYS = new Set(['anchor', 'word', 'after', 'scene', 'edge', 'offset']);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** { anchors, words, scenes } of the reel above `dir` (scenes from ../assets/reel-data.js, else words.json), or null outside a reel. */
export function loadTiming(dir) {
  for (let d = path.resolve(dir); d !== path.dirname(d); d = path.dirname(d)) {
    if (!existsSync(path.join(d, 'reel.json'))) continue;
    const words = json(path.join(d, 'words.json'));
    const data = path.join(dir, '../assets/reel-data.js');
    const reel = existsSync(data) ? JSON.parse(readFileSync(data, 'utf8').match(/window\.REEL\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)[1]) : null;
    return { anchors: json(path.join(d, 'anchors.json')), words: words.words, scenes: reel?.scenes ?? words.scenes };
  }
  return null;
}

/** A copy of `spec` with every timing reference replaced by its frame; throws naming the clip and the reference that does not resolve. */
export function resolveClips(spec, timing) {
  const bare = (w) => w.toLowerCase().replace(/[\p{P}\s]/gu, '');
  const time = (ref, id) => {
    const fail = (why) => { throw new Error(`clips.json "${id}": ${why} in ${JSON.stringify(ref)}`); };
    if (!timing) fail('no reel.json above this folder to resolve');
    const beat = ([scene, token, n = 0]) => timing.anchors.filter((a) => a.scene === scene && a.token === token)[n]?.t ?? fail(`no anchor ${scene}/${token}${n ? `#${n}` : ''} in anchors.json (use a current @beat from script.timed.md)`);
    if (ref.anchor) return beat(ref.anchor);
    if (ref.word) {
      const after = ref.after ? beat(ref.after) : -Infinity;
      return timing.words.find((w) => w.start > after && bare(w.word) === bare(ref.word))?.start ?? fail(`no spoken "${ref.word}"${ref.after ? ' after that anchor' : ''}`);
    }
    const s = timing.scenes.find((x) => x.id === ref.scene) ?? fail(`no scene "${ref.scene}"`);
    if (ref.edge && ref.edge !== 'start' && ref.edge !== 'end') fail('edge must be "start" or "end"');
    return ref.edge === 'end' ? s.end : s.start;
  };
  const walk = (v, id) => {
    if (Array.isArray(v)) return v.map((x) => walk(x, id));
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v);
    if (keys.every((k) => KEYS.has(k)) && (v.anchor || v.word || v.scene)) return Math.round(time(v, id) * spec.fps) + (v.offset ?? 0);
    return Object.fromEntries(keys.map((k) => [k, walk(v[k], id)]));
  };
  return { ...spec, clips: spec.clips.map((c) => walk(c, c.id)) };
}
