/** FontGate.tsx: holds the frame until the reel fonts in public/fonts load, so clip text never falls back. */
import { loadFont } from '@remotion/fonts';
import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

const FONTS = [
  { family: 'Noto Sans Devanagari', file: 'NotoSansDevanagari-400.ttf', weight: '400' },
  { family: 'Noto Sans Devanagari', file: 'NotoSansDevanagari-800.ttf', weight: '800' },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-400.ttf', weight: '400' },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-700.ttf', weight: '700' },
];
const loaded = Promise.all(FONTS.map(f => loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, display: 'block' })));

/** Renders children once every reel font is loaded. */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('Loading reel fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loaded.then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
