/**
 * Example.tsx: the pattern for a reel's own 3D shot. A tilted ring of glowing nodes pops in one by one around
 * a canvas point, orbits and flashes on a script anchor. Copy it, rename it, register it in registry.ts:
 * absolute frame = props.from + useCurrentFrame(), anchors arrive as absolute frames in props, sizes in px.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ease, lerp, prog, px, type ClipBase } from '../kit/lib';
import { OrthoStage } from '../kit/OrthoStage';

export type ExampleProps = ClipBase & { x: number; y: number; radius: number; count: number; popAt: number; flashAt: number };

export const Example: React.FC<ExampleProps> = ({ from, palette, x, y, radius, count, popAt, flashAt }) => {
  const { width, height } = useVideoConfig();
  const f = from + useCurrentFrame();
  const flash = 1 - prog(f, flashAt, 12);
  const lit = f >= flashAt ? flash : 0;
  const nodes = Array.from({ length: count }, (_, i) => {
    const th = (i / count) * Math.PI * 2 + f * 0.01;
    return { i, s: prog(f, popAt + i * 3, 10, ease.backOut), pos: [Math.cos(th) * radius, 0, Math.sin(th) * radius] as const };
  });
  const [cx, cy] = px(x, y, width, height);
  return (
    <AbsoluteFill>
      <OrthoStage accent={palette.accent} white={palette.white}>
        <group position={[cx, cy, 0]} rotation={[0.5, 0, 0]}>
          {nodes.map(({ i, s, pos }) => (
            <mesh key={i} position={pos} scale={s}>
              <sphereGeometry args={[radius * 0.16, 32, 32]} />
              <meshStandardMaterial color={palette.bg} metalness={0.4} roughness={0.35} emissive={i % 3 ? palette.accent : palette.success} emissiveIntensity={lerp(0.5, 1.6, lit)} />
            </mesh>
          ))}
        </group>
      </OrthoStage>
    </AbsoluteFill>
  );
};
