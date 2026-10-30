// Runtime constants shared by server and app. Only type-only imports here so Node's
// type stripping and Metro both load it without a build step.
import type {
  CanonStatus,
  Domain,
  EmpathySignal,
  InterpretationKey,
  ReactionKind,
  Risk,
  Role,
  StcBeatKey,
  Tier,
} from './types.ts';

export interface BeatRequirement {
  id: string;
  text: string;
}

export interface StcBeatDef {
  key: StcBeatKey;
  name: string;
  act: 1 | 2 | 3;
  /** Approximate position in a feature, percent of runtime. */
  at: string;
  purpose: string;
  /** Dramatic requirements (PRD §25) — the beat advances when these are satisfied, never on a timer. */
  requirements: BeatRequirement[];
}

/** Save the Cat! 15-beat scaffold (PRD §12) — the structural operating system, not a law. */
export const STC_BEATS: StcBeatDef[] = [
  { key: 'opening-image', name: 'Opening Image', act: 1, at: '0–1%',
    purpose: "A snapshot of the protagonist’s world and flaw before anything changes.",
    requirements: [
      { id: 'world-shown', text: 'The protagonist is shown operating in their established world' },
      { id: 'flaw-visible', text: 'A flaw or unmet need is visible in behaviour' },
    ] },
  { key: 'theme-stated', name: 'Theme Stated', act: 1, at: '5%',
    purpose: "Someone poses the thematic question the protagonist doesn’t yet understand.",
    requirements: [{ id: 'theme-voiced', text: 'A character voices or embodies the thematic question' }] },
  { key: 'set-up', name: 'Set-Up', act: 1, at: '1–10%',
    purpose: "Establish stakes, relationships and what’s missing in the protagonist’s life.",
    requirements: [
      { id: 'relationships-established', text: 'Key relationships are shown under light pressure' },
      { id: 'stakes-established', text: 'What the protagonist stands to lose is established' },
    ] },
  { key: 'catalyst', name: 'Catalyst', act: 1, at: '10%',
    purpose: 'An event disrupts the established state.',
    requirements: [{ id: 'disruption', text: 'The protagonist encounters an event that disrupts their established state' }] },
  { key: 'debate', name: 'Debate', act: 1, at: '10–20%',
    purpose: 'The protagonist resists or questions the course of action.',
    requirements: [
      { id: 'resistance', text: 'The protagonist meaningfully resists or questions the next course of action' },
      { id: 'cost-weighed', text: 'The cost of acting is made concrete' },
    ] },
  { key: 'break-into-two', name: 'Break into Two', act: 2, at: '20%',
    purpose: 'The protagonist chooses to enter the new world.',
    requirements: [{ id: 'active-choice', text: 'The protagonist makes an active, costly choice to pursue the goal' }] },
  { key: 'b-story', name: 'B Story', act: 2, at: '22%',
    purpose: 'A relationship that carries the theme begins or deepens.',
    requirements: [{ id: 'b-relationship', text: 'A relationship that carries the theme is introduced or deepened' }] },
  { key: 'fun-and-games', name: 'Fun and Games', act: 2, at: '20–50%',
    purpose: 'The promise of the premise — the protagonist tests the new world.',
    requirements: [
      { id: 'premise-explored', text: 'The premise is explored through pursuit of goals' },
      { id: 'opposition-rising', text: 'Opposition increases across attempts' },
    ] },
  { key: 'midpoint', name: 'Midpoint', act: 2, at: '50%',
    purpose: 'A major reversal — false victory or false defeat — and the stakes rise.',
    requirements: [
      { id: 'reversal', text: "A major reversal changes the protagonist’s understanding or strategic position" },
      { id: 'stakes-raised', text: 'The stakes are raised' },
    ] },
  { key: 'bad-guys-close-in', name: 'Bad Guys Close In', act: 2, at: '50–75%',
    purpose: 'External pressure and internal doubt tighten together.',
    requirements: [
      { id: 'pressure-mounts', text: 'Opposition regroups and pressure mounts' },
      { id: 'team-fractures', text: 'Fractures or doubts appear among allies' },
    ] },
  { key: 'all-is-lost', name: 'All Is Lost', act: 2, at: '75%',
    purpose: 'The current strategy collapses.',
    requirements: [
      { id: 'strategy-collapse', text: 'The protagonist experiences a meaningful collapse of the current strategy' },
      { id: 'loss', text: 'Something or someone important is lost' },
    ] },
  { key: 'dark-night-of-the-soul', name: 'Dark Night of the Soul', act: 2, at: '75–80%',
    purpose: 'The protagonist confronts the truth they have avoided.',
    requirements: [{ id: 'reckoning', text: 'The protagonist confronts the internal truth they have avoided' }] },
  { key: 'break-into-three', name: 'Break into Three', act: 3, at: '80%',
    purpose: 'A and B stories combine into a new approach.',
    requirements: [{ id: 'synthesis', text: 'A new approach emerges from what was learned' }] },
  { key: 'finale', name: 'Finale', act: 3, at: '80–99%',
    purpose: 'The protagonist acts from the adapted self and the old world is transformed.',
    requirements: [
      { id: 'new-approach-applied', text: 'The protagonist acts from the adapted self' },
      { id: 'antagonist-confronted', text: 'The central opposition is confronted' },
      { id: 'setups-paid', text: 'Major setups are paid off' },
    ] },
  { key: 'final-image', name: 'Final Image', act: 3, at: '99–100%',
    purpose: 'A mirror of the opening image that shows the change.',
    requirements: [{ id: 'change-shown', text: 'The change from the opening image is visible' }] },
];

export const beatDef = (key: StcBeatKey): StcBeatDef => STC_BEATS.find((b) => b.key === key)!;

/** Edson's one-hero feature model (PRD §13) — a diagnostic, never enforced. */
export const HGS_GUIDE = { total: [20, 23], act1: 6, act2: 12, act3: [2, 5] } as const;

// ───────── Resolution tables (PRD §19–20). Server is authoritative; app shows them. ─────────

/** d20 + modifiers vs DC. */
export const DC: Record<Risk, number> = { low: 8, medium: 12, high: 16, extreme: 20 };
/** Goal progress granted on success — higher risk, faster progress (PRD §22). */
export const PROGRESS: Record<Risk, number> = { low: 1, medium: 2, high: 3, extreme: 3 };
/** Tier bands relative to DC: total ≥ DC+CRIT_MARGIN → critical (a natural 20 is always at least a success); ≥ DC → success; ≥ DC−COMPLICATION_BAND → complication; else failure. */
export const CRIT_MARGIN = 8;
export const COMPLICATION_BAND = 5;

export const RISK_LABEL: Record<Risk, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', extreme: 'Extreme risk' };
export const TIER_LABEL: Record<Tier, string> = {
  critical: 'Critical Success',
  success: 'Success',
  complication: 'Complication',
  failure: 'Failure',
};

export const DOMAINS: Domain[] = ['physical', 'persuade', 'deceive', 'intimidate', 'investigate', 'stealth', 'craft', 'empathize'];
export const DOMAIN_LABEL: Record<Domain, string> = {
  physical: 'Physical',
  persuade: 'Persuade',
  deceive: 'Deceive',
  intimidate: 'Intimidate',
  investigate: 'Investigate',
  stealth: 'Stealth',
  craft: 'Craft',
  empathize: 'Empathize',
};
export const emptyCapabilities = (): Record<Domain, number> =>
  Object.fromEntries(DOMAINS.map((d) => [d, 2])) as Record<Domain, number>;

// ───────── Labels ─────────

export const CANON_STATUSES: CanonStatus[] = ['locked', 'canon', 'proposed', 'emergent', 'unknown', 'rejected'];
export const CANON_LABEL: Record<CanonStatus, string> = {
  locked: 'Locked',
  canon: 'Canon',
  proposed: 'Proposed',
  emergent: 'Emergent',
  unknown: 'Unknown',
  rejected: 'Rejected',
};

/** Observations only — never converted into a score (PRD §11). */
export const EMPATHY_SIGNALS: Record<EmpathySignal, string> = {
  courage: 'Courage',
  'unfair-injury': 'Unfair injury',
  skill: 'Skill',
  humour: 'Humour',
  kindness: 'Kindness',
  danger: 'Danger',
  'being-loved': 'Being loved',
  'hard-work': 'Hard work',
  obsession: 'Obsession',
};

export const REACTIONS: Record<ReactionKind, { emoji: string; label: string }> = {
  surprised: { emoji: '😮', label: 'Surprised' },
  moved: { emoji: '💔', label: 'Moved' },
  tense: { emoji: '😬', label: 'Tense' },
  funny: { emoji: '😂', label: 'Funny' },
  confused: { emoji: '🤔', label: 'Confused' },
  invested: { emoji: '🔥', label: 'Invested' },
};

export const INTERPRETATION_QUESTIONS: Record<InterpretationKey, string> = {
  protagonistGoal: "What does the protagonist really want?",
  coreFear: 'What is their core fear?',
  sceneTone: 'What is the tone of what we just played?',
  keyRelationship: 'Which relationship matters most?',
};

// ───────── Authority model (PRD §6) ─────────

export const ROLES: Role[] = ['owner', 'director', 'producer', 'writer', 'performer', 'observer'];
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Project Owner',
  director: 'Director',
  producer: 'Producer',
  writer: 'Writer',
  performer: 'Performer',
  observer: 'Observer',
};

export type Permission =
  | 'editModel' // Story Bible / Character Lab edits
  | 'promoteCanon' // canon authority — owner only
  | 'direct' // opportunities, beats, scenes, sequences, branches, narration
  | 'seeMeta' // Director meta layer / structural dashboard
  | 'manageCrew' // assign characters, blind mode, sessions
  | 'analyze' // run discovery analysis, compile screenplay, reports
  | 'act' // declare actions (performers only as their assigned character)
  | 'react'; // reactions + interpretations

const PERMS: Record<Permission, Role[]> = {
  editModel: ['owner', 'director', 'producer', 'writer'],
  promoteCanon: ['owner'],
  direct: ['owner', 'director'],
  seeMeta: ['owner', 'director', 'producer'],
  manageCrew: ['owner', 'director'],
  analyze: ['owner', 'director', 'producer', 'writer'],
  act: ['owner', 'director', 'performer'],
  react: ['owner', 'director', 'producer', 'writer', 'performer', 'observer'],
};

export const can = (role: Role | undefined, perm: Permission): boolean => !!role && PERMS[perm].includes(role);
