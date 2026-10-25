/**
 * OrthoStage.tsx: a full-frame, transparent React Three Fiber canvas with an orthographic camera at
 * 1 unit = 1 canvas pixel (origin at the centre, y up; place things with px()), plus a key/fill/rim light rig
 * tuned for objects on the dark reel background. Children must animate from useCurrentFrame(), never useFrame().
 */
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig } from 'remotion';

type Props = { accent: string; white?: string; keyLight?: number; children: React.ReactNode };

/** The stage canvas sized to the composition, with lights; `keyLight` scales the key light (default 2.6). */
export const OrthoStage: React.FC<Props> = ({ accent, white = '#FFFFFF', keyLight = 2.6, children }) => {
  const { width, height } = useVideoConfig();
  const reach = Math.max(width, height);
  return (
    <AbsoluteFill>
      <ThreeCanvas orthographic width={width} height={height} camera={{ position: [0, 0, 2000], zoom: 1, near: 0.1, far: 6000 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[-0.4 * reach, 0.7 * reach, reach]} intensity={keyLight} color={white} />
        <pointLight position={[0.3 * reach, 0.2 * reach, -0.3 * reach]} intensity={2.2} decay={0} color={accent} />
        <pointLight position={[-0.3 * reach, -0.2 * reach, -0.3 * reach]} intensity={1.2} decay={0} color={white} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
