// Write Room typing rules: how each screenplay element sits on the page, what Enter and Tab do, and the industry's
// revision colours. Pure: no React Native components.
import type { Script, ScriptElement, ScriptElementType } from '@shared/types';

import { paginate } from '@shared/screenplay-layout';

import type { IconName } from '@/components/ui';
import { world } from '@/theme';

export const ELEMENT_LABEL: Record<ScriptElementType, string> = {
  heading: 'Scene heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
};

/** What each element is for, shown in the tool bar's tooltip. */
export const ELEMENT_USE: Record<ScriptElementType, string> = {
  heading: 'Where and when: INT./EXT. LOCATION - TIME OF DAY.',
  action: 'What we see, in present tense. Keep blocks to 3–4 lines.',
  character: 'Who speaks, in capitals. Add (V.O.) or (O.S.) if heard, not seen.',
  parenthetical: 'How a line is said, briefly, in lowercase.',
  dialogue: 'What the character says.',
  transition: 'How we leave the scene, flush right: CUT TO:',
  shot: 'A specific camera angle: CLOSE ON, ANGLE ON.',
};

export const ELEMENT_ICON: Record<ScriptElementType, IconName> = {
  heading: 'el-heading',
  action: 'el-action',
  character: 'el-character',
  parenthetical: 'el-parenthetical',
  dialogue: 'el-dialogue',
  transition: 'el-transition',
  shot: 'el-shot',
};

/** Order of the type bar, of Tab cycling, and of the Alt+1–7 shortcuts (as screenwriting software numbers them). */
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

/** "Alt+1" on Windows and Linux, "⌥1" on a Mac. */
export function shortcutLabel(key: string): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
  return mac ? `⌥${key}` : `Alt+${key}`;
}

export const cycleType = (type: ScriptElementType, by = 1): ScriptElementType =>
  ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(type) + by + ELEMENT_ORDER.length) % ELEMENT_ORDER.length]!;

export const newElementId = (): string => `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

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

/** Printed pages at the standard 54 lines a page. */
export const pageCount = (elements: ScriptElement[]) => paginate(elements).pages;

export const sceneCount = (elements: ScriptElement[]) => elements.filter((e) => e.type === 'heading' && e.text.trim()).length;

/** "10:12 pm" in the reader's locale. */
export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "Aug 13 · 10:12 pm". */
export const stampTime = (iso: string) =>
  `${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${clockTime(iso)}`;
