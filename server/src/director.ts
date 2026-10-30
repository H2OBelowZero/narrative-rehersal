// AI Director (PRD §16–17, §36): omniscient curator of possibilities — never the author.
// Uses Claude when credentials are configured, otherwise a deterministic offline Director so the app always runs.
// Any Claude failure (network, refusal, truncation, malformed or invalid output) falls back to the offline
// Director for that one call, so a live rehearsal never stalls on the model.
import Anthropic from '@anthropic-ai/sdk';
import { DOMAINS, EMPATHY_SIGNALS, INTERPRETATION_QUESTIONS, ROLE_LABEL, TIER_LABEL, beatDef } from '../../shared/structure.ts';
import type {
  ActionInterpretation,
  ActionProvenance,
  Approach,
  DialogueProvenance,
  Discovery,
  DiscoveryKind,
  Effect,
  EventKind,
  ID,
  Interpretation,
  InterpretationKey,
  Opportunity,
  PendingAction,
  Project,
  Reaction,
  Resolution,
  Risk,
  Scene,
  ScreenplayElement,
  SimState,
  StcBeatKey,
  StoryEvent,
  ThemeStance,
  Trait,
} from '../../shared/types.ts';
import type { ApproachDraft } from './engine.ts';
import * as offline from './director-offline.ts';

export interface DirectorContext {
  project: Project;
  sim: SimState; // active branch state
}

export interface OutcomeNarration {
  /** Present-tense, screen-direction prose of what happens (2–5 sentences). */
  narration: string;
  /** Immediate story-state changes. Every meaningful outcome changes something (PRD §50). */
  effects: Effect[];
  /** Character-web ripples beyond the scene (PRD §27): B tells C, C changes strategy… */
  propagation: { text: string; effects: Effect[]; visibleTo?: ID[] }[];
  /** Requirement ids of the CURRENT beat (STC_BEATS[..].requirements) this outcome satisfied. */
  beatRequirementsMet: string[];
  /** Present when the outcome delivers news that changes the immediate objective → next HGS. */
  freshNews?: { text: string; goal: string; stake: string; obstacle: string };
}

export type DiscoveryDraft = Pick<
  Discovery,
  | 'kind'
  | 'title'
  | 'observation'
  | 'declared'
  | 'observed'
  | 'interpretation'
  | 'directorQuestion'
  | 'options'
  | 'evidenceEventIds'
  | 'characterId'
>;

export interface ReportDraft {
  summary: string;
  highlights: string[];
  emergent: string[];
  /** One neutral "interpretation divergence" note per question — never judges a participant. */
  notes: Record<InterpretationKey, string>;
  /** Optional semantic divergence (0..1) per question/phase; engine.divergence() is used where absent. */
  divergence?: Partial<Record<InterpretationKey, { before: number | null; after: number | null }>>;
}

// ───────── Engine selection ─────────

const DEFAULT_MODEL = 'claude-opus-5';
const claudeEnabled = (): boolean =>
  process.env.DIRECTOR_ENGINE !== 'offline' && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const modelId = (): string => process.env.DIRECTOR_MODEL || DEFAULT_MODEL;

export function directorInfo(): { engine: 'claude' | 'offline'; model: string | null } {
  return claudeEnabled() ? { engine: 'claude', model: modelId() } : { engine: 'offline', model: null };
}

// ───────── Claude transport ─────────

// Identical bytes on every call: the system prompt is the cached prefix, so nothing volatile belongs here.
const SYSTEM_PROMPT = `You are the AI Director of a Narrative Rehearsal Platform: a film or television creative team plays its story as a live simulation before writing it. You combine four roles — Dungeon Master (you resolve actions and run the world), Film Director (you stage and pace), Dramaturg (you track structure, theme, setups and payoffs) and Omniscient Narrator (you know every secret, goal and fear). You are the curator of possibilities, never the author: you generate options and consequences; the human creative leads choose the direction, and only the Project Owner promotes anything to canon.

What you know that performers do not: the current Save the Cat beat and its dramatic requirements; the current Hero Goal Sequence (a visible, short-term goal with a stake and an obstacle, ended by "fresh news" that changes the immediate objective); every character's secret, goal, fear and declared values; open setups; thematic pressure. That meta layer stays out of performer-facing text: narration, reminders and consequence previews never mention beats, sequences, requirements, setups, progress numbers or theme labels, and never reveal a secret unless the outcome itself reveals it.

Your standing responsibilities: Remind (goal, stakes, pressure), Challenge (obstacles), Resolve (consequences), Escalate (make failure meaningful), Reveal (deliver information when it is earned), Maintain (continuity), Adapt (respond to the unexpected), Guide (present the next meaningful choice without removing agency).

Rules of play:
1. Fail forward. A critical success succeeds and creates an advantageous secondary consequence. A success advances the immediate goal. A complication partly works but creates a new problem. A failure makes the immediate action fail and escalates the situation: the other character refuses and alerts someone, a door closes, a threat grows. Never answer a setback with "nothing happens" or an invitation to try again; the protagonist moves into a harder version of the story.
2. Every meaningful action changes the situation, reveals information, deepens or damages a relationship, creates a future obligation, or forces a new decision. Express those changes as effects.
3. Bounded plausibility. Locked and canon world rules, constraints and facts are never contradicted, and rejected ideas are never used. Capability sets the baseline; outcomes stay within what this world and these characters make plausible. Build on what exists instead of inventing major new characters, powers or backstory.
4. Consequences persist: knowledge, injuries and conditions, relationships, promises, betrayals, reputation, resources and unresolved obligations carry across scenes. Never conveniently forget them.
5. Non-player characters are people, not props: each pursues their own goal, protects their own secret and acts from their own fear, including when the protagonist is not looking.
6. The character web is alive. An action ripples: B loses trust in A, B tells C, C changes strategy, D is endangered, A must choose. Model ripples as propagation limited to the characters who would plausibly learn of them.
7. There are no good or bad choices, only consequences. Never praise, grade or moralise a choice; describe what it did to the story.
8. Honour the story's tone and genre in every line. Narration is present tense, concrete, visual screen direction that names characters by name.
9. Fresh news is structural and rare: only when an outcome genuinely changes the protagonist's immediate objective, or the current goal has just been achieved. The next goal is physical, visible and short-term, and grows out of what just happened.
10. Empathy signals (courage, unfair injury, skill, humour, kindness, danger, being loved, hard work, obsession) are observations of what happened — never scores, ratings or percentages.
11. Differences between crew members' interpretations are "interpretation divergence", never a judgement that a participant misunderstood.
12. Provenance is honest. Never present invented material as something that happened in play or as words a performer said.
13. House style: never write an em dash or an en dash in anything you return. Use a comma, a colon, parentheses or a new sentence instead, and write number ranges with a hyphen (2-5). Screenplay scene headings use a plain hyphen (INT. HARBOR OFFICE - NIGHT). The one exception is a performer's own words quoted verbatim.

Effects vocabulary (use ids exactly as they appear in the story state; never invent ids):
- trust {from, to, delta}: from's trust in to changes by delta (−3..3; usually ±1 or ±2).
- tension {a, b, delta}: tension between two characters changes (−3..3).
- knowledge {characterId, fact}: a character now knows a fact (one sentence).
- resource {characterId, change: add|remove, item}; condition {characterId, condition, clear}; reputation {characterId, text}.
- promise / betrayal {from, to, text}: an obligation created, or broken.
- setup {text}: a new unresolved element that should pay off later. reinforce {setupId}: the moment references an open setup. payoff {setupId, text}: an open setup resolves.
- theme {stance: reinforce|contradict|develop|tension, text}: how the moment bears on the thematic statement.
- empathy {characterId, signal, text}: an empathy signal, phrased as an observation.
- behavior {characterId, trait, text}: what the character's behaviour showed, as a short trait phrase ("aggression under pressure", "deception", "compassion in action", "appeals to reason", "relentless curiosity", "physical risk-taking", "evasion", "resourcefulness"); used later to compare declared and observed values.
Goal progress is computed by the engine — never try to express it.

Respond with one JSON object matching the provided schema and nothing else. Be concise: every string earns its place.`;

type Effort = 'low' | 'medium' | 'high';
type JsonSchema = Record<string, unknown>;

let client: Anthropic | undefined;

async function viaClaude<T>(
  task: string,
  effort: Effort,
  schema: JsonSchema,
  content: string,
  parse: (raw: unknown) => T,
  fallback: () => T,
): Promise<T> {
  if (!claudeEnabled()) return fallback();
  try {
    // A stalled call would hold the rehearsal; time out and let the offline Director take the step instead.
    client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 });
    const response = await client.beta.messages.create({
      model: modelId(),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') throw new Error('the request was declined');
    if (response.stop_reason === 'max_tokens') throw new Error('the output was truncated');
    const block = response.content.find((b) => b.type === 'text');
    if (block?.type !== 'text') throw new Error('the response had no text');
    return parse(JSON.parse(block.text));
  } catch (err) {
    console.warn(`[director] ${task}: Claude unavailable (${err instanceof Error ? err.message : String(err)}); using the offline Director`);
    return fallback();
  }
}

// ───────── JSON schemas (structured outputs: every object closed, every property required) ─────────

const STR = { type: 'string' };
const INT = { type: 'integer' };
const NUM = { type: 'number' };
const BOOL = { type: 'boolean' };
const nullable = (s: JsonSchema): JsonSchema => ({ anyOf: [s, { type: 'null' }] });
const array = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
const enumOf = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const tagged = (type: string, properties: Record<string, JsonSchema>): JsonSchema =>
  object({ type: { type: 'string', const: type }, label: STR, ...properties });

const RISKS: Risk[] = ['low', 'medium', 'high', 'extreme'];
const STANCES: ThemeStance[] = ['reinforce', 'contradict', 'develop', 'tension'];
const DISCOVERY_KINDS: DiscoveryKind[] = ['character', 'story', 'theme', 'relationship', 'structure', 'divergence', 'setup-payoff', 'empathy'];
const ELEMENT_TYPES: ScreenplayElement['type'][] = ['heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
const DIALOGUE_PROVENANCE: DialogueProvenance[] = ['performed', 'reconstructed', 'generated'];
const ACTION_PROVENANCE: ActionProvenance[] = ['observed', 'directed', 'connective'];
const QUESTION_KEYS = Object.keys(INTERPRETATION_QUESTIONS) as InterpretationKey[];

const EFFECT: JsonSchema = {
  anyOf: [
    tagged('trust', { from: STR, to: STR, delta: INT }),
    tagged('tension', { a: STR, b: STR, delta: INT }),
    tagged('knowledge', { characterId: STR, fact: STR }),
    tagged('resource', { characterId: STR, change: enumOf(['add', 'remove']), item: STR }),
    tagged('condition', { characterId: STR, condition: STR, clear: BOOL }),
    tagged('reputation', { characterId: STR, text: STR }),
    object({ type: enumOf(['promise', 'betrayal']), label: STR, from: STR, to: STR, text: STR }),
    tagged('setup', { text: STR }),
    tagged('reinforce', { setupId: STR }),
    tagged('payoff', { setupId: STR, text: STR }),
    tagged('theme', { stance: enumOf(STANCES), text: STR }),
    tagged('empathy', { characterId: STR, signal: enumOf(Object.keys(EMPATHY_SIGNALS)), text: STR }),
    tagged('behavior', { characterId: STR, trait: STR, text: STR }),
  ],
};
const EFFECTS = array({ $ref: '#/$defs/effect' });
const withEffects = (schema: JsonSchema): JsonSchema => ({ ...schema, $defs: { effect: EFFECT } });

const INTERPRET_SCHEMA = object({
  interpretation: object({
    intent: STR,
    domain: enumOf(DOMAINS),
    targetId: nullable(STR),
    obstacle: STR,
    stakes: STR,
    needsRoll: BOOL,
    reminder: STR,
    themeRelevance: nullable(STR),
  }),
  approaches: array(
    object({
      label: STR,
      description: STR,
      domain: enumOf(DOMAINS),
      risk: enumOf(RISKS),
      targetId: nullable(STR),
      circumstances: array(object({ label: STR, value: INT })),
      consequencePreview: STR,
      isPlayerOwn: BOOL,
      themePull: nullable(STR),
    }),
  ),
});
const NO_ROLL_SCHEMA = withEffects(object({ narration: STR, effects: EFFECTS, beatRequirementsMet: array(STR) }));
const OUTCOME_SCHEMA = withEffects(
  object({
    narration: STR,
    effects: EFFECTS,
    propagation: array(object({ text: STR, effects: EFFECTS, visibleTo: array(STR) })),
    beatRequirementsMet: array(STR),
    freshNews: nullable(object({ text: STR, goal: STR, stake: STR, obstacle: STR })),
  }),
);
const OPPORTUNITY_SCHEMA = object({
  cards: array(
    object({
      kind: STR,
      title: STR,
      description: STR,
      characterEffect: STR,
      themeEffect: STR,
      relationshipEffect: STR,
      setupCreated: STR,
      potentialPayoff: STR,
      payoffSetupIds: array(STR),
      risk: STR,
      futureBranches: array(STR),
    }),
  ),
});
const DISCOVERY_SCHEMA = object({
  discoveries: array(
    object({
      kind: enumOf(DISCOVERY_KINDS),
      title: STR,
      observation: STR,
      declared: nullable(STR),
      observed: nullable(STR),
      interpretation: nullable(STR),
      directorQuestion: nullable(STR),
      options: array(STR),
      evidenceEventIds: array(STR),
      characterId: nullable(STR),
    }),
  ),
});
const REPORT_SCHEMA = object({
  summary: STR,
  highlights: array(STR),
  emergent: array(STR),
  notes: object(Object.fromEntries(QUESTION_KEYS.map((k) => [k, STR]))),
  divergence: object(Object.fromEntries(QUESTION_KEYS.map((k) => [k, object({ before: nullable(NUM), after: nullable(NUM) })]))),
});
const SCREENPLAY_SCHEMA = object({
  elements: array(
    object({
      type: enumOf(ELEMENT_TYPES),
      text: STR,
      provenance: nullable(enumOf([...DIALOGUE_PROVENANCE, ...ACTION_PROVENANCE])),
      sourceEventIds: array(STR),
      speakerId: nullable(STR),
    }),
  ),
});

// ───────── Validation: the schema guarantees shape; these guarantee meaning ─────────

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
function obj(x: unknown, what: string): Json {
  if (!isObj(x)) throw new Error(`${what} is not an object`);
  return x;
}
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const objects = (x: unknown): Json[] => list(x).filter(isObj);
/**
 * House style (the no-dash rule in SYSTEM_PROMPT), enforced in case the model slips: number ranges become hyphens,
 * any other em/en dash becomes a comma. Every Director string passes through here except screenplay elements,
 * which keep performed words verbatim.
 */
export const undash = (s: string): string =>
  s
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*[—–]+\s*/g, ', ')
    .replace(/,\s*([,.;:!?)])/g, '$1')
    .replace(/^,\s*/, '')
    .trim();

function text(x: unknown, what: string): string {
  if (typeof x !== 'string' || !x.trim()) throw new Error(`${what} is missing`);
  return undash(x);
}
const optText = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? undash(x) : undefined);
/** Model text exactly as written (trimmed): for screenplay elements, where performed words are quoted verbatim. */
const rawText = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
const texts = (x: unknown): string[] => list(x).map(optText).filter((s): s is string => !!s);
const clampInt = (x: unknown, lo: number, hi: number): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : 0;
const oneOf = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(x as T) ? (x as T) : fallback;
const unique = <T>(xs: T[]): T[] => [...new Set(xs)];
const PERCENTAGE = /\d+(?:\.\d+)?\s*%|\bpercent\b/i;

/** Resolvers that only let through ids that exist in the story state. */
function idsOf(ctx: DirectorContext) {
  const chars = new Set(ctx.project.model.characters.map((c) => c.id));
  const setups = new Set(offline.openSetups(ctx.sim).map((s) => s.id));
  const events = new Set(ctx.sim.events.map((e) => e.id));
  return {
    char: (x: unknown): ID | undefined => (typeof x === 'string' && chars.has(x) ? x : undefined),
    setup: (x: unknown): ID | undefined => (typeof x === 'string' && setups.has(x) ? x : undefined),
    event: (x: unknown): boolean => typeof x === 'string' && events.has(x),
  };
}
type Ids = ReturnType<typeof idsOf>;

/** One Claude effect → a contract Effect, or null when it references something that does not exist. */
function toEffect(x: unknown, ids: Ids): Effect | null {
  if (!isObj(x)) return null;
  const label = optText(x.label) ?? String(x.type);
  const character = ids.char(x.characterId);
  const note = optText(x.text);
  switch (x.type) {
    case 'trust': {
      const [from, to, delta] = [ids.char(x.from), ids.char(x.to), clampInt(x.delta, -3, 3)];
      return from && to && from !== to && delta ? { type: 'trust', label, from, to, delta } : null;
    }
    case 'tension': {
      const [a, b, delta] = [ids.char(x.a), ids.char(x.b), clampInt(x.delta, -3, 3)];
      return a && b && a !== b && delta ? { type: 'tension', label, a, b, delta } : null;
    }
    case 'knowledge': {
      const fact = optText(x.fact);
      return character && fact ? { type: 'knowledge', label, characterId: character, fact } : null;
    }
    case 'resource': {
      const item = optText(x.item);
      if (!character || !item) return null;
      return x.change === 'remove'
        ? { type: 'resource', label, characterId: character, remove: item }
        : { type: 'resource', label, characterId: character, add: item };
    }
    case 'condition': {
      const condition = optText(x.condition);
      return character && condition ? { type: 'condition', label, characterId: character, condition, clear: x.clear === true } : null;
    }
    case 'reputation':
      return character && note ? { type: 'reputation', label, characterId: character, text: note } : null;
    case 'promise':
    case 'betrayal': {
      const [from, to] = [ids.char(x.from), ids.char(x.to)];
      if (!from || !to || !note) return null;
      return x.type === 'promise' ? { type: 'promise', label, from, to, text: note } : { type: 'betrayal', label, from, to, text: note };
    }
    case 'setup':
      return note ? { type: 'setup', label, text: note } : null;
    case 'reinforce': {
      const setupId = ids.setup(x.setupId);
      return setupId ? { type: 'reinforce', label, setupId } : null;
    }
    case 'payoff': {
      const setupId = ids.setup(x.setupId);
      return setupId && note ? { type: 'payoff', label, setupId, text: note } : null;
    }
    case 'theme':
      return note ? { type: 'theme', label, stance: oneOf(x.stance, STANCES, 'tension'), text: note } : null;
    case 'empathy': {
      const signal = Object.hasOwn(EMPATHY_SIGNALS, String(x.signal)) ? (x.signal as keyof typeof EMPATHY_SIGNALS) : null;
      return character && signal && note && !PERCENTAGE.test(note) ? { type: 'empathy', label, characterId: character, signal, text: note } : null;
    }
    case 'behavior': {
      const trait = optText(x.trait);
      return character && trait ? { type: 'behavior', label, characterId: character, trait, text: note ?? trait } : null;
    }
    default:
      return null; // includes 'goal-progress' — the engine owns progress
  }
}
const effectsOf = (x: unknown, ids: Ids): Effect[] => list(x).map((e) => toEffect(e, ids)).filter((e): e is Effect => !!e);

// ───────── Story-state serializer ─────────

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const nameFor = (ctx: DirectorContext, id: ID): string => offline.charOf(ctx, id)?.name ?? id;

function eventLine(ctx: DirectorContext, e: StoryEvent): string {
  const tags = [
    e.kind,
    e.resolution && `${TIER_LABEL[e.resolution.tier]}; ${e.resolution.domain}, ${e.resolution.risk} risk`,
    e.directorOnly && 'director-only',
    e.visibleTo && `known only to ${e.visibleTo.map((id) => nameFor(ctx, id)).join(', ')}`,
  ].filter(Boolean);
  const actor = e.actorId ? ` ${nameFor(ctx, e.actorId)}:` : '';
  const performed = e.playerInput && e.playerInput !== e.text ? ` performer said "${clip(e.playerInput, 300)}" →` : '';
  const why = e.reason ? ` (chooser's stated reason: "${clip(e.reason, 200)}")` : '';
  return `- ${e.id} [${tags.join('; ')}]${actor}${performed} ${clip(e.text, 400)}${why}`;
}

const section = (title: string, lines: string[]): string[] => ['', `# ${title}`, ...(lines.length ? lines : ['- none'])];

/** Compact, deterministic snapshot of everything the Director knows (PRD §16). */
function storyContext(ctx: DirectorContext, withRecentEvents = true): string {
  const { project, sim } = ctx;
  const m = project.model;
  const name = (id: ID) => nameFor(ctx, id);
  const traits = (ts: Trait[]) => ts.filter((t) => t.status !== 'rejected').map((t) => `${t.label} [${t.status}]`).join('; ') || '—';
  const out: string[] = [
    '# STORY MODEL',
    `Title: ${m.title} | Genre: ${m.genre} | Medium: ${m.medium} | Tone: ${m.tone}`,
    `Logline: ${m.logline}`,
    `Premise: ${m.premise}`,
    `Theme: ${m.theme}`,
    `Thematic conflict: ${m.thematicConflict} | Philosophical conflict: ${m.philosophicalConflict}`,
    'World rules, constraints, facts and questions ([locked]/[canon] are binding, [proposed]/[emergent] provisional, [unknown] open, [rejected] never to be used):',
    ...m.canon.map((c) => `- [${c.status}] ${c.kind}: ${c.text}`),
  ];

  out.push('', `# CHARACTERS (protagonist: ${m.protagonistId})`);
  for (const c of m.characters) {
    const st = sim.characters[c.id];
    out.push(
      `- ${c.id} — ${c.name} (${c.role}; ${c.status}): ${c.summary}`,
      `  goal: ${c.goal} | fear: ${c.fear} | wound: ${c.wound}`,
      `  SECRET (hidden from the others): ${c.secret || '—'}`,
      `  declared values: ${c.declaredValues.join(', ') || '—'}`,
      `  traits — extrinsic: ${traits(c.extrinsic)} | intrinsic: ${traits(c.intrinsic)} | adaptive: ${traits(c.adaptive)}`,
      `  capabilities (0–5): ${DOMAINS.map((d) => `${d} ${c.capabilities[d] ?? 0}`).join(', ')}`,
    );
    if (c.voice) out.push(`  voice: ${c.voice}`);
    if (st) {
      out.push(
        `  now — resources: ${st.resources.join('; ') || '—'} | conditions: ${st.conditions.join('; ') || '—'}`,
        `  now knows: ${st.knowledge.slice(-10).join(' / ') || '—'}`,
      );
      const bonds = [
        st.promises.length && `promises: ${st.promises.join('; ')}`,
        st.betrayals.length && `betrayals: ${st.betrayals.join('; ')}`,
        st.reputation.length && `reputation: ${st.reputation.slice(-3).join('; ')}`,
      ].filter(Boolean);
      if (bonds.length) out.push(`  ${bonds.join(' | ')}`);
    }
  }

  out.push(
    ...section(
      'RELATIONSHIPS (directed; current simulation values; trust −5..5, tension 0..5)',
      sim.relationships.map((r) => `- ${name(r.from)} → ${name(r.to)} (${r.label}): trust ${r.trust}, tension ${r.tension}${r.notes ? ` — ${r.notes}` : ''}`),
    ),
  );

  const beat = offline.currentBeat(sim);
  const met = new Set(sim.beats[sim.beatIndex]?.conditionsMet.map((c) => c.requirementId));
  const seq = offline.currentSequence(sim);
  out.push(
    '',
    '# STRUCTURE (Director-only meta layer)',
    `Current Save the Cat beat: ${beat.name} [${beat.key}] — Act ${beat.act}, ~${beat.at}. ${beat.purpose}`,
    ...beat.requirements.map((q) => `- requirement ${q.id} [${met.has(q.id) ? 'met' : 'unmet'}]: ${q.text}`),
  );
  if (seq) {
    out.push(`Hero Goal Sequence #${seq.number} (${seq.status}): goal: ${seq.goal} | stake: ${seq.stake} | obstacle: ${seq.obstacle} | progress ${seq.progress} of ${seq.required}`);
  }
  for (const s of sim.sequences.filter((x) => x.id !== seq?.id).slice(-3)) {
    out.push(`Earlier: HGS #${s.number} ${s.status} — ${s.goal}${s.freshNews ? ` → fresh news: ${s.freshNews}` : ''}`);
  }

  const scene = offline.currentScene(sim);
  if (scene) {
    out.push(
      '',
      '# CURRENT SCENE',
      `${scene.heading} — ${scene.situation}`,
      `Present: ${scene.presentCharacterIds.map((id) => `${name(id)} (${id})`).join(', ') || 'no one listed'}`,
    );
  }
  out.push(
    ...section(
      'OPEN SETUPS (ids usable in reinforce / payoff)',
      offline.openSetups(sim).map((s) => `- ${s.id} [${s.status}; reinforced ${s.reinforcementEventIds.length}×]: ${s.text}`),
    ),
    ...section('RECENT THEME SIGNALS', sim.themeSignals.slice(-6).map((t) => `- ${t.stance}: ${t.text}`)),
    ...section(
      'CREW DISCOVERIES (what the team is considering or has promoted)',
      project.discoveries
        .filter((d) => d.branchId === project.activeBranchId && (d.status === 'considering' || d.status === 'promoted'))
        .slice(-8)
        .map((d) => `- [${d.status}] ${d.title}${d.observed ? ` — observed: ${d.observed}` : ''}${d.resolution ? ` — decided: ${d.resolution}` : ''}`),
    ),
  );

  const branch = project.branches.find((b) => b.id === project.activeBranchId);
  if (branch) {
    const o = branch.overrides;
    out.push('', '# BRANCH', `${branch.name} — mode: ${branch.mode}${branch.note ? ` — ${branch.note}` : ''}`);
    if (o) {
      const parts = [
        o.characterId && `character ${name(o.characterId)}`,
        o.priority && `priority "${o.priority}"`,
        o.goal && `goal "${o.goal}"`,
        o.stakeShift && `stake shift ${o.stakeShift}`,
      ].filter(Boolean);
      if (parts.length) out.push(`Overrides: ${parts.join(', ')}`);
    }
  }
  if (sim.directive) out.push(`Director's chosen direction — steer situations toward it: ${sim.directive}`);
  if (withRecentEvents) out.push(...section('RECENT EVENTS (oldest first)', sim.events.slice(-25).map((e) => eventLine(ctx, e))));
  return out.join('\n');
}

// ───────── interpretAction ─────────

const APPROACH_RULES = `- Risk sets difficulty and pace: low is slow and safe; medium makes moderate progress and exposes a relationship; high makes fast progress with a major future consequence; extreme moves everything at once.
- circumstances: only situational factors you judge from the story state (evidence in hand, time pressure, an already unstable relationship, a witness present…), each −3..+3. The engine adds capability, trust and conditions itself — do not repeat them.
- consequencePreview: what is at risk with that approach, stated as consequence — never as advice or a verdict on the choice.
- themePull: the side of the thematic conflict the approach leans toward, in a word or two taken from it (e.g. "revenge"); null when it bears on neither side. This is for the Director only.`;

const INTERPRET_TASK = `Return:
- interpretation: intent (a short phrase, e.g. "force truth through confrontation"), domain, targetId (the character resisting or most affected, or null), obstacle, stakes, needsRoll, reminder (1–2 sentences to the performer: the immediate goal, the stake, the pressure — plain language, no structural terms), themeRelevance (one short line for the Director, or null).
- needsRoll is false only for trivial, uncontested moments where nothing meaningful hangs on the outcome (looking around, sitting down, greeting someone with no reason to resist). Then approaches is [].
- Otherwise approaches: exactly one with isPlayerOwn true that mirrors the literal input (its label taken from the player's own wording, at most about six words), plus two or three alternatives with isPlayerOwn false that pursue the same intent with different dramatic shapes, spanning low, medium and high risk (for example "Ask directly" / "Bluff" / "Threaten to expose her").
${APPROACH_RULES}`;

const PROPOSE_TASK = `Nothing has been declared yet: offer the moves this character could make right now. Return:
- interpretation: intent (the immediate goal as this character would pursue it now, a short phrase), domain (of the first move), targetId (the character resisting or most affected, or null), obstacle, stakes, needsRoll true, reminder (1–2 sentences to the performer: the immediate goal, the stake, the pressure — plain language, no structural terms), themeRelevance (one short line for the Director on how the moves divide across the thematic conflict, or null).
- approaches: exactly three, all with isPlayerOwn false. Each is a concrete, playable thing THIS character would plausibly do next in this scene — label in the imperative, at most about six words (e.g. "Show Mara the photograph"); description one sentence. Ground every move in what is at stake right now, and let each lean toward a different side of the thematic conflict, so choosing between them is choosing what the story is about. Spread them across low, medium and high risk. Never frame one as the right answer.
${APPROACH_RULES}`;

function parseInterpretation(
  raw: unknown,
  ctx: DirectorContext,
  characterId: ID,
  proposed = false,
): { interpretation: ActionInterpretation; approaches: ApproachDraft[] } {
  const ids = idsOf(ctx);
  const other = (x: unknown): ID | undefined => {
    const id = ids.char(x);
    return id === characterId ? undefined : id;
  };
  const r = obj(raw, 'response');
  const i = obj(r.interpretation, 'interpretation');
  const seq = offline.currentSequence(ctx.sim);
  const domain = oneOf(i.domain, DOMAINS, 'persuade');
  const interpretation: ActionInterpretation = {
    intent: text(i.intent, 'intent'),
    domain,
    targetId: other(i.targetId),
    obstacle: optText(i.obstacle) ?? seq?.obstacle ?? '',
    stakes: optText(i.stakes) ?? seq?.stake ?? '',
    needsRoll: proposed || i.needsRoll !== false,
    reminder: text(i.reminder, 'reminder'),
    themeRelevance: optText(i.themeRelevance),
  };
  if (!interpretation.needsRoll) return { interpretation, approaches: [] };

  const drafts: ApproachDraft[] = objects(r.approaches).map((a) => ({
    label: text(a.label, 'approach label'),
    description: optText(a.description) ?? '',
    domain: oneOf(a.domain, DOMAINS, domain),
    risk: oneOf(a.risk, RISKS, 'medium'),
    targetId: other(a.targetId),
    circumstances: objects(a.circumstances)
      .map((m) => ({ label: text(m.label, 'circumstance'), value: clampInt(m.value, -3, 3) }))
      .filter((m) => m.value !== 0),
    consequencePreview: text(a.consequencePreview, 'consequence preview'),
    isPlayerOwn: !proposed && a.isPlayerOwn === true,
    themePull: optText(a.themePull),
  }));
  if (proposed) {
    if (drafts.length < 3) throw new Error('fewer than three offered moves');
    return { interpretation, approaches: drafts.slice(0, 3) };
  }
  const own = drafts.find((a) => a.isPlayerOwn);
  const alternatives = drafts.filter((a) => !a.isPlayerOwn).slice(0, 3);
  if (!own) throw new Error("no approach mirrors the player's own input");
  if (alternatives.length < 2) throw new Error('fewer than two alternative approaches');
  return { interpretation, approaches: [own, ...alternatives] };
}

/**
 * Interpret freeform intent (PRD §19, §47). Returns the interpretation plus approaches:
 * exactly one `isPlayerOwn` approach mirroring the literal input, and 2–3 alternatives spanning risk levels.
 * When `needsRoll` is false, approaches is [].
 */
export async function interpretAction(
  ctx: DirectorContext,
  characterId: ID,
  input: string,
): Promise<{ interpretation: ActionInterpretation; approaches: ApproachDraft[] }> {
  const content = `${storyContext(ctx)}

# TASK — interpret a declared action
Actor: ${nameFor(ctx, characterId)} (${characterId})
Player input, verbatim: """${input}"""
${INTERPRET_TASK}`;
  return viaClaude(
    'interpretAction',
    'low',
    INTERPRET_SCHEMA,
    content,
    (raw) => parseInterpretation(raw, ctx, characterId),
    () => offline.interpretAction(ctx, characterId, input),
  );
}

/** Offer three moves before anything is declared, each grounded in the stakes and leaning on a side of the theme. */
export async function proposeChoices(
  ctx: DirectorContext,
  characterId: ID,
): Promise<{ interpretation: ActionInterpretation; approaches: ApproachDraft[] }> {
  const content = `${storyContext(ctx)}

# TASK — offer the next moves
Actor: ${nameFor(ctx, characterId)} (${characterId})
${PROPOSE_TASK}`;
  return viaClaude(
    'proposeChoices',
    'low',
    INTERPRET_SCHEMA,
    content,
    (raw) => parseInterpretation(raw, ctx, characterId, true),
    () => offline.proposeChoices(ctx, characterId),
  );
}

/** How the move came about, for the narration prompts: performed words, or one of the offered moves. */
const moveLine = (pending: PendingAction): string =>
  pending.proposed
    ? `The player chose one of the moves the Director offered (no words were performed): "${pending.input}"`
    : `Player input, verbatim: """${pending.input}"""`;

// ───────── narrateNoRoll / narrateOutcome ─────────

const requirementIdsFor = (ctx: DirectorContext): Set<string> => new Set(offline.currentBeat(ctx.sim).requirements.map((q) => q.id));

/** Narrate an action that needs no roll (PRD §50 — keep it brief). */
export async function narrateNoRoll(
  ctx: DirectorContext,
  pending: PendingAction,
): Promise<{ narration: string; effects: Effect[]; beatRequirementsMet: string[] }> {
  const content = `${storyContext(ctx)}

# TASK — narrate a moment that needs no roll
Actor: ${nameFor(ctx, pending.characterId)} (${pending.characterId})
${moveLine(pending)}
Interpreted intent: ${pending.interpretation.intent}
Nothing meaningful hangs on this moment, so keep it brief: narration is one or two sentences, starting from what happens rather than restating the input. effects: usually none — include one only if something genuinely changes. beatRequirementsMet: requirement ids of the current beat that this moment genuinely satisfies (usually none).`;
  return viaClaude(
    'narrateNoRoll',
    'low',
    NO_ROLL_SCHEMA,
    content,
    (raw) => {
      const r = obj(raw, 'response');
      const allowed = requirementIdsFor(ctx);
      return {
        narration: text(r.narration, 'narration'),
        effects: effectsOf(r.effects, idsOf(ctx)),
        beatRequirementsMet: unique(texts(r.beatRequirementsMet).filter((id) => allowed.has(id))),
      };
    },
    () => offline.narrateNoRoll(ctx, pending),
  );
}

const TIER_RULE: Record<Resolution['tier'], string> = {
  critical: 'The action succeeds and creates an advantageous secondary consequence: an extra revelation, a promise, a new opening.',
  success: 'The action succeeds and advances the immediate goal. Intimidation or deception still costs trust even when it works.',
  complication: 'The action partly works but creates a new problem: the other side learns something, a price is paid, a new threat is set up.',
  failure: 'The immediate action fails AND the situation escalates — for example the other character refuses and alerts someone they trust, or the opposition. Never "nothing happens", never "try again".',
};

/** Fail forward (PRD §21): complication/failure must escalate the story, never "try again". */
export async function narrateOutcome(
  ctx: DirectorContext,
  pending: PendingAction,
  approach: Approach,
  resolution: Resolution,
): Promise<OutcomeNarration> {
  const { progress, required } = offline.expectedProgress(ctx.sim, resolution.tier, approach);
  const target = approach.targetId ?? pending.interpretation.targetId;
  const requirements = offline.currentBeat(ctx.sim).requirements.map((q) => q.id);
  const content = `${storyContext(ctx)}

# TASK — narrate a resolved action
Actor: ${nameFor(ctx, pending.characterId)} (${pending.characterId})
${moveLine(pending)}
Interpreted intent: ${pending.interpretation.intent} | target: ${target ? `${nameFor(ctx, target)} (${target})` : 'none'}
Chosen approach: "${approach.label}" — ${approach.domain}, ${approach.risk} risk (${approach.isPlayerOwn ? "the player's own wording" : 'a suggested alternative'})
Roll: d20 ${resolution.roll} ${resolution.modifierTotal >= 0 ? '+' : '−'} ${Math.abs(resolution.modifierTotal)} = ${resolution.total} vs DC ${resolution.dc} → ${TIER_LABEL[resolution.tier].toUpperCase()}
Goal progress once this lands (the engine applies it): ${progress} of ${required}. ${
    progress >= required
      ? 'This outcome ACHIEVES the current goal: deliver fresh news that closes it and opens the next goal.'
      : 'The current goal is not yet achieved.'
  }
Tier rule: ${TIER_RULE[resolution.tier]}
Return:
- narration: 2–5 sentences, present tense, what happens on screen. Start from the reaction rather than restating the attempt. No meta vocabulary.
- effects: the immediate state changes — at least one. Always include one behavior effect for the actor. Add theme and empathy effects only when genuinely evident. Use reinforce/payoff only with the open setup ids listed above.
- propagation: zero to two ripples through the character web beyond this moment (who tells whom, who changes strategy), each with its own effects and visibleTo = ids of the characters who know about it.
- beatRequirementsMet: ids from [${requirements.join(', ')}] that this outcome genuinely satisfies; [] if none.
- freshNews: {text, goal, stake, obstacle} when the immediate objective genuinely changes (always when the goal is achieved); otherwise null.`;

  return viaClaude(
    'narrateOutcome',
    'medium',
    OUTCOME_SCHEMA,
    content,
    (raw): OutcomeNarration => {
      const ids = idsOf(ctx);
      const r = obj(raw, 'response');
      const allowed = requirementIdsFor(ctx);
      const effects = effectsOf(r.effects, ids);
      // The behaviour trail feeds declared-vs-observed discovery (PRD §31); keep it even if the model forgot it.
      if (!effects.some((e) => e.type === 'behavior' && e.characterId === pending.characterId)) {
        effects.push(offline.behaviorEffect(ctx, pending.characterId, approach, resolution.tier));
      }
      const propagation = objects(r.propagation)
        .slice(0, 3)
        .map((p) => {
          const visibleTo = unique(list(p.visibleTo).map(ids.char).filter((id): id is ID => !!id));
          return { text: text(p.text, 'propagation'), effects: effectsOf(p.effects, ids), ...(visibleTo.length ? { visibleTo } : {}) };
        });
      const news = isObj(r.freshNews) ? r.freshNews : undefined;
      return {
        narration: text(r.narration, 'narration'),
        effects,
        propagation,
        beatRequirementsMet: unique(texts(r.beatRequirementsMet).filter((id) => allowed.has(id))),
        freshNews:
          news && optText(news.text) && optText(news.goal)
            ? { text: text(news.text, 'fresh news'), goal: text(news.goal, 'goal'), stake: optText(news.stake) ?? '', obstacle: optText(news.obstacle) ?? '' }
            : undefined,
      };
    },
    () => offline.narrateOutcome(ctx, pending, approach, resolution),
  );
}

// ───────── generateOpportunities ─────────

/** 3 structural opportunity cards (A/B/C) for the beat (PRD §15, §37). `payoffSetupIds` must reference open setups. */
export async function generateOpportunities(ctx: DirectorContext, beatKey: StcBeatKey): Promise<Omit<Opportunity, 'id'>[]> {
  const def = beatDef(beatKey);
  const content = `${storyContext(ctx)}

# TASK — structural opportunity cards for the beat: ${def.name} [${def.key}] — ${def.purpose}
Dramatic requirements of this beat:
${def.requirements.map((q) => `- ${q.text}`).join('\n')}
Generate exactly three cards (A, B, C), each a distinct, viable dramatic version of this beat (for a Midpoint, for example: Revelation / False victory / Reversal of objective). Each must grow out of the current story state — real characters, their secrets, goals and relationships, the open setups and the theme — and preserve continuity. You curate options; the human Director chooses one.
Fields: kind (one or two words), title (short), description (1–2 sentences of what happens), characterEffect, themeEffect, relationshipEffect, setupCreated, potentialPayoff, payoffSetupIds (ids of open setups listed above that this card would pay off; [] if none), risk (the dramatic risk of choosing it), futureBranches (two or three short phrases).`;
  return viaClaude(
    'generateOpportunities',
    'medium',
    OPPORTUNITY_SCHEMA,
    content,
    (raw) => {
      const ids = idsOf(ctx);
      const cards = objects(obj(raw, 'response').cards).slice(0, 3);
      if (cards.length < 3) throw new Error('fewer than three cards');
      return cards.map((c, i) => ({
        beatKey,
        label: 'ABC'[i],
        kind: text(c.kind, 'kind'),
        title: text(c.title, 'title'),
        description: text(c.description, 'description'),
        characterEffect: optText(c.characterEffect) ?? '',
        themeEffect: optText(c.themeEffect) ?? '',
        relationshipEffect: optText(c.relationshipEffect) ?? '',
        setupCreated: optText(c.setupCreated) ?? '',
        potentialPayoff: optText(c.potentialPayoff) ?? '',
        payoffSetupIds: unique(list(c.payoffSetupIds).map(ids.setup).filter((id): id is ID => !!id)),
        risk: optText(c.risk) ?? '',
        futureBranches: texts(c.futureBranches).slice(0, 4),
      }));
    },
    () => offline.generateOpportunities(ctx, beatKey),
  );
}

// ───────── analyzeDiscoveries ─────────

function discoveryEvidence(ctx: DirectorContext): string {
  const { project, sim } = ctx;
  const m = project.model;
  const name = (id: ID) => nameFor(ctx, id);
  const perCharacter = (line: (id: ID) => string | undefined) =>
    m.characters.map((c) => line(c.id)).filter((l): l is string => !!l);
  const existing = project.discoveries.filter((d) => d.branchId === project.activeBranchId);
  return [
    ...section(
      'OBSERVED BEHAVIOUR (trait @event)',
      perCharacter((id) => {
        const b = sim.characters[id]?.behaviors ?? [];
        return b.length ? `- ${name(id)} (${id}): ${b.map((x) => `${x.trait} @${x.eventId}`).join('; ')}` : undefined;
      }),
    ),
    ...section(
      'EMPATHY OBSERVATIONS',
      perCharacter((id) => {
        const e = sim.characters[id]?.empathy ?? [];
        return e.length ? `- ${name(id)} (${id}): ${e.map((x) => `${x.signal} @${x.eventId} (${x.text})`).join('; ')}` : undefined;
      }),
    ),
    ...section('THEME SIGNALS', sim.themeSignals.map((t) => `- ${t.stance} @${t.eventId}: ${t.text}`)),
    ...section(
      'RELATIONSHIPS: AUTHORED BASELINE → NOW',
      sim.relationships.map((r) => {
        const b = m.relationships.find((x) => x.from === r.from && x.to === r.to);
        return `- ${name(r.from)} → ${name(r.to)}: trust ${b?.trust ?? 0} → ${r.trust}, tension ${b?.tension ?? 0} → ${r.tension}`;
      }),
    ),
    ...section(
      'ALL SETUPS',
      sim.setups.map((s) => `- ${s.id} [${s.status}; created @${s.createdEventId}; reinforced ${s.reinforcementEventIds.map((id) => `@${id}`).join(', ') || 'never'}]: ${s.text}`),
    ),
    ...section('DISCOVERIES ALREADY RECORDED ON THIS BRANCH (never repeat these titles)', existing.map((d) => `- ${d.title} [${d.status}]`)),
  ].join('\n');
}

/**
 * Discoveries from play (PRD §31, §11, §29–30): declared-vs-observed divergence, empathy signals as observations
 * (never scores/percentages), theme reinforcement/contradiction, relationship shifts, payoff opportunities.
 * Must not duplicate titles already in ctx.project.discoveries for this branch.
 */
export async function analyzeDiscoveries(ctx: DirectorContext): Promise<DiscoveryDraft[]> {
  const content = `${storyContext(ctx)}
${discoveryEvidence(ctx)}

# TASK — discovery analysis
Identify what play has revealed that was not already explicit in the authored story. A discovery is not canon: only the Project Owner promotes. Kinds: character, story, theme, relationship, structure, divergence, setup-payoff, empathy.
- divergence: a character's declared values and observed behaviour diverge. Fill declared and observed, an interpretation such as "Compassion may be conditional rather than foundational.", directorQuestion "Does this behaviour become a character revelation, a performance deviation, or temporary story-state behaviour?" and options exactly ["Character revelation", "Performance deviation", "Temporary story-state behaviour"].
- empathy: observations only, written as "Observed: …" and "Missing evidence: …" sentences — never numbers, scores or percentages.
- theme: whether play is reinforcing, contradicting, developing or holding the thematic statement in tension.
- relationship: shifts of two or more from the authored baseline.
- setup-payoff: setups that have accumulated relevance and could pay off now.
evidenceEventIds must be event ids that appear above; characterId is the character concerned, or null. Return zero to six discoveries, each with a specific title; return an empty list if nothing meaningful emerged.`;
  return viaClaude(
    'analyzeDiscoveries',
    'high',
    DISCOVERY_SCHEMA,
    content,
    (raw) => {
      const ids = idsOf(ctx);
      const taken = new Set(ctx.project.discoveries.filter((d) => d.branchId === ctx.project.activeBranchId).map((d) => d.title.toLowerCase()));
      return objects(obj(raw, 'response').discoveries).flatMap((d): DiscoveryDraft[] => {
        const title = optText(d.title);
        const observation = optText(d.observation);
        // Observations, never scores (PRD §11).
        if (!title || !observation || taken.has(title.toLowerCase()) || PERCENTAGE.test(`${title} ${observation}`)) return [];
        taken.add(title.toLowerCase());
        return [
          {
            kind: oneOf(d.kind, DISCOVERY_KINDS, 'story'),
            title,
            observation,
            declared: optText(d.declared),
            observed: optText(d.observed),
            interpretation: optText(d.interpretation),
            directorQuestion: optText(d.directorQuestion),
            options: texts(d.options),
            evidenceEventIds: unique(texts(d.evidenceEventIds).filter(ids.event)),
            characterId: ids.char(d.characterId),
          },
        ];
      });
    },
    () => offline.analyzeDiscoveries(ctx),
  );
}

// ───────── writeReport ─────────

/** Shared Story Interpretation report (PRD §33–34). */
export async function writeReport(ctx: DirectorContext, interpretations: Interpretation[], reactions: Reaction[]): Promise<ReportDraft> {
  const { project, sim } = ctx;
  // Participants are labelled by role and a number: the report compares readings, never people.
  const order = unique(interpretations.map((i) => i.participantId));
  const who = (pid: ID) => {
    const role = project.participants.find((p) => p.id === pid)?.role;
    return `P${order.indexOf(pid) + 1} (${role ? ROLE_LABEL[role] : 'Participant'})`;
  };
  const moments = unique(reactions.map((r) => r.eventId)).map((eventId) => {
    const those = reactions.filter((r) => r.eventId === eventId);
    const kinds = unique(those.map((r) => r.kind)).map((k) => `${k} ×${those.filter((r) => r.kind === k).length}`);
    const notes = those.map((r) => r.note?.trim()).filter(Boolean);
    const e = sim.events.find((x) => x.id === eventId);
    return `- ${eventId}: "${clip(e?.text ?? '', 200)}" — ${kinds.join(', ')}${notes.length ? ` (notes: ${notes.join(' / ')})` : ''}`;
  });
  const content = `${storyContext(ctx)}
${section('INTERPRETATION QUESTIONS', QUESTION_KEYS.map((k) => `- ${k}: ${INTERPRETATION_QUESTIONS[k]}`)).join('\n')}
${section(
  'CREW INTERPRETATIONS',
  interpretations.map((i) => `- ${who(i.participantId)}, ${i.phase} play — ${QUESTION_KEYS.map((k) => `${k}: "${i.answers[k] ?? ''}"`).join(' | ')}`),
).join('\n')}
${section('REACTIONS BY MOMENT', moments).join('\n')}
${section(
  'DISCOVERIES ON THIS BRANCH',
  project.discoveries.filter((d) => d.branchId === project.activeBranchId).map((d) => `- ${d.title} [${d.status}]`),
).join('\n')}

# TASK — Shared Story Interpretation report
Write the report the crew reads after playing together: alignment through shared experience.
- summary: two or three sentences on what the crew experienced and where readings met or parted.
- highlights: three to five moments that affected people, drawn from the reactions.
- emergent: discoveries that emerged collectively (from the list above and from play).
- notes: one neutral note per question in the "interpretation divergence" framing — compare readings, never judge or rank a participant, never call an answer wrong.
- divergence: per question, before and after play, 0 when every answer means the same thing and 1 when every answer differs; null when that phase has fewer than two answers.`;

  return viaClaude(
    'writeReport',
    'medium',
    REPORT_SCHEMA,
    content,
    (raw): ReportDraft => {
      const r = obj(raw, 'response');
      const notes = isObj(r.notes) ? r.notes : {};
      const divergence = isObj(r.divergence) ? r.divergence : {};
      const fallbackNotes = offline.writeReport(ctx, interpretations, reactions).notes;
      const answered = (k: InterpretationKey, phase: 'before' | 'after') =>
        interpretations.filter((i) => i.phase === phase && i.answers[k]?.trim()).length;
      const unit = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : null);
      return {
        summary: text(r.summary, 'summary'),
        highlights: texts(r.highlights),
        emergent: texts(r.emergent),
        notes: Object.fromEntries(QUESTION_KEYS.map((k) => [k, optText(notes[k]) ?? fallbackNotes[k]])) as Record<InterpretationKey, string>,
        divergence: Object.fromEntries(
          QUESTION_KEYS.map((k) => {
            const d = isObj(divergence[k]) ? divergence[k] : {};
            return [k, { before: answered(k, 'before') >= 2 ? unit(d.before) : null, after: answered(k, 'after') >= 2 ? unit(d.after) : null }];
          }),
        ),
      };
    },
    () => offline.writeReport(ctx, interpretations, reactions),
  );
}

// ───────── compileScreenplay ─────────

const PLAYED: ReadonlySet<EventKind> = new Set(['action', 'resolution', 'propagation', 'narration', 'fresh-news']);

/** 'performed' and 'reconstructed' need a performer's input among the sources; otherwise the line was invented. */
function dialogueProvenance(x: unknown, sources: StoryEvent[]): DialogueProvenance {
  const p = oneOf(x, DIALOGUE_PROVENANCE, 'generated');
  return p !== 'generated' && !sources.some((e) => e.playerInput) ? 'generated' : p;
}
/** 'observed' needs a played event among the sources; staging-only sources make it 'directed'. */
function actionProvenance(x: unknown, sources: StoryEvent[]): ActionProvenance {
  const p = oneOf(x, ACTION_PROVENANCE, 'connective');
  if (p !== 'observed' || sources.some((e) => PLAYED.has(e.kind))) return p;
  return sources.length ? 'directed' : 'connective';
}

/**
 * Screenplay compiler (PRD §41–43). Standard screenplay element order. Provenance is mandatory and honest:
 * dialogue — 'performed' (performer's own words, lightly trimmed), 'reconstructed' (rewritten from performer intent),
 * 'generated' (connective line invented); action — 'observed' (happened in play), 'directed' (Director staging),
 * 'connective' (compiler bridge). Never disguise invention as discovery. sourceEventIds must reference `events`.
 */
export async function compileScreenplay(ctx: DirectorContext, events: StoryEvent[], scenes: Scene[]): Promise<Omit<ScreenplayElement, 'id'>[]> {
  const byScene = scenes.map((s) =>
    [
      `## ${s.id} — ${s.heading} (present: ${s.presentCharacterIds.map((id) => nameFor(ctx, id)).join(', ') || 'no one listed'})`,
      ...events.filter((e) => e.sceneId === s.id).map((e) => eventLine(ctx, e)),
    ].join('\n'),
  );
  const content = `${storyContext(ctx, false)}

# SCENES AND THEIR EVENTS (in order)
${byScene.join('\n\n')}

# TASK — compile these scenes into screenplay form
Write the scenes above in standard screenplay form: for each scene a heading (uppercase slugline), action lines, CHARACTER cues (uppercase name, speakerId set) followed by dialogue (optionally a parenthetical), and a transition such as "CUT TO:" between scenes. Record the experience; do not add plot that did not happen. Voice notes in the character list shape reconstructed lines. Skip director-only events, beat advances and other meta events.
Provenance is mandatory and honest:
- dialogue: "performed" only for a performer's own words from an action event's input (lightly trimmed); "reconstructed" when you rewrite a performer's described intent into dialogue in the character's voice; "generated" when you invent a connective line — sparingly, only where a scene would otherwise make no sense.
- action: "observed" for what happened in play (performed actions, resolutions, narration of results, ripples); "directed" for the Director's staging (scene situations, directives); "connective" for bridges you add.
- heading, character, parenthetical and transition: provenance null.
Every element lists sourceEventIds — the events above it came from, or bridges.`;

  return viaClaude(
    'compileScreenplay',
    'high',
    SCREENPLAY_SCHEMA,
    content,
    (raw) => {
      const ids = idsOf(ctx);
      const byId = new Map(events.map((e) => [e.id, e]));
      let lastSources: ID[] = [];
      const elements = objects(obj(raw, 'response').elements).flatMap((x): Omit<ScreenplayElement, 'id'>[] => {
        const body = rawText(x.text);
        if (!body) return [];
        const type = oneOf(x.type, ELEMENT_TYPES, 'action');
        const cited = unique(texts(x.sourceEventIds).filter((id) => byId.has(id)));
        const sourceEventIds = cited.length ? cited : lastSources; // an uncited line belongs to what precedes it
        lastSources = sourceEventIds;
        const sources = sourceEventIds.map((id) => byId.get(id)!);
        const speakerId = type === 'character' || type === 'dialogue' || type === 'parenthetical' ? ids.char(x.speakerId) : undefined;
        const provenance =
          type === 'dialogue' ? dialogueProvenance(x.provenance, sources) : type === 'action' ? actionProvenance(x.provenance, sources) : undefined;
        return [{ type, text: body, sourceEventIds, ...(provenance && { provenance }), ...(speakerId && { speakerId }) }];
      });
      if (!elements.length) throw new Error('empty screenplay');
      return elements;
    },
    () => offline.compileScreenplay(ctx, events, scenes),
  );
}
