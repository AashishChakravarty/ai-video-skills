/** Glow.tsx: a soft radial light sprite placed in canvas pixels, drawn behind or over a 3D stage. */
import { AbsoluteFill } from 'remotion';
import { rgba } from './lib';

/**
 * A radial glow centred on canvas pixel (x, y) with radius r. It is an alpha gradient rather than additive
 * blending: a transparent clip cannot carry an additive blend, but over the dark reel background it reads as one.
 */
export const Glow: React.FC<{ x: number; y: number; r: number; color: string; strength?: number }> = ({ x, y, r, color, strength = 0.5 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba(color, strength)}, ${rgba(color, strength * 0.35)} 50%, ${rgba(color, 0)} 100%)`,
      }}
    />
  </AbsoluteFill>
);
