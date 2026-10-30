// Domain contract shared by the server (Node, type-stripped) and the Expo app.
// Types only — no runtime code here. Runtime constants live in shared/structure.ts.

export type ID = string;
export type ISODate = string;

// ───────────────────────── Authority & canon ─────────────────────────

export type Role = 'owner' | 'director' | 'producer' | 'writer' | 'performer' | 'observer';

/** Every story element carries one of these (PRD §8). */
export type CanonStatus = 'locked' | 'canon' | 'proposed' | 'emergent' | 'unknown' | 'rejected';

export interface Participant {
  id: ID;
  name: string;
  role: Role;
  /** Character this participant performs (performers; owner/director may also act as any character). */
  characterId?: ID;
  joinedAt: ISODate;
  lastSeenAt: ISODate;
  /** Server-only credential proving a caller holds this seat; stripped from every view. */
  token?: string;
}

// ───────────────────────── Story Model (authored intent) ─────────────────────────

export type CanonKind = 'world-rule' | 'constraint' | 'fact' | 'question' | 'inspiration';

export interface CanonItem {
  id: ID;
  kind: CanonKind;
  text: string;
  status: CanonStatus;
  source: 'authored' | 'simulation';
  discoveryId?: ID;
  updatedAt: ISODate;
}

export interface Trait {
  id: ID;
  label: string;
  note?: string;
  status: CanonStatus;
  source: 'authored' | 'emergent';
}

/** PRD §10 Character World-Fit Engine. Plain prose fields. */
export interface WorldFit {
  startingState: string;
  worldRequirements: string;
  existingStrengths: string;
  traitGaps: string;
  falseStrengths: string;
  requiredAdaptation: string;
  resistance: string;
  cost: string;
  finalState: string;
}

/** Action domains the resolution engine rates capability in (0–5). */
export type Domain =
  | 'physical'
  | 'persuade'
  | 'deceive'
  | 'intimidate'
  | 'investigate'
  | 'stealth'
  | 'craft'
  | 'empathize';

export type CharacterRole = 'protagonist' | 'antagonist' | 'ally' | 'supporting' | 'wildcard';

export interface Character {
  id: ID;
  name: string;
  role: CharacterRole;
  status: CanonStatus;
  summary: string;
  extrinsic: Trait[]; // PRD §9.1 — possessed through history/environment
  intrinsic: Trait[]; // PRD §9.2 — values, fears, wounds…
  adaptive: Trait[]; // PRD §9.3 — what the world forces them to develop
  goal: string;
  fear: string;
  secret: string;
  wound: string;
  /** What the writer declares the character values — compared against observed behaviour (PRD §31). */
  declaredValues: string[];
  capabilities: Record<Domain, number>; // 0–5
  resources: string[];
  worldFit?: WorldFit;
  /** The ONLY authored character info a performer sees in a blind session (PRD §32). */
  performerBrief: string;
  /** Optional photograph key (bundled illustrative images in the app). */
  image?: string;
  voice?: string; // speech notes for the screenplay compiler
}

/** Directed: `from` feels `trust` toward `to`. */
export interface Relationship {
  id: ID;
  from: ID;
  to: ID;
  label: string; // "sister", "former partner", "informant"…
  trust: number; // -5..5
  tension: number; // 0..5
  notes: string;
}

export interface StoryModel {
  title: string;
  logline: string;
  premise: string;
  genre: string;
  medium: string; // feature, episode, limited series…
  tone: string;
  audience: string;
  targetDuration: string;
  theme: string; // thematic statement, e.g. "Revenge destroys the identity of the person pursuing it."
  thematicConflict: string; // e.g. "justice vs revenge"
  philosophicalConflict: string;
  canon: CanonItem[]; // world rules, constraints, facts, unknowns, inspirations
  characters: Character[];
  relationships: Relationship[]; // authored baseline; the simulation evolves its own copy
  protagonistId: ID;
}

// ───────────────────────── Structure (PRD §12–15, §24–25) ─────────────────────────

export type StcBeatKey =
  | 'opening-image'
  | 'theme-stated'
  | 'set-up'
  | 'catalyst'
  | 'debate'
  | 'break-into-two'
  | 'b-story'
  | 'fun-and-games'
  | 'midpoint'
  | 'bad-guys-close-in'
  | 'all-is-lost'
  | 'dark-night-of-the-soul'
  | 'break-into-three'
  | 'finale'
  | 'final-image';

export interface BeatState {
  key: StcBeatKey;
  status: 'pending' | 'active' | 'satisfied';
  /** Ids of BEAT_REQUIREMENTS[key] entries judged satisfied, with the event that satisfied them. */
  conditionsMet: { requirementId: string; eventId: ID }[];
  notes: string;
  chosenOpportunityId?: ID;
}

/** Edson Hero Goal Sequence (PRD §13): a visible short-term goal ended by "fresh news". */
export interface HeroGoalSequence {
  id: ID;
  number: number; // 1-based HGS count across the story
  beatKey: StcBeatKey; // beat active when it opened
  goal: string;
  stake: string;
  obstacle: string;
  progress: number;
  required: number; // progress needed to achieve the goal (default 3)
  status: 'active' | 'achieved' | 'redirected' | 'abandoned';
  freshNews?: string; // the news that closed it
  openedAt: ISODate;
  closedAt?: ISODate;
}

export interface Scene {
  id: ID;
  sequenceId: ID;
  heading: string; // "INT. HARBOR OFFICE – NIGHT"
  situation: string;
  presentCharacterIds: ID[];
  status: 'open' | 'closed';
  shift?: string; // meaningful change the scene produced (filled on close)
  /** Optional photograph key (bundled illustrative images in the app). */
  image?: string;
}

// ───────────────────────── Resolution (PRD §18–23) ─────────────────────────

export type Risk = 'low' | 'medium' | 'high' | 'extreme';
export type Tier = 'critical' | 'success' | 'complication' | 'failure';

export interface Modifier {
  label: string; // "Capability: intimidate 4", "Trust −2", "Evidence in hand"
  value: number;
}

/** Probabilities 0..1, summing to 1. */
export interface Odds {
  critical: number;
  success: number;
  complication: number;
  failure: number;
}

/** One way to attempt the declared intent, with its dramatic shape exposed (PRD §22, §47). */
export interface Approach {
  id: ID;
  label: string; // "Ask directly", "Bluff", "Threaten to expose her"
  description: string;
  domain: Domain;
  risk: Risk;
  targetId?: ID; // character resisting / affected
  dc: number;
  modifiers: Modifier[];
  modifierTotal: number;
  odds: Odds;
  progressOnSuccess: number;
  consequencePreview: string; // what is at risk — never "good/bad choice"
  isPlayerOwn: boolean; // the player's literal freeform action
  /** The side of the thematic conflict this move leans toward ("revenge"). Director-facing: redacted without seeMeta. */
  themePull?: string;
}

export interface ActionInterpretation {
  intent: string; // "force truth through confrontation"
  domain: Domain;
  targetId?: ID;
  obstacle: string;
  stakes: string;
  /** False when nothing meaningful hangs on it (PRD §50) — Director narrates without a roll. */
  needsRoll: boolean;
  /** Director reminder of goal/stakes/pressure shown to the performer (PRD §17 "Remind"). */
  reminder: string;
  themeRelevance?: string;
}

export interface PendingAction {
  id: ID;
  participantId: ID;
  characterId: ID;
  input: string; // verbatim freeform input (provenance: PERFORMED); '' when `proposed`
  /** The Director offered these moves before anything was declared: the chosen one is not performed wording. */
  proposed?: boolean;
  interpretation: ActionInterpretation;
  approaches: Approach[];
  createdAt: ISODate;
}

export interface Resolution {
  approachId: ID;
  approachLabel: string;
  intent: string;
  domain: Domain;
  risk: Risk;
  dc: number;
  modifiers: Modifier[];
  modifierTotal: number;
  roll: number; // d20
  total: number; // roll + modifierTotal
  tier: Tier;
  odds: Odds;
}

// ───────────────────────── Effects & persistence (PRD §26–30) ─────────────────────────

export type EmpathySignal =
  | 'courage'
  | 'unfair-injury'
  | 'skill'
  | 'humour'
  | 'kindness'
  | 'danger'
  | 'being-loved'
  | 'hard-work'
  | 'obsession';

export type ThemeStance = 'reinforce' | 'contradict' | 'develop' | 'tension';

/** Typed story-state changes. Every effect carries a human `label` for display. */
export type Effect =
  | { type: 'trust'; label: string; from: ID; to: ID; delta: number }
  | { type: 'tension'; label: string; a: ID; b: ID; delta: number }
  | { type: 'knowledge'; label: string; characterId: ID; fact: string }
  | { type: 'goal-progress'; label: string; delta: number }
  | { type: 'resource'; label: string; characterId: ID; add?: string; remove?: string }
  | { type: 'condition'; label: string; characterId: ID; condition: string; clear?: boolean }
  | { type: 'reputation'; label: string; characterId: ID; text: string }
  | { type: 'promise'; label: string; from: ID; to: ID; text: string }
  | { type: 'betrayal'; label: string; from: ID; to: ID; text: string }
  | { type: 'setup'; label: string; text: string }
  | { type: 'reinforce'; label: string; setupId: ID }
  | { type: 'payoff'; label: string; setupId: ID; text: string }
  | { type: 'theme'; label: string; stance: ThemeStance; text: string }
  | { type: 'empathy'; label: string; characterId: ID; signal: EmpathySignal; text: string }
  | { type: 'behavior'; label: string; characterId: ID; trait: string; text: string };

export interface ObservedBehavior {
  trait: string; // "aggression under pressure"
  text: string;
  eventId: ID;
  domain?: Domain;
}

/** Per-character simulation state; persists across scenes (PRD §28). */
export interface CharacterState {
  characterId: ID;
  knowledge: string[];
  conditions: string[];
  resources: string[];
  reputation: string[];
  promises: string[];
  betrayals: string[];
  behaviors: ObservedBehavior[];
  empathy: { signal: EmpathySignal; text: string; eventId: ID }[];
}

export interface Setup {
  id: ID;
  text: string;
  createdEventId: ID;
  reinforcementEventIds: ID[];
  status: 'open' | 'payoff-candidate' | 'paid-off' | 'dropped';
  payoffEventId?: ID;
  payoffText?: string;
}

export interface ThemeSignal {
  id: ID;
  stance: ThemeStance;
  text: string;
  eventId: ID;
}

// ───────────────────────── Narrative State Graph (PRD §40) ─────────────────────────

export type NodeKind =
  | 'character'
  | 'event'
  | 'scene'
  | 'goal'
  | 'secret'
  | 'relationship'
  | 'discovery'
  | 'setup'
  | 'beat';

export interface NodeRef {
  kind: NodeKind;
  id: ID;
}

export type EdgeRel =
  | 'causes'
  | 'knows'
  | 'wants'
  | 'opposes'
  | 'depends-on'
  | 'caused-by'
  | 'revealed-by'
  | 'foreshadows'
  | 'pays-off'
  | 'changes'
  | 'threatens';

export interface GraphEdge {
  id: ID;
  from: NodeRef;
  to: NodeRef;
  rel: EdgeRel;
  eventId?: ID;
  label?: string;
}

// ───────────────────────── Event log ─────────────────────────

export type EventKind =
  | 'narration' // Director describes the situation
  | 'action' // a character's attempted action (player input)
  | 'resolution' // dice outcome + narrated result
  | 'propagation' // ripple through the character web
  | 'directive' // Director (human) chose an opportunity / wrote a note
  | 'fresh-news' // closes an HGS and generates the next goal
  | 'beat-advance'
  | 'scene-open'
  | 'scene-close'
  | 'note';

export interface StoryEvent {
  id: ID;
  at: ISODate;
  kind: EventKind;
  sceneId?: ID;
  sequenceId?: ID;
  beatKey: StcBeatKey;
  actorId?: ID; // character
  participantId?: ID;
  text: string; // narrated / displayed text
  playerInput?: string; // verbatim performer wording (screenplay provenance: PERFORMED)
  resolution?: Resolution;
  /** On a resolution: the chooser's own answer to "why did you choose that?", asked after the dice. */
  reason?: string;
  effects?: Effect[];
  /**
   * Perspective (PRD §39): character ids who witnessed/know this event.
   * Undefined = everyone present. Required so independent perspectives can be added later.
   */
  visibleTo?: ID[];
  directorOnly?: boolean; // meta-layer events hidden from performers
}

// ───────────────────────── Beat guidance (PRD §15, §37) ─────────────────────────

export interface Opportunity {
  id: ID;
  beatKey: StcBeatKey;
  label: string; // "A", "B", "C"
  kind: string; // "Revelation", "Victory", "Reversal"…
  title: string;
  description: string;
  characterEffect: string;
  themeEffect: string;
  relationshipEffect: string;
  setupCreated: string;
  potentialPayoff: string;
  payoffSetupIds: ID[]; // open setups this would pay off
  risk: string;
  futureBranches: string[];
}

// ───────────────────────── Simulation state & branches (PRD §44–45) ─────────────────────────

export interface SimState {
  beats: BeatState[]; // always 15, in STC order
  beatIndex: number; // 0..14 — current STC beat
  sequences: HeroGoalSequence[];
  currentSequenceId: ID;
  scenes: Scene[];
  currentSceneId: ID;
  characters: Record<ID, CharacterState>;
  relationships: Relationship[];
  events: StoryEvent[];
  setups: Setup[];
  themeSignals: ThemeSignal[];
  edges: GraphEdge[];
  pending: PendingAction | null;
  opportunities: Opportunity[]; // latest generated cards for the current/upcoming beat
  directive?: string; // chosen opportunity steering the Director's next situations
}

export type BranchMode =
  | 'origin'
  | 'replay' // same conditions
  | 'variation' // one major decision changes
  | 'escalation' // same scene, higher stakes
  | 'character-reinterpretation' // one character's internal priority changes
  | 'goal-reinterpretation'; // protagonist's immediate objective changes

export interface Branch {
  id: ID;
  name: string; // "Simulation B"
  mode: BranchMode;
  note: string;
  parentId?: ID;
  createdAt: ISODate;
  status: 'exploring' | 'canon' | 'archived';
  overrides?: { characterId?: ID; priority?: string; goal?: string; stakeShift?: number };
  start: SimState; // snapshot the branch began from (for replay)
  state: SimState; // live state
  /** State just before the last resolved decision, so a Variation can play it differently. Server-only. */
  checkpoint?: SimState;
}

// ───────────────────────── Discovery & crew (PRD §31–34, §54) ─────────────────────────

export type DiscoveryKind =
  | 'character'
  | 'story'
  | 'theme'
  | 'relationship'
  | 'structure'
  | 'divergence'
  | 'setup-payoff'
  | 'empathy';

export interface Discovery {
  id: ID;
  branchId: ID;
  sessionId?: ID;
  kind: DiscoveryKind;
  title: string;
  observation: string;
  declared?: string; // "Compassion"
  observed?: string; // "Aggression under pressure"
  interpretation?: string; // "Compassion may be conditional rather than foundational."
  directorQuestion?: string;
  options: string[]; // e.g. ["Character revelation", "Performance deviation", "Temporary story-state behaviour"]
  evidenceEventIds: ID[];
  characterId?: ID;
  status: 'new' | 'considering' | 'promoted' | 'rejected';
  resolution?: string; // chosen option / owner note
  decidedBy?: ID;
  createdAt: ISODate;
}

export type ReactionKind = 'surprised' | 'moved' | 'tense' | 'funny' | 'confused' | 'invested';

export interface Reaction {
  id: ID;
  eventId: ID;
  participantId: ID;
  kind: ReactionKind;
  note?: string;
  at: ISODate;
}

export type InterpretationKey = 'protagonistGoal' | 'coreFear' | 'sceneTone' | 'keyRelationship';

export interface Interpretation {
  id: ID;
  participantId: ID;
  branchId: ID;
  phase: 'before' | 'after';
  answers: Record<InterpretationKey, string>;
  at: ISODate;
}

export interface InterpretationReport {
  id: ID;
  branchId: ID;
  createdAt: ISODate;
  summary: string;
  rows: {
    key: InterpretationKey;
    answers: { participantId: ID; role: Role; answer: string; phase: 'before' | 'after' }[];
    divergenceBefore: number | null; // 0 aligned .. 1 fully divergent
    divergenceAfter: number | null;
    note: string; // "Interpretation divergence" framing — never judges participants
  }[];
  alignmentGain: number | null; // mean(divergenceBefore) − mean(divergenceAfter)
  highlights: string[]; // moments that affected people (from reactions)
  emergent: string[]; // discoveries that emerged collectively
}

export interface RehearsalSession {
  id: ID;
  branchId: ID;
  startedAt: ISODate;
  endedAt?: ISODate;
  participantIds: ID[];
}

// ───────────────────────── Screenplay (PRD §41–43) ─────────────────────────

export type DialogueProvenance = 'performed' | 'reconstructed' | 'generated';
export type ActionProvenance = 'observed' | 'directed' | 'connective';

export interface ScreenplayElement {
  id: ID;
  type: 'heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';
  text: string;
  /** dialogue → DialogueProvenance; action → ActionProvenance; others omit. */
  provenance?: DialogueProvenance | ActionProvenance;
  sourceEventIds: ID[];
  speakerId?: ID;
}

export interface ScreenplayDraft {
  id: ID;
  branchId: ID;
  title: string;
  createdAt: ISODate;
  sequenceId?: ID;
  sceneIds: ID[];
  version: number;
  elements: ScreenplayElement[];
  notes: string;
}

// ───────────────────────── Write Room: authored scripts ─────────────────────────

export type ScriptElementType = 'heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'shot';

export interface ScriptElement {
  id: ID;
  type: ScriptElementType;
  text: string;
}

/** One tracked edit to one element, by one participant, pending until the next revision is saved. */
export interface ScriptChange {
  id: ID;
  elementId: ID;
  kind: 'added' | 'edited' | 'removed';
  type: ScriptElementType;
  before?: string;
  after?: string;
  authorId: ID;
  at: ISODate;
  /** The revision this change went into; absent while pending. */
  revision?: number;
}

/** A saved snapshot of the whole script. */
export interface ScriptRevision {
  number: number;
  name: string;
  note: string;
  authorId: ID;
  createdAt: ISODate;
  elements: ScriptElement[];
}

export interface ScriptComment {
  id: ID;
  /** Anchored to an element; absent for notes on the whole script. */
  elementId?: ID;
  /** The anchored line as it read when the note was left. */
  quote?: string;
  text: string;
  authorId: ID;
  at: ISODate;
  resolved: boolean;
}

export interface Script {
  id: ID;
  title: string;
  createdAt: ISODate;
  createdBy: ID;
  updatedAt: ISODate;
  updatedBy: ID;
  /** Increments on every save, so clients can tell whose copy is newer. */
  version: number;
  elements: ScriptElement[];
  revisions: ScriptRevision[];
  changes: ScriptChange[];
  comments: ScriptComment[];
  /** The compiled draft this script was started from, if any. */
  fromDraftId?: ID;
}

// ───────────────────────── Project ─────────────────────────

export interface Project {
  id: ID;
  version: number; // increments on every mutation
  createdAt: ISODate;
  updatedAt: ISODate;
  model: StoryModel;
  participants: Participant[];
  settings: { blindMode: boolean };
  branches: Branch[];
  activeBranchId: ID;
  sessions: RehearsalSession[];
  activeSessionId?: ID;
  discoveries: Discovery[];
  reactions: Reaction[];
  interpretations: Interpretation[];
  reports: InterpretationReport[];
  screenplays: ScreenplayDraft[];
  /** Write Room scripts. Older saved projects may lack it; the store fills it in. */
  scripts: Script[];
  /** Set on views sent to a performer in blind mode: authored info outside their brief was stripped. */
  redacted?: boolean;
}

export interface ProjectSummary {
  id: ID;
  title: string;
  logline: string;
  genre: string;
  updatedAt: ISODate;
  participantCount: number;
  beatKey: StcBeatKey;
}
