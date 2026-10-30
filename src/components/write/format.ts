// Write Room typing rules: how each screenplay element sits on the page, what Enter and Tab do, and the industry's
// revision colours. Pure: no React Native components.
import type { TextStyle, ViewStyle } from 'react-native';

import type { Script, ScriptElement, ScriptElementType } from '@shared/types';

import { fonts, spacing, world } from '@/theme';

export const ELEMENT_LABEL: Record<ScriptElementType, string> = {
  heading: 'Scene heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
};

/** Order of the type strip, and of Tab cycling. */
export const ELEMENT_ORDER: ScriptElementType[] = ['heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'];

export const PLACEHOLDER: Record<ScriptElementType, string> = {
  heading: 'INT. LOCATION - DAY',
  action: 'What we see.',
  character: 'NAME',
  parenthetical: '(beat)',
  dialogue: 'What they say.',
  transition: 'CUT TO:',
  shot: 'CLOSE ON',
};

/** Typed in capitals, as on a page. */
export const UPPER = new Set<ScriptElementType>(['heading', 'character', 'transition', 'shot']);

/** What Enter starts after each element (the convention screenwriting software follows). */
export const NEXT: Record<ScriptElementType, ScriptElementType> = {
  heading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'character',
  transition: 'heading',
  shot: 'action',
};

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z0-9 .'’-]+TO:$/;

/** An action line that is obviously something else becomes it ("int. kitchen" → heading). */
export function inferType(type: ScriptElementType, text: string): ScriptElementType {
  if (type !== 'action') return type;
  if (HEADING.test(text)) return 'heading';
  if (TRANSITION.test(text.trim())) return 'transition';
  return type;
}

export const cycleType = (type: ScriptElementType, by = 1): ScriptElementType =>
  ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(type) + by + ELEMENT_ORDER.length) % ELEMENT_ORDER.length]!;

export const newElementId = (): string => `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const TEXT: Record<ScriptElementType, TextStyle> = {
  heading: { fontFamily: fonts.typewriterBold },
  action: {},
  character: { textAlign: 'center' },
  parenthetical: {},
  dialogue: {},
  transition: { textAlign: 'right' },
  shot: { fontFamily: fonts.typewriterBold },
};

/** Space above each element, as on a typed page. */
export const GAP: Record<ScriptElementType, number> = {
  heading: spacing.xl,
  action: spacing.md,
  character: spacing.lg,
  parenthetical: 0,
  dialogue: 0,
  transition: spacing.lg,
  shot: spacing.lg,
};

/** Proportional indents keep dialogue readable at phone width and still look like a page on tablets. */
export const INDENT: Partial<Record<ScriptElementType, ViewStyle>> = {
  parenthetical: { marginLeft: '18%', marginRight: '14%' },
  dialogue: { marginLeft: '10%', marginRight: '8%' },
};

// ───────── Revisions ─────────

/** The industry's revision page colours, in order: the first draft is white, then blue, pink, yellow… */
const REVISION_COLORS = [
  { name: 'White', paper: '#F3EEE3' },
  { name: 'Blue', paper: world.note.blue },
  { name: 'Pink', paper: world.note.pink },
  { name: 'Yellow', paper: world.note.yellow },
  { name: 'Green', paper: world.note.green },
  { name: 'Goldenrod', paper: '#DDBE72' },
  { name: 'Buff', paper: '#E3CFA6' },
  { name: 'Salmon', paper: '#E4A88E' },
  { name: 'Cherry', paper: '#D39196' },
] as const;

/** Revision 1 is White; after Cherry the cycle starts again, as productions do ("Double Blue"). */
export function revisionColor(number: number): { name: string; paper: string } {
  const i = Math.max(0, number - 1);
  const c = REVISION_COLORS[i % REVISION_COLORS.length]!;
  return { name: i >= REVISION_COLORS.length ? `Double ${c.name}` : c.name, paper: c.paper };
}

export const latestRevision = (script: Script) => script.revisions.at(-1);
export const pendingChanges = (script: Script) => script.changes.filter((c) => c.revision === undefined);

// ───────── Length ─────────

/** Typed characters per line for each element on a US Letter page in 12pt Courier. */
const WIDTH: Record<ScriptElementType, number> = {
  heading: 60,
  action: 60,
  character: 38,
  parenthetical: 25,
  dialogue: 35,
  transition: 15,
  shot: 60,
};

// ponytail: line-count estimate (55 lines a page), not true pagination; fine for a "~N pages" readout.
export function pageCount(elements: ScriptElement[]): number {
  let lines = 0;
  for (const el of elements) {
    lines += (GAP[el.type] ? 1 : 0) + Math.max(1, Math.ceil(el.text.length / WIDTH[el.type]));
  }
  return Math.max(1, Math.round(lines / 55));
}

export const sceneCount = (elements: ScriptElement[]) => elements.filter((e) => e.type === 'heading' && e.text.trim()).length;

/** "10:12 pm" in the reader's locale. */
export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "Aug 13 · 10:12 pm". */
export const stampTime = (iso: string) =>
  `${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${clockTime(iso)}`;
