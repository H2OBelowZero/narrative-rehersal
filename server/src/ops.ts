// RPC handlers for every op in shared/api.ts. Permission-checked with can(); results are the caller's view.
// Concurrency: Director calls are awaited OUTSIDE store.mutate; the synchronous mutate then re-validates
// its preconditions against fresh state before applying anything.
import type { OpArgs, OpName, OpResult } from '../../shared/api.ts';
import {
  CANON_STATUSES,
  DOMAINS,
  REACTIONS,
  ROLES,
  STC_BEATS,
  beatDef,
  can,
  type Permission,
} from '../../shared/structure.ts';
import type {
  Approach,
  Branch,
  CanonKind,
  CanonStatus,
  Character,
  CharacterRole,
  CharacterState,
  Discovery,
  Domain,
  Effect,
  HeroGoalSequence,
  ID,
  InterpretationKey,
  InterpretationReport,
  Participant,
  PendingAction,
  Project,
  ProjectSummary,
  Role,
  Script,
  ScriptElement,
  SimState,
  StoryEvent,
  Trait,
  WorldFit,
} from '../../shared/types.ts';
import { randomUUID } from 'node:crypto';
import * as director from './director.ts';
import {
  applyEffects,
  beatReadiness,
  cloneSim,
  computeOdds,
  divergence,
  graphImpact,
  makeApproach,
  markBeatConditions,
  newId,
  newSimState,
  nowIso,
  progressFor,
  resolveApproach,
} from './engine.ts';
import { applyPatch, foldChange } from '../../shared/script.ts';
import { blankProject, demoProject } from './seed.ts';
import * as store from './store.ts';
import { viewFor } from './view.ts';

type Handlers = { [K in OpName]: (args: OpArgs<K>) => Promise<OpResult<K>> };
type Actor = { projectId: ID; participantId: ID; token: string };

const LOCKED = 'Only the Project Owner can edit locked elements';
const CANON_AUTHORITY = 'Only the Project Owner can remove or demote canon';
const PROMOTED: CanonStatus[] = ['canon', 'locked'];
const promoted = (status: CanonStatus | undefined): boolean => !!status && PROMOTED.includes(status);
const CHARACTER_ROLES: CharacterRole[] = ['protagonist', 'antagonist', 'ally', 'supporting', 'wildcard'];
const CANON_KINDS: CanonKind[] = ['world-rule', 'constraint', 'fact', 'question', 'inspiration'];
const INTERPRETATION_KEYS: InterpretationKey[] = ['protagonistGoal', 'coreFear', 'sceneTone', 'keyRelationship'];
const MODEL_TEXT_FIELDS = [
  'title',
  'logline',
  'premise',
  'genre',
  'medium',
  'tone',
  'audience',
  'targetDuration',
  'theme',
  'thematicConflict',
  'philosophicalConflict',
] as const;

// ───────── helpers ─────────

/** Resolves the caller; the seat's secret token must match (ids are public in every view). */
function actor(project: Project, participantId: ID, token: unknown): Participant {
  const participant = project.participants.find((p) => p.id === participantId);
  if (!participant?.token || participant.token !== token) throw new Error('Unknown participant');
  return participant;
}

/** A new seat with its credential; only createProject/join ever return the token. */
function seat(name: unknown, role: Role): Participant {
  const now = nowIso();
  return { id: newId('pt'), name: text(name, 'Your name'), role, joinedAt: now, lastSeenAt: now, token: randomUUID() };
}

function requirePerm(role: Role, perm: Permission): void {
  if (!can(role, perm)) throw new Error(`Not permitted: ${perm}`);
}

function branchOf(project: Project, branchId: ID): Branch {
  const branch = project.branches.find((b) => b.id === branchId);
  if (!branch) throw new Error('Branch not found');
  return branch;
}

function scriptOf(project: Project, scriptId: ID): Script {
  const script = project.scripts.find((s) => s.id === scriptId);
  if (!script) throw new Error('Script not found');
  return script;
}

/** Applies a patch as the actor, folding each line’s change into the pending log. */
function patchScript(script: Script, me: Participant, patch: { upsert: ScriptElement[]; remove: ID[]; order: ID[] }): void {
  const { elements, changes } = applyPatch(script.elements, patch);
  const at = nowIso();
  for (const c of changes) script.changes = foldChange(script.changes, { ...c, id: newId('ch'), authorId: me.id, at });
  script.elements = elements;
  script.updatedAt = at;
  script.updatedBy = me.id;
  script.version += 1;
}

const activeBranch = (project: Project): Branch => branchOf(project, project.activeBranchId);
const simOf = (project: Project): SimState => activeBranch(project).state;

function characterOf(project: Project, characterId: ID): Character {
  const character = project.model.characters.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  return character;
}

const currentHgs = (sim: SimState): HeroGoalSequence => sim.sequences.find((s) => s.id === sim.currentSequenceId)!;

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${what} is required`);
  return value.trim();
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * Transactional change as the actor: re-checks participant + permission against fresh state, touches
 * lastSeenAt, applies `fn`, and returns the actor's view. Throwing inside `fn` leaves the project untouched.
 */
function change(args: Actor, perm: Permission | null, fn: (p: Project, me: Participant) => void): Project {
  const updated = store.mutate(args.projectId, (p) => {
    const me = actor(p, args.participantId, args.token);
    if (perm) requirePerm(me.role, perm);
    me.lastSeenAt = nowIso();
    fn(p, me);
  });
  return viewFor(updated, args.participantId);
}

/** Reads the project and checks the actor before slow (Director) work. */
function authorize(args: Actor, perm: Permission | null): { project: Project; me: Participant } {
  const project = store.get(args.projectId);
  const me = actor(project, args.participantId, args.token);
  if (perm) requirePerm(me.role, perm);
  return { project, me };
}

/** Someone about to act as `characterId`: permitted to act as them, and the stage is free. */
function onStage(args: Actor & { characterId: ID }) {
  const { project, me } = authorize(args, 'act');
  if (me.role === 'performer' && me.characterId !== args.characterId) {
    throw new Error('Performers can only act as their assigned character');
  }
  const characterId = characterOf(project, args.characterId).id;
  const branch = activeBranch(project);
  if (branch.state.pending) throw new Error('Another action is being resolved');
  return { project, me, characterId, branch };
}

const MAX_REASON = 500;

/** Keys of Director calls in flight, so a double tap can't roll twice or duplicate results. */
const busy = new Set<string>();
async function exclusive<T>(key: string, message: string, fn: () => Promise<T>): Promise<T> {
  if (busy.has(key)) throw new Error(message);
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
}

function addEvent(sim: SimState, kind: StoryEvent['kind'], fields: Partial<StoryEvent>): StoryEvent {
  const event: StoryEvent = {
    id: newId('ev'),
    at: nowIso(),
    kind,
    sceneId: sim.currentSceneId,
    sequenceId: sim.currentSequenceId,
    beatKey: sim.beats[sim.beatIndex].key,
    text: '',
    ...fields,
  };
  sim.events.push(event);
  return event;
}

function closeHgs(sim: SimState, freshNews: string, status?: HeroGoalSequence['status']): void {
  const hgs = currentHgs(sim);
  hgs.status = status ?? (hgs.progress >= hgs.required ? 'achieved' : 'redirected');
  hgs.freshNews = freshNews;
  hgs.closedAt = nowIso();
  addEvent(sim, 'fresh-news', { text: freshNews });
}

function openHgs(sim: SimState, next: { goal: string; stake: string; obstacle: string }): void {
  const hgs: HeroGoalSequence = {
    id: newId('hg'),
    number: Math.max(0, ...sim.sequences.map((s) => s.number)) + 1,
    beatKey: sim.beats[sim.beatIndex].key,
    goal: next.goal,
    stake: next.stake,
    obstacle: next.obstacle,
    progress: 0,
    required: 3,
    status: 'active',
    openedAt: nowIso(),
  };
  sim.sequences.push(hgs);
  sim.currentSequenceId = hgs.id;
}

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

const allSims = (project: Project): SimState[] => project.branches.flatMap((b) => [b.start, b.state]);

/**
 * Authored edits reach the simulation: states nobody has played yet take the model's relationships and
 * resources wholesale; played states only gain relationships they lack, so trust that evolved in play is kept.
 */
function syncAuthored(p: Project): void {
  for (const sim of allSims(p)) {
    if (!sim.events.some((e) => e.kind === 'action')) {
      sim.relationships = structuredClone(p.model.relationships);
      for (const c of p.model.characters) (sim.characters[c.id] ??= freshCharacterState(c)).resources = [...c.resources];
    } else {
      for (const r of p.model.relationships) {
        if (!sim.relationships.some((x) => x.from === r.from && x.to === r.to)) sim.relationships.push(structuredClone(r));
      }
    }
  }
}

/**
 * Canon authority (PRD §6, §8): only promoteCanon may move anything to or from canon/locked. A new element
 * asking for canon from a non-owner starts as 'proposed'; an existing one is refused.
 */
function statusFor(role: Role, prev: CanonStatus | undefined, next: CanonStatus | undefined): CanonStatus {
  const status = next ?? prev ?? 'proposed';
  if (!CANON_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  if (status === prev || can(role, 'promoteCanon')) return status;
  if (promoted(prev)) throw new Error(CANON_AUTHORITY);
  if (!promoted(status)) return status;
  if (prev === undefined) return 'proposed';
  throw new Error('Not permitted: promoteCanon');
}

/** Normalises incoming traits; non-owners may not change or drop locked ones. */
function mergeTraits(prev: Trait[], next: unknown, role: Role): Trait[] {
  const incoming = (Array.isArray(next) ? next : []) as Trait[];
  if (!can(role, 'promoteCanon')) {
    for (const old of prev.filter((t) => t.status === 'locked')) {
      const t = incoming.find((x) => x.id === old.id);
      if (!t || t.label !== old.label || (t.note ?? '') !== (old.note ?? '') || t.status !== old.status) throw new Error(LOCKED);
    }
    for (const old of prev.filter((t) => t.status === 'canon')) {
      if (!incoming.some((x) => x.id === old.id)) throw new Error(CANON_AUTHORITY);
    }
  }
  return incoming.map((t) => {
    const old = prev.find((o) => o.id === t.id);
    return {
      id: old?.id ?? newId('tr'),
      label: text(t.label, 'Trait label'),
      note: str(t.note) || undefined,
      status: statusFor(role, old?.status, t.status),
      source: old?.source ?? 'authored',
    };
  });
}

const WORLD_FIT_KEYS = [
  'startingState',
  'worldRequirements',
  'existingStrengths',
  'traitGaps',
  'falseStrengths',
  'requiredAdaptation',
  'resistance',
  'cost',
  'finalState',
] as const satisfies readonly (keyof WorldFit)[];

/** The nine World-Fit prompts as strings — never a raw client object. */
function worldFit(input: unknown): WorldFit | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const fields = input as Partial<Record<keyof WorldFit, unknown>>;
  return Object.fromEntries(WORLD_FIT_KEYS.map((k) => [k, str(fields[k])])) as unknown as WorldFit;
}

function capabilities(input: unknown): Record<Domain, number> {
  const caps = (input ?? {}) as Partial<Record<Domain, unknown>>;
  return Object.fromEntries(
    DOMAINS.map((d) => {
      const n = Number(caps[d]);
      return [d, Number.isFinite(n) ? clamp(Math.round(n), 0, 5) : 2];
    }),
  ) as Record<Domain, number>;
}

function summarize(p: Project): ProjectSummary {
  const sim = simOf(p);
  return {
    id: p.id,
    title: p.model.title,
    logline: p.model.logline,
    genre: p.model.genre,
    updatedAt: p.updatedAt,
    participantCount: p.participants.length,
    beatKey: sim.beats[sim.beatIndex].key,
  };
}

/** Escalation branches (PRD §44) make every attempt harder by the branch's stake shift, shown as a modifier. */
function escalate(approach: Approach, shift: number): Approach {
  if (!shift) return approach;
  const modifierTotal = approach.modifierTotal - shift;
  return {
    ...approach,
    modifiers: [...approach.modifiers, { label: 'Escalated stakes', value: -shift }],
    modifierTotal,
    odds: computeOdds(modifierTotal, approach.dc),
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const branchLetter = (n: number) => (n < 26 ? String.fromCharCode(65 + n) : String(n + 1));

// ───────── handlers ─────────

export const handlers: Handlers = {
  // ── Projects & crew ──

  async listProjects() {
    return store
      .list()
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async createProject({ ownerName, seed, title, logline }) {
    const { model, opening } =
      seed === 'demo' ? demoProject() : blankProject(str(title).trim() || 'Untitled story', str(logline).trim());
    const now = nowIso();
    const owner = seat(ownerName, 'owner');
    const state = newSimState(model, opening);
    const branch: Branch = {
      id: newId('br'),
      name: 'Simulation A',
      mode: 'origin',
      note: 'Origin simulation',
      createdAt: now,
      status: 'exploring',
      start: cloneSim(state),
      state,
    };
    const sessionId = newId('ss');
    const project = store.create({
      id: newId('pj'),
      version: 1,
      createdAt: now,
      updatedAt: now,
      model,
      participants: [owner],
      settings: { blindMode: false },
      branches: [branch],
      activeBranchId: branch.id,
      sessions: [{ id: sessionId, branchId: branch.id, startedAt: now, participantIds: [owner.id] }],
      activeSessionId: sessionId,
      discoveries: [],
      reactions: [],
      interpretations: [],
      reports: [],
      screenplays: [],
      scripts: [],
    });
    const view = viewFor(project, owner.id);
    return { project: view, participant: view.participants[0], token: owner.token! };
  },

  async getProject(args) {
    authorize(args, null);
    store.touch(args.projectId, args.participantId); // presence for people who only watch
    return viewFor(store.get(args.projectId), args.participantId);
  },

  async join({ projectId, name, role }) {
    if (!ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
    const participant = seat(name, role);
    const updated = store.mutate(projectId, (p) => {
      if (role === 'owner' && p.participants.some((x) => x.role === 'owner')) throw new Error('This project already has an owner');
      p.participants.push(participant);
      p.sessions.find((s) => s.id === p.activeSessionId)?.participantIds.push(participant.id);
    });
    const view = viewFor(updated, participant.id);
    return { project: view, participant: view.participants.find((x) => x.id === participant.id)!, token: participant.token! };
  },

  async assignCharacter(args) {
    return change(args, 'manageCrew', (p) => {
      const target = p.participants.find((x) => x.id === args.targetParticipantId);
      if (!target) throw new Error('Unknown participant');
      if (args.characterId === null) delete target.characterId;
      else target.characterId = characterOf(p, args.characterId).id;
    });
  },

  async setBlindMode(args) {
    return change(args, 'manageCrew', (p) => {
      p.settings.blindMode = !!args.blindMode;
    });
  },

  async startSession(args) {
    return change(args, 'manageCrew', (p) => {
      if (p.activeSessionId) throw new Error('A session is already running');
      const id = newId('ss');
      p.sessions.push({ id, branchId: p.activeBranchId, startedAt: nowIso(), participantIds: p.participants.map((x) => x.id) });
      p.activeSessionId = id;
    });
  },

  async endSession(args) {
    return change(args, 'manageCrew', (p) => {
      const session = p.sessions.find((s) => s.id === p.activeSessionId);
      if (!session) throw new Error('No session is running');
      session.endedAt = nowIso();
      delete p.activeSessionId;
    });
  },

  async directorStatus() {
    return director.directorInfo();
  },

  // ── Story Model ──

  async updateModel(args) {
    return change(args, 'editModel', (p) => {
      const patch = args.patch ?? {};
      for (const key of MODEL_TEXT_FIELDS) if (typeof patch[key] === 'string') p.model[key] = patch[key];
      if (patch.protagonistId !== undefined) p.model.protagonistId = characterOf(p, patch.protagonistId).id;
    });
  },

  async upsertCharacter(args) {
    return change(args, 'editModel', (p, me) => {
      const input = args.character;
      const prev = p.model.characters.find((c) => c.id === input.id);
      if (prev?.status === 'locked' && !can(me.role, 'promoteCanon')) throw new Error(LOCKED);
      const character: Character = {
        id: prev?.id ?? newId('ch'),
        name: text(input.name, 'Character name'),
        role: CHARACTER_ROLES.includes(input.role) ? input.role : 'supporting',
        status: statusFor(me.role, prev?.status, input.status),
        summary: str(input.summary),
        extrinsic: mergeTraits(prev?.extrinsic ?? [], input.extrinsic, me.role),
        intrinsic: mergeTraits(prev?.intrinsic ?? [], input.intrinsic, me.role),
        adaptive: mergeTraits(prev?.adaptive ?? [], input.adaptive, me.role),
        goal: str(input.goal),
        fear: str(input.fear),
        secret: str(input.secret),
        wound: str(input.wound),
        declaredValues: strings(input.declaredValues),
        capabilities: capabilities(input.capabilities),
        resources: strings(input.resources),
        worldFit: worldFit(input.worldFit),
        performerBrief: str(input.performerBrief),
        voice: str(input.voice),
        ...((str(input.image) || prev?.image) && { image: str(input.image) || prev?.image }),
      };
      if (prev) {
        p.model.characters = p.model.characters.map((c) => (c.id === prev.id ? character : c));
      } else {
        p.model.characters.push(character);
        for (const sim of allSims(p)) sim.characters[character.id] = freshCharacterState(character);
      }
      syncAuthored(p);
    });
  },

  async deleteCharacter(args) {
    return change(args, 'editModel', (p, me) => {
      const character = characterOf(p, args.characterId);
      if (character.id === p.model.protagonistId) throw new Error('The protagonist cannot be deleted');
      const traits = [...character.extrinsic, ...character.intrinsic, ...character.adaptive];
      if (!can(me.role, 'promoteCanon') && (promoted(character.status) || traits.some((t) => promoted(t.status)))) {
        throw new Error(CANON_AUTHORITY);
      }
      const touches = (r: { from: ID; to: ID }) => r.from === character.id || r.to === character.id;
      p.model.characters = p.model.characters.filter((c) => c.id !== character.id);
      p.model.relationships = p.model.relationships.filter((r) => !touches(r));
      for (const sim of allSims(p)) {
        delete sim.characters[character.id];
        sim.relationships = sim.relationships.filter((r) => !touches(r));
      }
      for (const participant of p.participants) if (participant.characterId === character.id) delete participant.characterId;
    });
  },

  async upsertRelationship(args) {
    return change(args, 'editModel', (p) => {
      const input = args.relationship;
      const from = characterOf(p, input.from).id;
      const to = characterOf(p, input.to).id;
      if (from === to) throw new Error('A relationship needs two different characters');
      const prev = p.model.relationships.find((r) => r.id === input.id);
      const relationship = {
        id: prev?.id ?? newId('rl'),
        from,
        to,
        label: str(input.label),
        trust: clamp(Math.round(Number(input.trust) || 0), -5, 5),
        tension: clamp(Math.round(Number(input.tension) || 0), 0, 5),
        notes: str(input.notes),
      };
      if (prev) p.model.relationships = p.model.relationships.map((r) => (r.id === prev.id ? relationship : r));
      else p.model.relationships.push(relationship);
      syncAuthored(p);
    });
  },

  async deleteRelationship(args) {
    return change(args, 'editModel', (p) => {
      const before = p.model.relationships.length;
      p.model.relationships = p.model.relationships.filter((r) => r.id !== args.relationshipId);
      if (p.model.relationships.length === before) throw new Error('Relationship not found');
      syncAuthored(p);
    });
  },

  async upsertCanonItem(args) {
    return change(args, 'editModel', (p, me) => {
      const input = args.item;
      const prev = p.model.canon.find((i) => i.id === input.id);
      if (prev?.status === 'locked' && !can(me.role, 'promoteCanon')) throw new Error(LOCKED);
      if (!CANON_KINDS.includes(input.kind)) throw new Error(`Invalid canon kind: ${input.kind}`);
      const item = {
        id: prev?.id ?? newId('cn'),
        kind: input.kind,
        text: text(input.text, 'Text'),
        status: statusFor(me.role, prev?.status, input.status),
        source: prev?.source ?? 'authored',
        discoveryId: prev?.discoveryId,
        updatedAt: nowIso(),
      };
      if (prev) p.model.canon = p.model.canon.map((i) => (i.id === prev.id ? item : i));
      else p.model.canon.push(item);
    });
  },

  async deleteCanonItem(args) {
    return change(args, 'editModel', (p, me) => {
      const item = p.model.canon.find((i) => i.id === args.itemId);
      if (!item) throw new Error('Canon item not found');
      if (promoted(item.status) && !can(me.role, 'promoteCanon')) throw new Error(CANON_AUTHORITY);
      p.model.canon = p.model.canon.filter((i) => i.id !== item.id);
    });
  },

  async setCanonStatus(args) {
    return change(args, null, (p, me) => {
      const { target, status } = args;
      if (!CANON_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
      requirePerm(me.role, 'editModel');
      const owner = can(me.role, 'promoteCanon');
      // Moving anything to or from canon/locked is canon authority.
      const authorize = (current: CanonStatus) => {
        if (!owner && (promoted(status) || promoted(current))) throw new Error('Not permitted: promoteCanon');
      };
      if (target.kind === 'canon') {
        const item = p.model.canon.find((i) => i.id === target.id);
        if (!item) throw new Error('Canon item not found');
        authorize(item.status);
        item.status = status;
        item.updatedAt = nowIso();
      } else if (target.kind === 'character') {
        const character = characterOf(p, target.id);
        authorize(character.status);
        character.status = status;
      } else {
        const character = characterOf(p, target.characterId);
        const trait = [...character.extrinsic, ...character.intrinsic, ...character.adaptive].find((t) => t.id === target.id);
        if (!trait) throw new Error('Trait not found');
        if (character.status === 'locked' && !owner) throw new Error(LOCKED);
        authorize(trait.status);
        trait.status = status;
      }
    });
  },

  // ── Simulation Room ──

  async proposeChoices(args) {
    const { project, me, characterId, branch } = onStage(args);
    return exclusive(`declare:${branch.id}`, 'Another action is being resolved', async () => {
      const { interpretation, approaches } = await director.proposeChoices({ project, sim: branch.state }, characterId);
      return change(args, 'act', (p) => {
        const b = branchOf(p, branch.id);
        if (b.state.pending) throw new Error('Another action is being resolved');
        const shift = b.overrides?.stakeShift ?? 0;
        b.state.pending = {
          id: newId('pa'),
          participantId: me.id,
          characterId,
          input: '',
          proposed: true,
          interpretation,
          approaches: approaches.map((d) => escalate(makeApproach(p.model, b.state, characterId, d), shift)),
          createdAt: nowIso(),
        };
      });
    });
  },

  async declareAction(args) {
    const input = text(args.input, 'An action');
    const { project, me, characterId, branch } = onStage(args);

    return exclusive(`declare:${branch.id}`, 'Another action is being resolved', async () => {
      const ctx = { project, sim: branch.state };
      const { interpretation, approaches } = await director.interpretAction(ctx, characterId, input);
      const pending: PendingAction = {
        id: newId('pa'),
        participantId: me.id,
        characterId,
        input,
        interpretation,
        approaches: [],
        createdAt: nowIso(),
      };
      const narrated = interpretation.needsRoll ? null : await director.narrateNoRoll(ctx, pending);

      return change(args, 'act', (p) => {
        const sim = branchOf(p, branch.id).state;
        if (sim.pending) throw new Error('Another action is being resolved');
        if (!narrated) {
          const shift = branchOf(p, branch.id).overrides?.stakeShift ?? 0;
          pending.approaches = approaches.map((d) => escalate(makeApproach(p.model, sim, characterId, d), shift));
          sim.pending = pending;
          return;
        }
        addEvent(sim, 'action', { text: input, playerInput: input, participantId: me.id, actorId: characterId });
        const narration = addEvent(sim, 'narration', { text: narrated.narration });
        narration.effects = applyEffects(sim, p.model, narrated.effects, narration.id);
        markBeatConditions(sim, narrated.beatRequirementsMet, narration.id);
      });
    });
  },

  async resolveAction(args) {
    const { project, me } = authorize(args, null);
    const branch = activeBranch(project);
    const pending = branch.state.pending;
    if (!pending) throw new Error('No action is waiting to be resolved');
    if (pending.participantId !== me.id) requirePerm(me.role, 'direct');
    const approach = pending.approaches.find((a) => a.id === args.approachId);
    if (!approach) throw new Error('Unknown approach');

    return exclusive(pending.id, 'This action is already being resolved', async () => {
      const resolution = resolveApproach(approach, pending.interpretation.intent);
      // An offered move has no performed words: the chosen move stands in as what the character does.
      const acted = pending.proposed ? { ...pending, input: approach.label } : pending;
      const outcome = await director.narrateOutcome({ project, sim: branch.state }, acted, approach, resolution);

      return change(args, null, (p) => {
        const sim = branchOf(p, branch.id).state;
        if (sim.pending?.id !== pending.id) throw new Error('The action was cancelled before it resolved');
        const checkpoint = cloneSim(sim);
        checkpoint.pending = null;
        branchOf(p, branch.id).checkpoint = checkpoint;
        // The Hero Goal Sequence is the protagonist's pursuit (PRD §13): only their outcomes move or close it.
        const hero = pending.characterId === p.model.protagonistId;
        const who = { participantId: pending.participantId, actorId: pending.characterId };
        addEvent(sim, 'action', { ...who, text: acted.input, playerInput: pending.proposed ? undefined : pending.input });

        // Goal progress is the engine's call, not the Director's.
        const directorEffects = (effects: Effect[]): Effect[] => effects.filter((e) => e.type !== 'goal-progress');
        const effects = directorEffects(outcome.effects);
        const progress = progressFor(resolution.tier, approach);
        if (hero && progress > 0) effects.push({ type: 'goal-progress', delta: progress, label: `Goal +${progress}` });
        const resolved = addEvent(sim, 'resolution', { ...who, text: outcome.narration, resolution });
        resolved.effects = applyEffects(sim, p.model, effects, resolved.id);

        for (const ripple of outcome.propagation) {
          const event = addEvent(sim, 'propagation', { text: ripple.text, visibleTo: ripple.visibleTo });
          event.effects = applyEffects(sim, p.model, directorEffects(ripple.effects), event.id);
        }
        markBeatConditions(sim, outcome.beatRequirementsMet, resolved.id);

        if (hero && outcome.freshNews) {
          closeHgs(sim, outcome.freshNews.text);
          openHgs(sim, outcome.freshNews);
        }
        sim.pending = null;
      });
    });
  },

  async cancelAction(args) {
    return change(args, null, (p, me) => {
      const sim = simOf(p);
      if (!sim.pending) throw new Error('No action is waiting to be resolved');
      if (sim.pending.participantId !== me.id) requirePerm(me.role, 'direct');
      if (busy.has(sim.pending.id)) throw new Error('The dice are already rolling');
      sim.pending = null;
    });
  },

  async explainChoice(args) {
    const reason = text(args.reason, 'A reason');
    return change(args, null, (p, me) => {
      const event = simOf(p).events.find((e) => e.id === args.eventId);
      if (event?.kind !== 'resolution') throw new Error('That choice was not found');
      if (event.participantId !== me.id) requirePerm(me.role, 'direct');
      event.reason = reason.slice(0, MAX_REASON);
    });
  },

  async narrate(args) {
    const narration = text(args.text, 'Narration');
    return change(args, 'direct', (p, me) => {
      addEvent(simOf(p), 'narration', { text: narration, participantId: me.id, directorOnly: !!args.directorOnly });
    });
  },

  async openScene(args) {
    const heading = text(args.heading, 'A scene heading');
    return change(args, 'direct', (p) => {
      const sim = simOf(p);
      const present = strings(args.presentCharacterIds).filter((id) => p.model.characters.some((c) => c.id === id));
      const current = sim.scenes.find((s) => s.id === sim.currentSceneId);
      if (current?.status === 'open') {
        const lastResolution = sim.events.findLast((e) => e.sceneId === current.id && e.kind === 'resolution');
        current.status = 'closed';
        if (lastResolution) current.shift = truncate(lastResolution.text, 160);
        addEvent(sim, 'scene-close', { text: current.shift ?? current.heading });
      }
      const scene = {
        id: newId('sc'),
        sequenceId: sim.currentSequenceId,
        heading,
        situation: str(args.situation).trim(),
        presentCharacterIds: present,
        status: 'open' as const,
      };
      sim.scenes.push(scene);
      sim.currentSceneId = scene.id;
      // Same shape as the opening scene from engine.newSimState: slugline, then the situation.
      addEvent(sim, 'scene-open', { text: heading });
      if (scene.situation) addEvent(sim, 'narration', { text: scene.situation });
    });
  },

  async openSequence(args) {
    const freshNews = text(args.freshNews, 'Fresh news');
    const next = { goal: text(args.goal, 'A goal'), stake: str(args.stake).trim(), obstacle: str(args.obstacle).trim() };
    if (args.closeAs && !['achieved', 'redirected', 'abandoned'].includes(args.closeAs)) {
      throw new Error(`Invalid closeAs: ${args.closeAs}`);
    }
    return change(args, 'direct', (p) => {
      const sim = simOf(p);
      closeHgs(sim, freshNews, args.closeAs);
      openHgs(sim, next);
    });
  },

  async advanceBeat(args) {
    return change(args, 'direct', (p) => {
      const sim = simOf(p);
      const from = STC_BEATS[sim.beatIndex];
      if (sim.beatIndex >= STC_BEATS.length - 1) throw new Error(`${from.name} is the last beat`);
      const { ready, unmet } = beatReadiness(sim);
      if (!ready && !args.force) throw new Error(`${from.name} still needs: ${unmet.map((r) => r.text).join('; ')}`);
      sim.beats[sim.beatIndex].status = 'satisfied';
      sim.beatIndex++;
      sim.beats[sim.beatIndex].status = 'active';
      const to = STC_BEATS[sim.beatIndex];
      addEvent(sim, 'beat-advance', {
        text: `${from.name} → ${to.name}${ready ? '' : ' (advanced before its requirements were met)'}`,
        directorOnly: true,
      });
      sim.opportunities = [];
    });
  },

  async generateOpportunities(args) {
    const { project } = authorize(args, 'direct');
    const branch = activeBranch(project);
    const sim = branch.state;
    const upcoming = beatReadiness(sim).ready && sim.beatIndex < STC_BEATS.length - 1;
    const beatKey = STC_BEATS[sim.beatIndex + (upcoming ? 1 : 0)].key;

    return exclusive(`opportunities:${branch.id}`, 'Opportunities are already being generated', async () => {
      const drafts = await director.generateOpportunities({ project, sim }, beatKey);
      return change(args, 'direct', (p) => {
        const state = branchOf(p, branch.id).state;
        if (state.beatIndex !== sim.beatIndex) throw new Error('The beat changed while the Director was thinking — generate again');
        state.opportunities = drafts.map((d) => ({ ...d, id: newId('op') }));
      });
    });
  },

  async selectOpportunity(args) {
    return change(args, 'direct', (p) => {
      const sim = simOf(p);
      const opportunity = sim.opportunities.find((o) => o.id === args.opportunityId);
      if (!opportunity) throw new Error('Opportunity not found');
      sim.directive = `${opportunity.title}: ${opportunity.description}`;
      const beat = sim.beats.find((b) => b.key === opportunity.beatKey);
      if (beat) beat.chosenOpportunityId = opportunity.id;
      const event = addEvent(sim, 'directive', {
        text: `Chose ${opportunity.label} (${opportunity.kind}) for ${beatDef(opportunity.beatKey).name}: ${opportunity.title}`,
        directorOnly: true,
      });
      // The choice lands in story state, not just in the Director's notes.
      const setup = opportunity.setupCreated.trim();
      if (setup) event.effects = applyEffects(sim, p.model, [{ type: 'setup', label: `Future setup: ${setup}`, text: setup }], event.id);
      for (const s of sim.setups) if (opportunity.payoffSetupIds.includes(s.id) && s.status === 'open') s.status = 'payoff-candidate';
    });
  },

  async graphImpact(args) {
    const { project, me } = authorize(args, null);
    if (!can(me.role, 'seeMeta') && !can(me.role, 'editModel')) throw new Error('Not permitted: seeMeta');
    store.touch(args.projectId, me.id);
    return graphImpact(simOf(project), project.model, args.node, args.depth);
  },

  // ── Crew Room ──

  async react(args) {
    if (!Object.hasOwn(REACTIONS, args.kind)) throw new Error(`Invalid reaction: ${args.kind}`);
    return change(args, 'react', (p, me) => {
      if (!simOf(p).events.some((e) => e.id === args.eventId)) throw new Error('Event not found');
      const same = (r: Project['reactions'][number]) =>
        r.participantId === me.id && r.eventId === args.eventId && r.kind === args.kind;
      if (p.reactions.some(same)) {
        p.reactions = p.reactions.filter((r) => !same(r));
        return;
      }
      const note = str(args.note).trim();
      p.reactions.push({
        id: newId('rx'),
        eventId: args.eventId,
        participantId: me.id,
        kind: args.kind,
        ...(note && { note }),
        at: nowIso(),
      });
    });
  },

  async submitInterpretation(args) {
    if (args.phase !== 'before' && args.phase !== 'after') throw new Error(`Invalid phase: ${args.phase}`);
    const answers = Object.fromEntries(
      INTERPRETATION_KEYS.map((k) => [k, str(args.answers?.[k]).trim()]),
    ) as Record<InterpretationKey, string>;
    return change(args, 'react', (p, me) => {
      const same = (i: Project['interpretations'][number]) =>
        i.participantId === me.id && i.phase === args.phase && i.branchId === p.activeBranchId;
      p.interpretations = p.interpretations.filter((i) => !same(i));
      p.interpretations.push({ id: newId('in'), participantId: me.id, branchId: p.activeBranchId, phase: args.phase, answers, at: nowIso() });
    });
  },

  async generateReport(args) {
    const { project } = authorize(args, 'analyze');
    const branch = activeBranch(project);
    const interpretations = project.interpretations.filter((i) => i.branchId === branch.id);
    if (!interpretations.length) throw new Error('No interpretations have been submitted for this simulation yet');
    const eventIds = new Set(branch.state.events.map((e) => e.id));
    const reactions = project.reactions.filter((r) => eventIds.has(r.eventId));

    return exclusive(`report:${branch.id}`, 'A report is already being written', async () => {
      const draft = await director.writeReport({ project, sim: branch.state }, interpretations, reactions);
      const roleOf = (id: ID): Role => project.participants.find((x) => x.id === id)?.role ?? 'observer';

      const rows: InterpretationReport['rows'] = INTERPRETATION_KEYS.map((key) => {
        const answers = interpretations
          .map((i) => ({ participantId: i.participantId, role: roleOf(i.participantId), answer: i.answers[key] ?? '', phase: i.phase }))
          .filter((a) => a.answer.trim());
        const inPhase = (phase: 'before' | 'after') => answers.filter((a) => a.phase === phase).map((a) => a.answer);
        const semantic = draft.divergence?.[key];
        return {
          key,
          answers,
          divergenceBefore: semantic?.before ?? divergence(inPhase('before')),
          divergenceAfter: semantic?.after ?? divergence(inPhase('after')),
          note: draft.notes[key] ?? '',
        };
      });
      const paired = rows.filter((r) => r.divergenceBefore !== null && r.divergenceAfter !== null);
      const report: InterpretationReport = {
        id: newId('rp'),
        branchId: branch.id,
        createdAt: nowIso(),
        summary: draft.summary,
        rows,
        alignmentGain: paired.length
          ? mean(paired.map((r) => r.divergenceBefore!)) - mean(paired.map((r) => r.divergenceAfter!))
          : null,
        highlights: draft.highlights,
        emergent: draft.emergent,
      };
      return change(args, 'analyze', (p) => {
        p.reports.push(report);
      });
    });
  },

  // ── Discovery Room ──

  async analyzeDiscoveries(args) {
    const { project } = authorize(args, 'analyze');
    const branch = activeBranch(project);
    return exclusive(`discoveries:${branch.id}`, 'Discoveries are already being analysed', async () => {
      const drafts = await director.analyzeDiscoveries({ project, sim: branch.state });
      return change(args, 'analyze', (p) => {
        const createdAt = nowIso();
        for (const d of drafts) {
          const discovery: Discovery = { ...d, id: newId('di'), status: 'new', branchId: branch.id, createdAt };
          if (p.activeSessionId) discovery.sessionId = p.activeSessionId;
          p.discoveries.push(discovery);
        }
      });
    });
  },

  async decideDiscovery(args) {
    const { decision } = args;
    if (!['considering', 'promoted', 'rejected'].includes(decision)) throw new Error(`Invalid decision: ${decision}`);
    return change(args, decision === 'promoted' ? 'promoteCanon' : 'analyze', (p, me) => {
      const discovery = p.discoveries.find((d) => d.id === args.discoveryId);
      if (!discovery) throw new Error('Discovery not found');
      if (discovery.status === 'promoted') throw new Error('This discovery is already canon');
      discovery.status = decision;
      discovery.decidedBy = me.id;
      const resolution = str(args.resolution).trim();
      if (resolution) discovery.resolution = resolution;
      if (decision !== 'promoted') return;
      // Honour the Owner's reading: a deviation or passing state is recorded on the discovery, not written into canon.
      if (/deviation|temporary|leave it|without/i.test(resolution)) return;

      const character = p.model.characters.find((c) => c.id === discovery.characterId);
      if (character && discovery.observed && (discovery.kind === 'divergence' || discovery.kind === 'character')) {
        character.intrinsic.push({
          id: newId('tr'),
          label: discovery.observed,
          note: discovery.interpretation,
          status: 'canon',
          source: 'emergent',
        });
      }
      p.model.canon.push({
        id: newId('cn'),
        kind: 'fact',
        text: discovery.kind === 'divergence' || discovery.kind === 'character' ? (discovery.interpretation ?? discovery.observation) : discovery.observation,
        status: 'canon',
        source: 'simulation',
        discoveryId: discovery.id,
        updatedAt: nowIso(),
      });
    });
  },

  // ── Branches ──

  async createBranch(args) {
    return change(args, 'direct', (p) => {
      const from = branchOf(p, args.fromBranchId);
      const raw = args.overrides ?? {};
      const shift = Number(raw.stakeShift);
      const overrides: NonNullable<Branch['overrides']> = {
        ...(str(raw.characterId) && { characterId: str(raw.characterId) }),
        ...(str(raw.priority).trim() && { priority: str(raw.priority).trim() }),
        ...(str(raw.goal).trim() && { goal: str(raw.goal).trim() }),
        ...(Number.isFinite(shift) && shift !== 0 && { stakeShift: clamp(Math.round(shift), -6, 6) }),
      };
      // Variation replays the last decision differently, so it forks from just before it.
      const state = cloneSim(args.mode === 'variation' ? (from.checkpoint ?? from.state) : from.start);
      switch (args.mode) {
        case 'replay':
        case 'variation':
          break;
        case 'escalation': {
          const hgs = currentHgs(state);
          if (!hgs.stake.startsWith('ESCALATED: ')) hgs.stake = `ESCALATED: ${hgs.stake}`;
          state.directive = 'Escalation: replay this situation with higher stakes. Every failure now costs more, and the opposition moves sooner.';
          overrides.stakeShift ??= 2;
          break;
        }
        case 'character-reinterpretation': {
          const priority = text(overrides.priority, 'A new priority');
          const character = characterOf(p, text(overrides.characterId, 'A character'));
          state.directive = `${character.name} now prioritises ${priority}`;
          break;
        }
        case 'goal-reinterpretation':
          currentHgs(state).goal = text(overrides.goal, 'A new goal');
          break;
        default:
          throw new Error(`Invalid branch mode: ${String(args.mode)}`);
      }
      state.pending = null;
      const branch: Branch = {
        id: newId('br'),
        name: str(args.name).trim() || `Simulation ${branchLetter(p.branches.length)}`,
        mode: args.mode,
        note: str(args.note).trim(),
        parentId: from.id,
        createdAt: nowIso(),
        status: 'exploring',
        ...(Object.keys(overrides).length && { overrides }),
        start: cloneSim(state),
        state,
      };
      p.branches.push(branch);
      p.activeBranchId = branch.id;
    });
  },

  async switchBranch(args) {
    return change(args, 'direct', (p) => {
      p.activeBranchId = branchOf(p, args.branchId).id;
    });
  },

  async promoteBranch(args) {
    return change(args, 'promoteCanon', (p) => {
      const promoted = branchOf(p, args.branchId);
      for (const b of p.branches) if (b.status === 'canon') b.status = 'exploring';
      promoted.status = 'canon';
    });
  },

  // ── Screenplay Room ──

  async compileScreenplay(args) {
    const { project } = authorize(args, 'analyze');
    const branch = activeBranch(project);
    const sim = branch.state;
    const sequenceId = args.sequenceId ?? (args.sceneIds?.length ? undefined : sim.currentSequenceId);
    const sequence = sim.sequences.find((s) => s.id === sequenceId);
    if (sequenceId && !sequence) throw new Error('Sequence not found');

    // A scene can straddle sequences (fresh news mid-scene), so a sequence covers every scene it played in,
    // and the current sequence always includes the scene it is being pursued in.
    const inSequence = (sceneId: ID) =>
      (sequenceId === sim.currentSequenceId && sceneId === sim.currentSceneId) ||
      sim.events.some((e) => e.sequenceId === sequenceId && e.sceneId === sceneId);
    const scenes = sim.scenes.filter((s) =>
      args.sceneIds?.length && !args.sequenceId ? args.sceneIds.includes(s.id) : s.sequenceId === sequenceId || inSequence(s.id),
    );
    const sceneIds = new Set(scenes.map((s) => s.id));
    const events = sim.events.filter((e) => e.kind !== 'beat-advance' && e.sceneId && sceneIds.has(e.sceneId));
    if (!events.length) throw new Error('Nothing has been played in this part of the story yet');

    return exclusive(`screenplay:${branch.id}`, 'A screenplay is already being compiled', async () => {
      const elements = await director.compileScreenplay({ project, sim }, events, scenes);
      return change(args, 'analyze', (p) => {
        const version = p.screenplays.filter((d) => d.sequenceId === sequenceId).length + 1;
        p.screenplays.push({
          id: newId('sp'),
          branchId: branch.id,
          title: `${p.model.title}: ${sequence ? `Hero goal sequence ${sequence.number}` : 'Selected scenes'}`,
          createdAt: nowIso(),
          ...(sequenceId && { sequenceId }),
          sceneIds: scenes.map((s) => s.id),
          version,
          elements: elements.map((e) => ({ ...e, id: newId('el') })),
          notes: '',
        });
      });
    });
  },

  // ── Write Room ──

  async createScript(args) {
    return change(args, 'editModel', (p, me) => {
      const draft = args.fromDraftId ? p.screenplays.find((d) => d.id === args.fromDraftId) : undefined;
      if (args.fromDraftId && !draft) throw new Error('Draft not found');
      const now = nowIso();
      const elements: ScriptElement[] = draft
        ? draft.elements.map((e) => ({ id: newId('el'), type: e.type, text: e.text }))
        : [{ id: newId('el'), type: 'heading', text: '' }];
      p.scripts.push({
        id: newId('sc'),
        title: truncate(text(args.title, 'A title'), 120),
        createdAt: now,
        createdBy: me.id,
        updatedAt: now,
        updatedBy: me.id,
        version: 1,
        elements,
        // Version 1 is what you started from, so the first changes have something to be measured against.
        revisions: [{ number: 1, name: draft ? 'Compiled draft' : 'First draft', note: '', authorId: me.id, createdAt: now, elements }],
        changes: [],
        comments: [],
        ...(draft && { fromDraftId: draft.id }),
      });
    });
  },

  async saveScript(args) {
    return change(args, 'editModel', (p, me) => {
      const script = scriptOf(p, args.scriptId);
      if (args.title !== undefined) script.title = truncate(text(args.title, 'A title'), 120);
      const patch = args.patch ?? { upsert: [], remove: [], order: [] };
      patchScript(script, me, {
        upsert: Array.isArray(patch.upsert) ? patch.upsert : [],
        remove: strings(patch.remove),
        order: strings(patch.order),
      });
    });
  },

  async deleteScript(args) {
    return change(args, 'editModel', (p, me) => {
      const script = scriptOf(p, args.scriptId);
      if (script.createdBy !== me.id && me.role !== 'owner') throw new Error('Only its writer or the Project Owner can delete a script');
      p.scripts = p.scripts.filter((s) => s.id !== script.id);
    });
  },

  async saveRevision(args) {
    return change(args, 'editModel', (p, me) => {
      const script = scriptOf(p, args.scriptId);
      const number = (script.revisions.at(-1)?.number ?? 0) + 1;
      script.revisions.push({
        number,
        name: truncate(text(args.name, 'A revision name'), 80),
        note: truncate(str(args.note).trim(), 1000),
        authorId: me.id,
        createdAt: nowIso(),
        elements: script.elements.map((e) => ({ ...e })),
      });
      for (const c of script.changes) c.revision ??= number;
    });
  },

  async restoreRevision(args) {
    return change(args, 'editModel', (p, me) => {
      const script = scriptOf(p, args.scriptId);
      const revision = script.revisions.find((r) => r.number === args.number);
      if (!revision) throw new Error('Revision not found');
      const keep = new Set(revision.elements.map((e) => e.id));
      patchScript(script, me, {
        upsert: revision.elements.map((e) => ({ ...e })),
        remove: script.elements.filter((e) => !keep.has(e.id)).map((e) => e.id),
        order: revision.elements.map((e) => e.id),
      });
    });
  },

  async addScriptComment(args) {
    return change(args, 'react', (p, me) => {
      const script = scriptOf(p, args.scriptId);
      const anchor = args.elementId ? script.elements.find((e) => e.id === args.elementId) : undefined;
      if (args.elementId && !anchor) throw new Error('That line is no longer in the script');
      script.comments.push({
        id: newId('cm'),
        ...(anchor && { elementId: anchor.id, quote: truncate(anchor.text, 140) }),
        text: truncate(text(args.text, 'A note'), 2000),
        authorId: me.id,
        at: nowIso(),
        resolved: false,
      });
    });
  },

  async resolveScriptComment(args) {
    return change(args, 'react', (p, me) => {
      const comment = scriptOf(p, args.scriptId).comments.find((c) => c.id === args.commentId);
      if (!comment) throw new Error('Note not found');
      if (comment.authorId !== me.id && !can(me.role, 'editModel')) throw new Error('Only a writer or the note’s author can resolve it');
      comment.resolved = !!args.resolved;
    });
  },
};
