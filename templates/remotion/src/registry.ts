/** registry.ts: clips.json `component` names → clip components. Add every new clip here. */
import type { ComponentType } from 'react';
import { Example } from './clips/Example';
import { Logo3D } from './clips/Logo3D';

export const REGISTRY: Record<string, ComponentType<any>> = { Logo3D, Example };
