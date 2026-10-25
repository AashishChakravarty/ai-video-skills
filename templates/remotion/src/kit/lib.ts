/**
 * lib.ts: shared types and pure, frame-based helpers for every clip. All motion derives from the absolute
 * reel frame (props.from + useCurrentFrame()); nothing keeps state and nothing reads the clock.
 */
import { spring, type SpringConfig } from 'remotion';

export type Palette = { bg: string; accent: string; success: string; text: string; white: string };

/** Props every clip receives from clips.json: its absolute frame span and the reel palette. */
export type ClipBase = { from: number; to: number; palette: Palette };

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const ease = {
  linear: (x: number) => x,
  inQuad: (x: number) => x * x,
  cubicOut: (x: number) => 1 - (1 - x) ** 3,
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  expoOut: (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  backOut: (x: number, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
};

/** Eased 0→1 progress of frame t through [start, start + dur). */
export const prog = (t: number, start: number, dur: number, fn: (x: number) => number = ease.linear) =>
  fn(dur > 0 ? clamp((t - start) / dur) : t >= start ? 1 : 0);

/** Remotion spring that starts at absolute frame `at` (0 before it), settling from `from` to `to`. */
export const springAt = (f: number, at: number, fps: number, opts: { from?: number; to?: number; config?: Partial<SpringConfig> } = {}) =>
  spring({ frame: Math.max(0, f - at), fps, from: opts.from ?? 0, to: opts.to ?? 1, config: opts.config });

/** Stateless integer hash → [0, 1); the deterministic stand-in for Math.random. */
export function hash(...ns: number[]) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x5bd1e995);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/** World coords inside an OrthoStage (1 unit = 1 px, origin at canvas centre, y up) of canvas pixel (x, y). */
export const px = (x: number, y: number, width: number, height: number): [number, number, number] => [x - width / 2, height / 2 - y, 0];
