import type { ReactNode } from 'react';

import type { Permission } from '@shared/structure';

import { useProject } from '@/lib/session';

/** Renders children only when my role has `perm` in the current project (e.g. seeMeta for structure). */
export function Gate({ perm, fallback = null, children }: { perm: Permission; fallback?: ReactNode; children: ReactNode }) {
  return <>{useProject().can(perm) ? children : fallback}</>;
}
