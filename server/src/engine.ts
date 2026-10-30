// Dramatic Resolution Engine + Narrative State Graph — pure, deterministic functions (dice aside).
// Signatures are fixed: ops.ts depends on exactly these exports.
import { randomInt, randomUUID } from 'node:crypto';
import { COMPLICATION_BAND, CRIT_MARGIN, DC, DOMAIN_LABEL, PROGRESS, STC_BEATS } from '../../shared/structure.ts';
import type { BeatRequirement } from '../../shared/structure.ts';
import type {
  Approach,
  Character,
  CharacterState,
  Domain,
  EdgeRel,
  Effect,
  GraphEdge,
  HeroGoalSequence,
  ID,
  Modifier,
  NodeRef,
  Odds,
  Relationship,
  Resolution,
  Risk,
  Scene,
  SimState,
  StoryEvent,
  StoryModel,
  Tier,
} from '../../shared/types.ts';
import type { OpResult } from '../../shared/api.ts';

export const newId = (prefix: string): ID => `${prefix}_${randomUUID().slice(0, 8)}`;
export const nowIso = (): string => new Date().toISOString();

/** What the Director proposes; the engine turns it into a costed Approach. */
export interface ApproachDraft {
  label: string;
  description: string;
  domain: Domain;
  risk: Risk;
  targetId?: ID;
  /** Director-judged situational modifiers (evidence in hand, time pressure…), each −3..+3. */
  circumstances: Modifier[];
  consequencePreview: string;
  isPlayerOwn: boolean;
  themePull?: string;
}

/** Opening situation for a fresh SimState (first HGS + first scene). */
export interface Opening {
  goal: string;
  stake: string;
  obstacle: string;
  heading: string;
  situation: string;
  presentCharacterIds: ID[];
  beatIndex?: number;
}

const TIERS_ASCENDING: Tier[] = ['failure', 'complication', 'success', 'critical'];
const SOCIAL_TRUST_DOMAINS: Domain[] = ['persuade', 'deceive', 'empathize'];

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
/** n/2 rounded half away from zero, so trust −1 weighs as much as +1 (Math.round(−0.5) is −0). */
const half = (n: number): number => Math.sign(n) * Math.round(Math.abs(n) / 2);
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

const findRel = (sim: SimState, from: ID, to: ID): Relationship | undefined =>
  sim.relationships.find((r) => r.from === from && r.to === to);
const isBetween = (r: Relationship, a: ID, b: ID): boolean => (r.from === a && r.to === b) || (r.from === b && r.to === a);

const freshCharacterState = (c: Character): CharacterState => ({
  characterId: c.id,
  knowledge: [],
  conditions: [],
  resources: [...c.resources],
  reputation: [],
  promises: [],
  betrayals: [],
  behaviors: [],
  empathy: [],
});

const addUnique = (list: string[], item: string): boolean => {
  if (list.includes(item)) return false;
  list.push(item);
  return true;
};
const removeItem = (list: string[], item: string): boolean => {
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
  return i >= 0;
};

/** Exact tier probabilities for d20 + modifierTotal vs dc, using DC/CRIT_MARGIN/COMPLICATION_BAND from shared/structure.ts. Natural 20 is always at least success; natural 1 is always at most complication. */
export function computeOdds(modifierTotal: number, dc: number): Odds {
  const counts: Odds = { critical: 0, success: 0, complication: 0, failure: 0 };
  for (let roll = 1; roll <= 20; roll++) counts[tierFor(roll, modifierTotal, dc)]++;
  return {
    critical: counts.critical / 20,
    success: counts.success / 20,
    complication: counts.complication / 20,
    failure: counts.failure / 20,
  };
}

export function tierFor(roll: number, modifierTotal: number, dc: number): Tier {
  const total = roll + modifierTotal;
  let rank = total >= dc + CRIT_MARGIN ? 3 : total >= dc ? 2 : total >= dc - COMPLICATION_BAND ? 1 : 0;
  if (roll === 20) rank = Math.max(rank, 2);
  if (roll === 1) rank = Math.min(rank, 1);
  return TIERS_ASCENDING[rank];
}

/** Cryptographic d20 (1..20). */
export function rollD20(): number {
  return randomInt(1, 21);
}

/**
 * Baseline = capability (counts double), then: directed trust of target toward actor for social domains
 * (persuade/deceive/empathize: +trust/2; intimidate: +tension/2), actor conditions (−1 each, max −2),
 * then the Director's circumstances. Labels are human readable.
 */
/** Which of the target's capabilities resists an attempt in each domain (craft works on things, not people). */
const OPPOSED: Partial<Record<Domain, Domain>> = {
  persuade: 'persuade',
  deceive: 'investigate',
  intimidate: 'intimidate',
  investigate: 'deceive',
  stealth: 'investigate',
  physical: 'physical',
  empathize: 'empathize',
};

export function buildModifiers(
  model: StoryModel,
  sim: SimState,
  characterId: ID,
  domain: Domain,
  targetId: ID | undefined,
  circumstances: Modifier[],
): Modifier[] {
  const capability = model.characters.find((c) => c.id === characterId)?.capabilities[domain] ?? 0;
  const targetName = model.characters.find((c) => c.id === targetId)?.name ?? targetId;
  const situational: Modifier[] = [];

  if (targetId && SOCIAL_TRUST_DOMAINS.includes(domain)) {
    const trust = findRel(sim, targetId, characterId)?.trust ?? 0;
    situational.push({ label: `${targetName}'s trust ${signed(trust)}`, value: half(trust) });
  }
  if (targetId && domain === 'intimidate') {
    const tension = Math.max(0, ...sim.relationships.filter((r) => isBetween(r, characterId, targetId)).map((r) => r.tension));
    situational.push({ label: `Tension with ${targetName} ${tension} (fear leverage)`, value: half(tension) });
  }
  // NPC resistance (PRD §19): the target's own capability in the opposing domain.
  const opposed = OPPOSED[domain];
  const target = model.characters.find((c) => c.id === targetId);
  if (target && opposed) {
    const n = target.capabilities[opposed] ?? 0;
    situational.push({ label: `${targetName} resists (${DOMAIN_LABEL[opposed]} ${n})`, value: -half(n) });
  }
  const conditions = sim.characters[characterId]?.conditions ?? [];
  if (conditions.length) {
    situational.push({ label: `Condition: ${conditions.join(', ')}`, value: -Math.min(conditions.length, 2) });
  }
  for (const c of circumstances) situational.push({ label: c.label, value: clamp(Math.round(c.value), -3, 3) });

  return [
    { label: `Capability: ${DOMAIN_LABEL[domain]} ${capability}`, value: capability * 2 },
    ...situational.filter((m) => m.value), // drops 0, −0 and NaN
  ];
}

export function makeApproach(model: StoryModel, sim: SimState, characterId: ID, draft: ApproachDraft): Approach {
  const { circumstances, ...fields } = draft;
  const dc = DC[draft.risk];
  const modifiers = buildModifiers(model, sim, characterId, draft.domain, draft.targetId, circumstances);
  const modifierTotal = modifiers.reduce((sum, m) => sum + m.value, 0);
  return {
    id: newId('ap'),
    ...fields,
    dc,
    modifiers,
    modifierTotal,
    odds: computeOdds(modifierTotal, dc),
    progressOnSuccess: PROGRESS[draft.risk],
  };
}

/** Rolls (or uses the provided roll, for tests) and returns the Resolution. */
export function resolveApproach(approach: Approach, intent: string, roll: number = rollD20()): Resolution {
  return {
    approachId: approach.id,
    approachLabel: approach.label,
    intent,
    domain: approach.domain,
    risk: approach.risk,
    dc: approach.dc,
    modifiers: approach.modifiers,
    modifierTotal: approach.modifierTotal,
    roll,
    total: roll + approach.modifierTotal,
    tier: tierFor(roll, approach.modifierTotal, approach.dc),
    odds: approach.odds,
  };
}

/** Goal progress for an outcome: critical = progressOnSuccess+1, success = progressOnSuccess, complication = 1, failure = 0. */
export function progressFor(tier: Tier, approach: Approach): number {
  const byTier: Record<Tier, number> = {
    critical: approach.progressOnSuccess + 1,
    success: approach.progressOnSuccess,
    complication: 1,
    failure: 0,
  };
  return byTier[tier];
}

/**
 * Applies effects to `sim` in place: clamps trust −5..5 / tension 0..5 (creating a directed relationship if missing),
 * updates CharacterState, creates Setups (fills setupId-less 'setup' effects), marks a setup 'payoff-candidate'
 * once it has ≥2 reinforcements, records ThemeSignals / behaviours / empathy observations, adds goal progress to the
 * current HGS (marking it 'achieved' when progress ≥ required), and adds GraphEdges linking the event to what it touched.
 * Unknown character ids are ignored. Returns the effects as applied: trust/tension/goal deltas are the actual
 * (post-clamp) change, and effects that changed nothing (unknown ids, duplicates, clamped to zero) are dropped.
 */
export function applyEffects(sim: SimState, model: StoryModel, effects: Effect[], eventId: ID): Effect[] {
  const event: NodeRef = { kind: 'event', id: eventId };
  const known = (id: ID): boolean => model.characters.some((c) => c.id === id);
  // Lazily creates state for characters added to the model after the simulation started.
  const stateOf = (id: ID): CharacterState | undefined => {
    const character = model.characters.find((c) => c.id === id);
    return character && (sim.characters[id] ??= freshCharacterState(character));
  };
  const edge = (from: NodeRef, to: NodeRef, rel: EdgeRel, label: string): void => {
    sim.edges.push({ id: newId('edge'), from, to, rel, eventId, label });
  };
  const relFor = (from: ID, to: ID): Relationship => {
    let rel = findRel(sim, from, to);
    if (!rel) sim.relationships.push((rel = { id: newId('rel'), from, to, label: '—', trust: 0, tension: 0, notes: '' }));
    return rel;
  };
  /** Shifts trust (−5..5) or tension (0..5) and returns the actual change. */
  const shift = (rel: Relationship, key: 'trust' | 'tension', delta: number, label: string): number => {
    const before = rel[key];
    rel[key] = clamp(before + delta, key === 'trust' ? -5 : 0, 5);
    if (rel[key] !== before) edge(event, { kind: 'relationship', id: rel.id }, 'changes', label);
    return rel[key] - before;
  };

  const apply = (e: Effect): Effect | null => {
    switch (e.type) {
      case 'trust': {
        if (!known(e.from) || !known(e.to)) return null;
        const delta = shift(relFor(e.from, e.to), 'trust', e.delta, e.label);
        return delta ? { ...e, delta } : null;
      }
      case 'tension': {
        if (!known(e.a) || !known(e.b)) return null;
        // Tension is mutual: shift every directed relationship between the pair (creating a→b when none exists).
        const rels = sim.relationships.filter((r) => isBetween(r, e.a, e.b));
        const changes = (rels.length ? rels : [relFor(e.a, e.b)]).map((r) => shift(r, 'tension', e.delta, e.label));
        const delta = Math.sign(e.delta) * Math.max(...changes.map(Math.abs));
        return delta ? { ...e, delta } : null;
      }
      case 'knowledge': {
        const s = stateOf(e.characterId);
        if (!s || !addUnique(s.knowledge, e.fact)) return null;
        edge({ kind: 'character', id: e.characterId }, event, 'knows', e.label);
        return e;
      }
      case 'goal-progress': {
        const hgs = sim.sequences.find((s) => s.id === sim.currentSequenceId);
        if (!hgs || hgs.status !== 'active') return null;
        const before = hgs.progress;
        hgs.progress = Math.max(0, before + e.delta);
        if (hgs.progress === before) return null;
        if (hgs.progress >= hgs.required) {
          hgs.status = 'achieved';
          hgs.closedAt = nowIso();
        }
        edge(event, { kind: 'goal', id: hgs.id }, 'changes', e.label);
        return { ...e, delta: hgs.progress - before };
      }
      case 'resource': {
        const s = stateOf(e.characterId);
        if (!s) return null;
        const removed = !!e.remove && removeItem(s.resources, e.remove);
        const added = !!e.add && addUnique(s.resources, e.add);
        return removed || added ? e : null;
      }
      case 'condition': {
        const s = stateOf(e.characterId);
        if (!s) return null;
        return (e.clear ? removeItem(s.conditions, e.condition) : addUnique(s.conditions, e.condition)) ? e : null;
      }
      case 'reputation': {
        const s = stateOf(e.characterId);
        if (!s) return null;
        s.reputation.push(e.text);
        return e;
      }
      case 'promise': {
        const s = stateOf(e.from);
        if (!s || !known(e.to)) return null;
        s.promises.push(e.text);
        return e;
      }
      case 'betrayal': {
        // Recorded on the betrayer; the betrayed character's trust toward them drops by 2.
        const s = stateOf(e.from);
        if (!s || !known(e.to)) return null;
        s.betrayals.push(e.text);
        shift(relFor(e.to, e.from), 'trust', -2, e.label);
        return e;
      }
      case 'setup': {
        const id = newId('setup');
        sim.setups.push({ id, text: e.text, createdEventId: eventId, reinforcementEventIds: [], status: 'open' });
        edge(event, { kind: 'setup', id }, 'foreshadows', e.label);
        return e;
      }
      case 'reinforce': {
        const setup = sim.setups.find((s) => s.id === e.setupId);
        if (!setup || (setup.status !== 'open' && setup.status !== 'payoff-candidate')) return null;
        if (!addUnique(setup.reinforcementEventIds, eventId)) return null;
        if (setup.reinforcementEventIds.length >= 2) setup.status = 'payoff-candidate';
        edge(event, { kind: 'setup', id: setup.id }, 'foreshadows', e.label);
        return e;
      }
      case 'payoff': {
        const setup = sim.setups.find((s) => s.id === e.setupId);
        if (!setup || setup.status === 'paid-off') return null;
        setup.status = 'paid-off';
        setup.payoffEventId = eventId;
        setup.payoffText = e.text;
        edge(event, { kind: 'setup', id: setup.id }, 'pays-off', e.label);
        return e;
      }
      case 'theme':
        sim.themeSignals.push({ id: newId('theme'), stance: e.stance, text: e.text, eventId });
        return e;
      case 'empathy': {
        const s = stateOf(e.characterId);
        if (!s) return null;
        s.empathy.push({ signal: e.signal, text: e.text, eventId });
        return e;
      }
      case 'behavior': {
        const s = stateOf(e.characterId);
        if (!s) return null;
        s.behaviors.push({ trait: e.trait, text: e.text, eventId });
        return e;
      }
    }
  };

  const applied: Effect[] = [];
  for (const e of effects) {
    const result = apply(e);
    if (result) applied.push(result); // an unrecognised type falls through the switch as undefined
  }
  return applied;
}

/** Records requirement ids (from STC_BEATS[beatIndex].requirements) as met by `eventId`; ignores unknown ids/duplicates. */
export function markBeatConditions(sim: SimState, requirementIds: string[], eventId: ID): void {
  const beat = sim.beats[sim.beatIndex];
  const valid = STC_BEATS[sim.beatIndex].requirements.map((r) => r.id);
  for (const requirementId of requirementIds) {
    if (valid.includes(requirementId) && !beat.conditionsMet.some((c) => c.requirementId === requirementId)) {
      beat.conditionsMet.push({ requirementId, eventId });
    }
  }
}

export function beatReadiness(sim: SimState): { met: BeatRequirement[]; unmet: BeatRequirement[]; ready: boolean } {
  const metIds = new Set(sim.beats[sim.beatIndex].conditionsMet.map((c) => c.requirementId));
  const requirements = STC_BEATS[sim.beatIndex].requirements;
  const unmet = requirements.filter((r) => !metIds.has(r.id));
  return { met: requirements.filter((r) => metIds.has(r.id)), unmet, ready: unmet.length === 0 };
}

/** Fresh SimState from the authored model: 15 beats (beatIndex active), per-character states seeded from resources, relationships cloned, HGS #1, scene #1, opening narration event. */
export function newSimState(model: StoryModel, opening: Opening): SimState {
  const beatIndex = opening.beatIndex ?? 0;
  const beatKey = STC_BEATS[beatIndex].key;
  const at = nowIso();
  const hgs: HeroGoalSequence = {
    id: newId('hgs'),
    number: 1,
    beatKey,
    goal: opening.goal,
    stake: opening.stake,
    obstacle: opening.obstacle,
    progress: 0,
    required: 3,
    status: 'active',
    openedAt: at,
  };
  const scene: Scene = {
    id: newId('scene'),
    sequenceId: hgs.id,
    heading: opening.heading,
    situation: opening.situation,
    presentCharacterIds: opening.presentCharacterIds,
    status: 'open',
  };
  const openingEvent = (kind: 'scene-open' | 'narration', text: string): StoryEvent => ({
    id: newId('ev'),
    at,
    kind,
    sceneId: scene.id,
    sequenceId: hgs.id,
    beatKey,
    text,
  });
  const relationships = structuredClone(model.relationships);
  const edges = relationships
    .filter((r) => r.trust <= -2)
    .map((r): GraphEdge => ({
      id: newId('edge'),
      from: { kind: 'character', id: r.from },
      to: { kind: 'character', id: r.to },
      rel: 'opposes',
      label: r.label,
    }));
  if (model.characters.some((c) => c.id === model.protagonistId)) {
    edges.unshift({
      id: newId('edge'),
      from: { kind: 'character', id: model.protagonistId },
      to: { kind: 'goal', id: hgs.id },
      rel: 'wants',
      label: opening.goal,
    });
  }

  return {
    beats: STC_BEATS.map((b, i) => ({
      key: b.key,
      status: i < beatIndex ? 'satisfied' : i === beatIndex ? 'active' : 'pending',
      conditionsMet: [],
      notes: '',
    })),
    beatIndex,
    sequences: [hgs],
    currentSequenceId: hgs.id,
    scenes: [scene],
    currentSceneId: scene.id,
    characters: Object.fromEntries(model.characters.map((c) => [c.id, freshCharacterState(c)])),
    relationships,
    events: [openingEvent('scene-open', opening.heading), openingEvent('narration', opening.situation)],
    setups: [],
    themeSignals: [],
    edges,
    pending: null,
    opportunities: [],
  };
}

export const cloneSim = (sim: SimState): SimState => structuredClone(sim);

/** Downstream BFS over sim.edges (plus implicit character↔relationship links) — "if this happens, what does it affect?" */
export function graphImpact(sim: SimState, model: StoryModel, node: NodeRef, depth = 3): OpResult<'graphImpact'> {
  const key = (n: NodeRef): string => `${n.kind}:${n.id}`;
  const nameOf = (id: ID): string => model.characters.find((c) => c.id === id)?.name ?? id;
  const truncate = (text: string): string => (text.length > 60 ? `${text.slice(0, 59)}…` : text);
  const labelFor = (n: NodeRef): string => {
    switch (n.kind) {
      case 'character':
        return nameOf(n.id);
      case 'event':
        return truncate(sim.events.find((e) => e.id === n.id)?.text ?? n.id);
      case 'setup':
        return sim.setups.find((s) => s.id === n.id)?.text ?? n.id;
      case 'goal':
        return sim.sequences.find((s) => s.id === n.id)?.goal ?? n.id;
      case 'scene':
        return sim.scenes.find((s) => s.id === n.id)?.heading ?? n.id;
      case 'beat':
        return STC_BEATS.find((b) => b.key === n.id)?.name ?? n.id;
      case 'relationship': {
        const r = sim.relationships.find((rel) => rel.id === n.id);
        return r ? `${nameOf(r.from)} -> ${nameOf(r.to)} (${r.label})` : n.id;
      }
      default:
        return n.id;
    }
  };

  const outgoing = new Map<string, { to: NodeRef; rel: string; label?: string }[]>();
  const link = (from: NodeRef, to: NodeRef, rel: string, label?: string): void => {
    const list = outgoing.get(key(from)) ?? [];
    list.push({ to, rel, label });
    outgoing.set(key(from), list);
  };
  for (const e of sim.edges) link(e.from, e.to, e.rel, e.label);
  for (const r of sim.relationships) {
    const rel: NodeRef = { kind: 'relationship', id: r.id };
    link({ kind: 'character', id: r.from }, rel, 'relationship');
    link({ kind: 'character', id: r.to }, rel, 'relationship');
  }

  const result: OpResult<'graphImpact'> = { nodes: [{ ...node, label: labelFor(node) }], edges: [] };
  const seen = new Set([key(node)]);
  let frontier = [node];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: NodeRef[] = [];
    for (const from of frontier) {
      for (const { to, rel, label } of outgoing.get(key(from)) ?? []) {
        result.edges.push({ from: from.id, to: to.id, rel, label });
        if (seen.has(key(to))) continue;
        seen.add(key(to));
        next.push(to);
        result.nodes.push({ kind: to.kind, id: to.id, label: labelFor(to) });
      }
    }
    frontier = next;
  }
  return result;
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'their', 'his', 'her', 'for', 'is', 'be']);
const tokens = (answer: string): Set<string> =>
  new Set(
    answer
      .toLowerCase()
      .replace(/['’]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w && !STOP_WORDS.has(w)),
  );
const jaccard = (a: Set<string>, b: Set<string>): number => {
  const union = new Set([...a, ...b]).size;
  return union ? [...a].filter((w) => b.has(w)).length / union : 1;
};

/** Interpretation divergence of free-text answers: 0 = all equivalent, 1 = all different. null when < 2 answers. Normalises case/punctuation/stop-words. */
export function divergence(answers: string[]): number | null {
  if (answers.length < 2) return null;
  // Greedy single-link clustering: an answer joins the first cluster holding an equivalent (Jaccard ≥ 0.5) answer.
  const clusters: Set<string>[][] = [];
  for (const t of answers.map(tokens)) {
    const home = clusters.find((c) => c.some((member) => jaccard(member, t) >= 0.5));
    if (home) home.push(t);
    else clusters.push([t]);
  }
  return (clusters.length - 1) / (answers.length - 1);
}
