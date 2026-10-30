// Branch comparison (PRD §44 "The system compares outcomes"), computed from branch states. Pure: no React Native imports.
import type { Branch, Discovery, Relationship, Tier } from '@shared/types';

export interface BranchStats {
  events: number;
  tiers: Record<Tier, number>;
  sequences: number;
  achieved: number;
  beatsSatisfied: number;
  beatIndex: number;
  setups: { open: number; candidates: number; paidOff: number };
  discoveries: { total: number; promoted: number };
}

export function branchStats(branch: Branch, discoveries: Discovery[]): BranchStats {
  const { events, sequences, beats, beatIndex, setups } = branch.state;
  const tiers: Record<Tier, number> = { critical: 0, success: 0, complication: 0, failure: 0 };
  for (const e of events) if (e.resolution) tiers[e.resolution.tier]++;
  const mine = discoveries.filter((d) => d.branchId === branch.id);
  return {
    events: events.length,
    tiers,
    sequences: sequences.length,
    achieved: sequences.filter((s) => s.status === 'achieved').length,
    beatsSatisfied: beats.filter((b) => b.status === 'satisfied').length,
    beatIndex,
    setups: {
      open: setups.filter((s) => s.status === 'open').length,
      candidates: setups.filter((s) => s.status === 'payoff-candidate').length,
      paidOff: setups.filter((s) => s.status === 'paid-off').length,
    },
    discoveries: { total: mine.length, promoted: mine.filter((d) => d.status === 'promoted').length },
  };
}

/** Moments both branches share before they diverge (branches copy their parent's events, ids included). */
export function sharedHistory(a: Branch, b: Branch): number {
  const x = a.state.events;
  const y = b.state.events;
  let i = 0;
  while (i < x.length && i < y.length && x[i]!.id === y[i]!.id) i++;
  return i;
}

export interface TrustDifference {
  relationship: Relationship;
  a: number;
  b: number;
}

/** Directed relationships present in both branches whose trust ended up different. */
export function trustDifferences(a: Branch, b: Branch): TrustDifference[] {
  const key = (r: Relationship) => `${r.from}>${r.to}`;
  const other = new Map(b.state.relationships.map((r) => [key(r), r]));
  return a.state.relationships.flatMap((r) => {
    const match = other.get(key(r));
    return match && match.trust !== r.trust ? [{ relationship: r, a: r.trust, b: match.trust }] : [];
  });
}
