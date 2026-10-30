// Which surface a component sits on. Paper (cards, sheets, notes) provides 'paper'; everything else is the desk.
import { createContext, use, type ReactNode } from 'react';

import type { Surface } from './tokens';

const SurfaceContext = createContext<Surface>('desk');

export function SurfaceProvider({ surface, children }: { surface: Surface; children: ReactNode }) {
  return <SurfaceContext value={surface}>{children}</SurfaceContext>;
}

export const useSurface = (): Surface => use(SurfaceContext);
