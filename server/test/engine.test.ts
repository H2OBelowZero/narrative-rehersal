import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyCapabilities } from '../../shared/structure.ts';
import type { Character, Domain, Odds, Project, StoryModel, Tier } from '../../shared/types.ts';
import {
  applyEffects,
  beatReadiness,
  buildModifiers,
  computeOdds,
  divergence,
  graphImpact,
  markBeatConditions,
  newSimState,
  tierFor,
} from '../src/engine.ts';

const character = (id: string, name: string, role: Character['role'], caps: Partial<Record<Domain, number>> = {}): Character => ({
  id,
  name,
  role,
  status: 'canon',
  summary: '',
  extrinsic: [],
  intrinsic: [],
  adaptive: [],
  goal: '',
  fear: '',
  secret: '',
  wound: '',
  declaredValues: [],
  capabilities: { ...emptyCapabilities(), ...caps },
  resources: ['badge'],
  performerBrief: '',
});

const model: StoryModel = {
  title: 'Harbor',
  logline: '',
  premise: '',
  genre: 'noir',
  medium: 'feature',
  tone: '',
  audience: '',
  targetDuration: '',
  theme: '',
  thematicConflict: '',
  philosophicalConflict: '',
  canon: [],
  characters: [
    character('mara', 'Mara', 'protagonist', { persuade: 3 }),
    character('jonah', 'Jonah', 'antagonist'),
    character('eli', 'Eli', 'ally'),
  ],
  relationships: [{ id: 'r1', from: 'jonah', to: 'mara', label: 'former partner', trust: -2, tension: 3, notes: '' }],
  protagonistId: 'mara',
};

const GOAL = 'Find out who gave Mara the photograph';
const fresh = () =>
  newSimState(model, {
    goal: GOAL,
    stake: 'Her sister',
    obstacle: 'Jonah',
    heading: 'INT. HARBOR OFFICE – NIGHT',
    situation: 'Rain hammers the window.',
    presentCharacterIds: ['mara', 'jonah'],
  });

test('odds are the exact distribution over the 20 faces', () => {
  for (const [mod, dc] of [[0, 12], [5, 16], [-6, 8], [14, 20], [-20, 20], [30, 8]]) {
    const tally: Odds = { critical: 0, success: 0, complication: 0, failure: 0 };
    for (let roll = 1; roll <= 20; roll++) tally[tierFor(roll, mod, dc)]++;
    const odds = computeOdds(mod, dc);
    for (const tier of Object.keys(tally) as Tier[]) assert.equal(odds[tier], tally[tier] / 20, `${tier} @ ${mod} vs ${dc}`);
    const sum = odds.critical + odds.success + odds.complication + odds.failure;
    assert.ok(Math.abs(sum - 1) < 1e-9, `sum ${sum}`);
  }
});

test('tier boundaries, natural 1 and natural 20', () => {
  // DC 12: critical ≥ 20, success ≥ 12, complication ≥ 7.
  assert.equal(tierFor(19, 1, 12), 'critical');
  assert.equal(tierFor(18, 1, 12), 'success');
  assert.equal(tierFor(12, 0, 12), 'success');
  assert.equal(tierFor(11, 0, 12), 'complication');
  assert.equal(tierFor(7, 0, 12), 'complication');
  assert.equal(tierFor(6, 0, 12), 'failure');
  assert.equal(tierFor(20, -15, 12), 'success');
  assert.equal(tierFor(20, 0, 12), 'critical');
  assert.equal(tierFor(1, 30, 12), 'complication');
  assert.equal(tierFor(1, 0, 12), 'failure');
});

test('modifiers: capability counts double, trust toward the actor, tension, resistance, conditions, circumstances', () => {
  const sim = fresh();
  assert.deepEqual(buildModifiers(model, sim, 'mara', 'persuade', 'jonah', []), [
    { label: 'Capability: Persuade 3', value: 6 },
    { label: "Jonah's trust -2", value: -1 },
    { label: 'Jonah resists (Persuade 2)', value: -1 },
  ]);
  assert.equal(buildModifiers(model, sim, 'mara', 'craft', 'jonah', []).length, 1); // craft is unopposed
  sim.relationships[0].trust = 4;
  assert.deepEqual(buildModifiers(model, sim, 'mara', 'persuade', 'jonah', [])[1], { label: "Jonah's trust +4", value: 2 });
  assert.equal(buildModifiers(model, sim, 'mara', 'intimidate', 'jonah', [])[1].value, 2); // tension 3 → +2

  sim.characters.mara.conditions.push('wounded', 'exhausted', 'soaked');
  const physical = buildModifiers(model, sim, 'mara', 'physical', 'jonah', [
    { label: 'Evidence in hand', value: 5 },
    { label: 'Nothing special', value: 0 },
  ]);
  // capability, Jonah resists, conditions (capped), circumstance (clamped)
  assert.deepEqual(physical.map((m) => m.value), [4, -1, -2, 3]);
});

test('applyEffects clamps trust, tracks setups to payoff-candidate, achieves the hero goal', () => {
  const sim = fresh();
  const applied = applyEffects(
    sim,
    model,
    [
      { type: 'trust', label: 'Jonah shuts down', from: 'jonah', to: 'mara', delta: -10 },
      { type: 'trust', label: 'Eli warms to Jonah', from: 'eli', to: 'jonah', delta: 2 },
      { type: 'knowledge', label: 'Unknown', characterId: 'ghost', fact: 'nothing' },
      { type: 'tension', label: 'Old wounds', a: 'mara', b: 'jonah', delta: 5 },
      { type: 'setup', label: 'A scar', text: 'Jonah has an unexplained scar' },
    ],
    'ev1',
  );
  assert.deepEqual(applied.map((e) => e.type), ['trust', 'trust', 'tension', 'setup']);
  assert.deepEqual(applied[0], { type: 'trust', label: 'Jonah shuts down', from: 'jonah', to: 'mara', delta: -3 });
  assert.equal(sim.relationships[0].trust, -5);
  assert.equal(sim.relationships[0].tension, 5);
  const created = sim.relationships.find((r) => r.from === 'eli' && r.to === 'jonah');
  assert.deepEqual([created?.trust, created?.label], [2, '—']);

  const [setup] = sim.setups;
  assert.equal(setup.status, 'open');
  assert.ok(sim.edges.some((e) => e.rel === 'foreshadows' && e.from.id === 'ev1' && e.to.id === setup.id));
  applyEffects(sim, model, [{ type: 'reinforce', label: 'Scar glimpsed', setupId: setup.id }], 'ev2');
  assert.equal(setup.status, 'open');
  applyEffects(sim, model, [{ type: 'reinforce', label: 'Scar again', setupId: setup.id }], 'ev3');
  assert.equal(setup.status, 'payoff-candidate');

  applyEffects(sim, model, [{ type: 'goal-progress', label: 'Closer', delta: 2 }], 'ev4');
  assert.equal(sim.sequences[0].status, 'active');
  applyEffects(sim, model, [{ type: 'goal-progress', label: 'Found it', delta: 1 }], 'ev5');
  assert.equal(sim.sequences[0].status, 'achieved');
});

test('beatReadiness flips once every requirement of the current beat is met', () => {
  const sim = fresh();
  assert.equal(beatReadiness(sim).ready, false);
  markBeatConditions(sim, ['world-shown', 'not-a-requirement', 'world-shown'], 'ev1');
  assert.deepEqual(beatReadiness(sim).met.map((r) => r.id), ['world-shown']);
  assert.equal(sim.beats[0].conditionsMet.length, 1);
  markBeatConditions(sim, ['flaw-visible'], 'ev2');
  assert.equal(beatReadiness(sim).ready, true);
});

test('newSimState seeds the graph and graphImpact walks it', () => {
  const sim = fresh();
  assert.deepEqual([sim.beats.length, sim.beats[0].status, sim.beats[1].status], [15, 'active', 'pending']);
  assert.deepEqual(sim.events.map((e) => [e.kind, e.text]), [
    ['scene-open', 'INT. HARBOR OFFICE – NIGHT'],
    ['narration', 'Rain hammers the window.'],
  ]);
  assert.deepEqual(sim.characters.eli.resources, ['badge']);
  const labels = graphImpact(sim, model, { kind: 'character', id: 'jonah' }).nodes.map((n) => n.label);
  assert.deepEqual(labels.sort(), ['Jonah', 'Jonah -> Mara (former partner)', 'Mara', GOAL].sort());
});

test('divergence: 0 when aligned, 1 when all different, null under two answers', () => {
  assert.equal(divergence(['To protect her sister', 'protect her sister!', 'Protect the sister.']), 0);
  assert.equal(divergence(['Revenge', 'Money', 'Love']), 1);
  assert.equal(divergence(['Revenge', 'revenge.', 'Love']), 0.5);
  assert.equal(divergence(['Revenge']), null);
  assert.equal(divergence([]), null);
});

test('offered moves: three, one per risk, none "performed", each leaning a different way on the theme', async () => {
  const { proposeChoices } = await import('../src/director-offline.ts');
  const themed = { ...model, theme: 'Revenge destroys the one who pursues it.', thematicConflict: 'trust vs revenge' };
  const { interpretation, approaches } = proposeChoices({ project: { model: themed } as Project, sim: fresh() }, 'mara');
  assert.equal(interpretation.needsRoll, true);
  assert.equal(interpretation.stakes, 'Her sister');
  assert.deepEqual(approaches.map((a) => a.risk), ['low', 'medium', 'high']);
  assert.ok(approaches.every((a) => !a.isPlayerOwn && a.targetId === 'jonah' && a.consequencePreview));
  const pulls = approaches.map((a) => a.themePull).filter(Boolean);
  assert.ok(pulls.includes('trust') && pulls.includes('revenge'), `pulls: ${pulls.join(', ')}`);
});
