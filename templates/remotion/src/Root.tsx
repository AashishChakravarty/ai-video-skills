/**
 * Root.tsx: registers one composition per clips.json entry (id = clip id, length = to − from, size and fps
 * from the file), so the same clips render portrait or 16:9 by changing width/height. Every clip is wrapped
 * in FontGate and receives its absolute frame span and the reel palette as props.
 */
import type { ComponentType } from 'react';
import { Composition } from 'remotion';
import spec from '../clips.json';
import { FontGate } from './kit/FontGate';
import { REGISTRY } from './registry';

type ClipSpec = { id: string; component: string; from: number; to: number; props?: Record<string, unknown> };

const GATED: Record<string, ComponentType<Record<string, unknown>>> = Object.fromEntries(
  Object.entries(REGISTRY).map(([name, Clip]) => [
    name,
    (props: Record<string, unknown>) => (
      <FontGate>
        <Clip {...props} />
      </FontGate>
    ),
  ]),
);

export const RemotionRoot: React.FC = () => (
  <>
    {(spec.clips as ClipSpec[]).map(c => {
      const Clip = GATED[c.component];
      if (!Clip) throw new Error(`clips.json: clip "${c.id}" uses unknown component "${c.component}" (add it to src/registry.ts)`);
      return (
        <Composition
          key={c.id}
          id={c.id}
          component={Clip}
          durationInFrames={c.to - c.from}
          fps={spec.fps}
          width={spec.width}
          height={spec.height}
          defaultProps={{ ...c.props, from: c.from, to: c.to, palette: spec.palette }}
        />
      );
    })}
  </>
);
