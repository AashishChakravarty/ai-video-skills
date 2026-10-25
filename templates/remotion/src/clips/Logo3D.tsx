/**
 * Logo3D.tsx: any 24×24 SVG logo path (simple-icons format) extruded into a bevelled, lit 3D badge with a
 * glow behind it. It pops in, sways (or turns), can glide to a new spot and scale, then optionally freezes.
 * All times are absolute reel frames; positions and height are canvas pixels.
 */
import { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { Glow } from '../kit/Glow';
import { ease, lerp, prog, px, type ClipBase } from '../kit/lib';
import { OrthoStage } from '../kit/OrthoStage';

export type Logo3DProps = ClipBase & {
  path: string;
  x: number;
  y: number;
  height: number;
  color?: string;
  glow?: string;
  depth?: number;
  enter?: { at: number; frames: number };
  sway?: number;
  period?: number;
  turns?: number;
  move?: { at: number; frames: number; to: { x: number; y: number; scale: number } };
  freezeAfter?: number;
  exit?: { at: number; frames: number };
};

/** Extrudes the path (24-unit box, y flipped up, centred) and paints a text → colour → deep-colour vertical gradient. */
function buildLogo(path: string, depth: number, color: string, top: string, bg: string) {
  const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`);
  const shapes = svg.paths.flatMap(p => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: depth * 0.22, bevelSize: 0.45, bevelSegments: 6, curveSegments: 64 });
  geo.rotateX(Math.PI);
  geo.computeBoundingBox();
  const box = geo.boundingBox!, centre = new THREE.Vector3();
  box.getCenter(centre);
  geo.translate(-centre.x, -centre.y, -centre.z);
  const hi = new THREE.Color(top), mid = new THREE.Color(color), low = new THREE.Color(color).lerp(new THREE.Color(bg), 0.28);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), h = box.max.y - box.min.y, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + h / 2) / h;
    if (t > 0.6) c.copy(mid).lerp(hi, (t - 0.6) / 0.4);
    else c.copy(low).lerp(mid, t / 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return { geo, unitHeight: h };
}

export const Logo3D: React.FC<Logo3DProps> = p => {
  const { width, height, fps } = useVideoConfig();
  const f0 = p.from + useCurrentFrame();
  const f = p.freezeAfter === undefined ? f0 : Math.min(f0, p.freezeAfter);
  const color = p.color ?? p.palette.accent;
  const { geo, unitHeight } = useMemo(() => buildLogo(p.path, p.depth ?? 3.2, color, p.palette.text, p.palette.bg), [p.path, p.depth, color, p.palette.text, p.palette.bg]);

  const enter = p.enter ?? { at: p.from, frames: 12 };
  const pop = lerp(0.4, 1, prog(f, enter.at, enter.frames, ease.backOut));
  const m = p.move ? prog(f, p.move.at, p.move.frames, ease.expoOut) : 0;
  const cx = p.move ? lerp(p.x, p.move.to.x, m) : p.x;
  const cy = p.move ? lerp(p.y, p.move.to.y, m) : p.y;
  const k = pop * (p.move ? lerp(1, p.move.to.scale, m) : 1);
  const fade = prog(f0, enter.at, enter.frames * 0.4) * (p.exit ? 1 - prog(f0, p.exit.at, p.exit.frames) : 1);

  const sec = (f - enter.at) / fps;
  const phase = (sec / (p.period ?? 6)) * Math.PI * 2;
  const yaw = p.turns ? sec * p.turns * Math.PI * 2 : (p.sway ?? 0.45) * Math.sin(phase);
  const scale = (p.height / unitHeight) * k;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Glow x={cx} y={cy} r={p.height * 0.9 * k} color={p.glow ?? color} strength={0.42} />
      <OrthoStage accent={color} white={p.palette.white}>
        <group position={px(cx, cy, width, height)} scale={scale} rotation={[0.08 * Math.sin(phase), yaw, 0]}>
          <mesh geometry={geo}>
            <meshPhysicalMaterial vertexColors roughness={0.22} metalness={0.05} clearcoat={1} clearcoatRoughness={0.08} emissive={color} emissiveIntensity={0.12} />
          </mesh>
        </group>
      </OrthoStage>
    </AbsoluteFill>
  );
};
