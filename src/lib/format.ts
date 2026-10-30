// App-side labels and small formatters that the shared contract doesn't carry.
import type { BranchMode, Discovery, DiscoveryKind, Participant, Role } from '@shared/types';

/** One-line role descriptions (PRD §5). */
export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: 'Final authority over what becomes canon.',
  director: 'Steers the simulation and selects between viable dramatic possibilities.',
  producer: 'Monitors progress, structural status, unresolved issues and decisions.',
  writer: 'Defines story intent and turns discoveries into canonical material.',
  performer: 'Inhabits a character and provides behavioural evidence.',
  observer: 'Takes part in the session without controlling a character.',
};

export const BRANCH_MODE_LABEL: Record<BranchMode, string> = {
  origin: 'Origin',
  replay: 'Replay',
  variation: 'Variation',
  escalation: 'Escalation',
  'character-reinterpretation': 'Character reinterpretation',
  'goal-reinterpretation': 'Goal reinterpretation',
};

export const DISCOVERY_KIND_LABEL: Record<DiscoveryKind, string> = {
  character: 'Character',
  story: 'Story',
  theme: 'Theme',
  relationship: 'Relationship',
  structure: 'Structure',
  divergence: 'Divergence',
  'setup-payoff': 'Setup / payoff',
  empathy: 'Empathy',
};

export const DISCOVERY_STATUS_LABEL: Record<Discovery['status'], string> = {
  new: 'Awaiting decision',
  considering: 'Considering',
  promoted: 'Promoted to canon',
  rejected: 'Rejected',
};

/** A participant counts as active when seen within this window. */
export const ACTIVE_WINDOW_MS = 2 * 60_000;

export const isActive = (p: Participant, now = Date.now()): boolean =>
  now - Date.parse(p.lastSeenAt) < ACTIVE_WINDOW_MS;

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!(minutes >= 1)) return 'just now';
  // No-break spaces keep the phrase whole when the line wraps (never "found 2 min / ago").
  if (minutes < 60) return `${minutes}\u00A0min\u00A0ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}\u00A0h\u00A0ago`;
  return `${Math.floor(hours / 24)}\u00A0d\u00A0ago`;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
