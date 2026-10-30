// Plain-language story effects (PRD §49 "Story effects") and who may see which of them.
import { EMPATHY_SIGNALS } from '@shared/structure';
import type { Effect, Project, Role, ThemeStance } from '@shared/types';

/** PRD §30 wording — a stance toward the theme, never a verdict on the choice. */
export const THEME_STANCE_LABEL: Record<ThemeStance, string> = {
  reinforce: 'Reinforces the theme',
  contradict: 'Contradicts the theme',
  develop: 'Develops the theme',
  tension: 'Unresolved thematic tension',
};

export type EffectGroup =
  | 'goal'
  | 'relationship'
  | 'knowledge'
  | 'setup'
  | 'payoff'
  | 'state'
  | 'theme'
  | 'behavior'
  | 'empathy';

export const EFFECT_GROUP_LABEL: Record<EffectGroup, string> = {
  goal: 'Current goal',
  relationship: 'Relationship',
  knowledge: 'New knowledge',
  setup: 'Future setup',
  payoff: 'Payoff',
  state: 'Character state',
  theme: 'Theme',
  behavior: 'Behaviour observed',
  empathy: 'Empathy observation',
};

const ORDER = Object.keys(EFFECT_GROUP_LABEL) as EffectGroup[];

/** The story's reading of the play: withheld from blind performers so it can't steer their interpretation. */
const INTERPRETIVE: EffectGroup[] = ['theme', 'behavior', 'empathy'];

/** "+2" / "−1" with a true minus sign. */
/** "Ines Calder" → "Ines", for lines that address the character directly. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** A performer in a blind session (PRD §32): sees only what their character knows. */
export const isBlindViewer = (project: Project, role: Role | undefined): boolean =>
  !!project.redacted && project.settings.blindMode && role === 'performer';

type Names = (id: string) => string;

function describe(e: Effect, name: Names, setupText: (id: string) => string | undefined): [EffectGroup, string] {
  switch (e.type) {
    case 'goal-progress':
      return ['goal', e.delta > 0 ? `Advances ${signed(e.delta)}` : `Set back ${signed(e.delta)}`];
    case 'trust':
      return ['relationship', `Trust ${signed(e.delta)} · ${name(e.from)} → ${name(e.to)}`];
    case 'tension':
      return ['relationship', `Tension ${signed(e.delta)} · ${name(e.a)} ↔ ${name(e.b)}`];
    case 'promise':
      return ['relationship', `Promise · ${name(e.from)} → ${name(e.to)}: ${e.text}`];
    case 'betrayal':
      return ['relationship', `Betrayal · ${name(e.from)} → ${name(e.to)}: ${e.text}`];
    case 'knowledge':
      return ['knowledge', `${name(e.characterId)} knows: ${e.fact}`];
    case 'setup':
      return ['setup', e.text];
    case 'reinforce':
      return ['setup', `Reinforced: ${setupText(e.setupId) ?? e.label}`];
    case 'payoff':
      return ['payoff', e.text];
    case 'resource': {
      const changes = [e.add && `gains ${e.add}`, e.remove && `loses ${e.remove}`].filter(Boolean).join(', ');
      return ['state', `${name(e.characterId)} ${changes}`];
    }
    case 'condition':
      return ['state', `${name(e.characterId)}: ${e.condition}${e.clear ? ' (cleared)' : ''}`];
    case 'reputation':
      return ['state', `${name(e.characterId)}: ${e.text}`];
    case 'theme':
      return ['theme', `${THEME_STANCE_LABEL[e.stance]}: ${e.text}`];
    case 'behavior':
      return ['behavior', `${name(e.characterId)} · ${e.trait}: ${e.text}`];
    case 'empathy':
      return ['empathy', `${name(e.characterId)} · ${EMPATHY_SIGNALS[e.signal]}: ${e.text}`];
  }
}

/** Effects as labelled groups in reading order; `blind` drops the interpretive groups. */
export function groupEffects(
  effects: Effect[],
  name: Names,
  setupText: (id: string) => string | undefined,
  blind: boolean,
): { group: EffectGroup; items: string[] }[] {
  const byGroup = new Map<EffectGroup, string[]>();
  for (const effect of effects) {
    const [group, text] = describe(effect, name, setupText);
    if (blind && INTERPRETIVE.includes(group)) continue;
    const items = byGroup.get(group);
    if (items) items.push(text);
    else byGroup.set(group, [text]);
  }
  return ORDER.flatMap((group) => {
    const items = byGroup.get(group);
    return items ? [{ group, items }] : [];
  });
}
