// Screenplay draft → Fountain plain-text screenplay (https://fountain.io/syntax). Pure: no React Native imports.
import type { ScreenplayDraft, ScreenplayElement } from '@shared/types';

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z0-9 .'’-]+TO:$/;
/** Characters that would make a line parse as something other than action. */
const FORCED_START = /^[.@>~=#!\[]/;
const IN_DIALOGUE: ScreenplayElement['type'][] = ['character', 'parenthetical', 'dialogue'];

/** `*`, `_` and `\` are emphasis/escape markers in Fountain; the draft's text is literal. */
const escape = (text: string) => text.trim().replace(/([\\*_])/g, '\\$1');

function line(el: ScreenplayElement, notes: boolean): string {
  const text = escape(el.text);
  const note = notes && el.provenance ? ` [[${el.provenance.toUpperCase()}]]` : '';
  switch (el.type) {
    case 'heading': {
      const t = text.toUpperCase();
      return HEADING.test(t) ? t : `.${t}`;
    }
    case 'character': {
      const t = text.toUpperCase();
      return /[A-Z]/.test(t) ? t : `@${t}`;
    }
    case 'parenthetical':
      return text.startsWith('(') ? text : `(${text})`;
    case 'dialogue':
      // A blank line would end the dialogue block.
      return text.replace(/\n\s*\n/g, '\n') + note;
    case 'transition': {
      const t = text.toUpperCase();
      return TRANSITION.test(t) ? t : `> ${t}`;
    }
    case 'action': {
      const forced = HEADING.test(text) || FORCED_START.test(text) || TRANSITION.test(text);
      return `${forced ? '!' : ''}${text}${note}`;
    }
  }
}

/** Title page, then elements; with `provenance`, each dialogue/action line carries its provenance as a [[note]]. */
export function toFountain(draft: ScreenplayDraft, { provenance }: { provenance: boolean }): string {
  const out = [`Title: ${draft.title.trim() || 'Untitled'}`, `Draft date: ${draft.createdAt.slice(0, 10)}`];
  if (provenance) {
    out.push(
      'Notes: Provenance in [[notes]]. Dialogue: PERFORMED, RECONSTRUCTED, GENERATED. Action: OBSERVED, DIRECTED, CONNECTIVE.',
    );
  }
  out.push('');
  let prev: ScreenplayElement | undefined;
  for (const el of draft.elements) {
    const continuesBlock = prev && IN_DIALOGUE.includes(prev.type) && (el.type === 'dialogue' || el.type === 'parenthetical');
    if (prev && !continuesBlock) out.push('');
    out.push(line(el, provenance));
    prev = el;
  }
  return `${out.join('\n')}\n`;
}

/** "Undertow: Hero goal sequence 2", v3 → "undertow-hero-goal-sequence-2-v3.fountain". */
export const fountainFilename = (draft: ScreenplayDraft): string =>
  `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screenplay'}-v${draft.version}.fountain`;
