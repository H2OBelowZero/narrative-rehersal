// Per-viewer projection of a Project (PRD §14, §32, §35): meta layer for owner/director/producer only,
// secrets hidden from performers/observers, and blind sessions reduced to the performer's brief.
import { can, DOMAINS } from '../../shared/structure.ts';
import type { Character, Domain, Effect, ID, Project, StoryEvent } from '../../shared/types.ts';

export function viewFor(project: Project, participantId?: ID): Project {
  const view = structuredClone(project);
  for (const p of view.participants) delete p.token;
  for (const b of view.branches) delete b.checkpoint;
  const me = view.participants.find((p) => p.id === participantId);
  const role = me?.role ?? 'observer';
  const own = me?.characterId;
  const sims = view.branches.flatMap((b) => [b.start, b.state]);

  if (!can(role, 'seeMeta')) {
    for (const sim of sims) {
      sim.opportunities = [];
      delete sim.directive;
      sim.events = sim.events.filter((e) => !e.directorOnly);
      if (sim.pending) {
        // Written for the Director.
        delete sim.pending.interpretation.themeRelevance;
        for (const a of sim.pending.approaches) delete a.themePull;
      }
    }
  }
  if (role !== 'performer' && role !== 'observer') return view;

  view.redacted = true;
  for (const c of view.model.characters) if (c.id !== own) c.secret = '';
  for (const sim of sims) {
    for (const cs of Object.values(sim.characters)) {
      if (cs.characterId === own) continue;
      cs.knowledge = [];
      cs.conditions = [];
    }
  }
  if (role === 'performer' && view.settings.blindMode) blind(view, own, me?.id);
  return view;
}

/** Blind session (PRD §32): the performer gets only what is needed to play the role. */
function blind(view: Project, own: ID | undefined, participantId: ID | undefined): void {
  const model = view.model;
  model.premise = model.theme = model.thematicConflict = model.philosophicalConflict = '';
  model.characters = model.characters.map((c) =>
    c.id === own
      ? stripped(c, { performerBrief: c.performerBrief, goal: c.goal, capabilities: c.capabilities })
      : stripped(c, { summary: c.summary }),
  );
  model.canon = model.canon.filter((item) => item.kind === 'world-rule');
  for (const r of model.relationships) r.notes = '';

  const witnessed = (e: StoryEvent) => !e.visibleTo || (own !== undefined && e.visibleTo.includes(own));
  // Keep only what the performer's character could perceive: no interpretive layer, nothing about others' inner state.
  const perceivable = (x: Effect) =>
    !INTERPRETIVE.has(x.type) && !('characterId' in x && x.characterId !== own);
  for (const branch of view.branches) {
    const sim = branch.state;
    sim.events = branch.id === view.activeBranchId ? sim.events.filter(witnessed) : [];
    for (const e of sim.events) if (e.effects) e.effects = e.effects.filter(perceivable);
    if (sim.pending && sim.pending.characterId !== own) sim.pending.approaches = [];
    delete branch.overrides;
    branch.note = '';
    sim.setups = [];
    sim.themeSignals = [];
    sim.edges = [];
    for (const id of Object.keys(sim.characters)) if (id !== own) delete sim.characters[id];
    for (const r of sim.relationships) r.notes = '';
    branch.start = sim;
  }
  view.discoveries = [];
  view.reports = [];
  view.screenplays = [];
  view.scripts = [];
  view.interpretations = view.interpretations.filter((i) => i.participantId === participantId);
  view.reactions = view.reactions.map((r) => (r.participantId === participantId ? r : { ...r, note: undefined }));
}

const INTERPRETIVE = new Set<Effect['type']>(['theme', 'behavior', 'empathy', 'setup', 'reinforce', 'payoff']);

function stripped(c: Character, keep: Partial<Character>): Character {
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    status: c.status,
    summary: '',
    extrinsic: [],
    intrinsic: [],
    adaptive: [],
    goal: '',
    fear: '',
    secret: '',
    wound: '',
    declaredValues: [],
    capabilities: Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Record<Domain, number>,
    resources: [],
    performerBrief: '',
    voice: '',
    ...keep,
  };
}
