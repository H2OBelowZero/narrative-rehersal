import assert from 'node:assert/strict';
import { test } from 'node:test';
import { columns, LINES_PER_PAGE, paginate, placement, printed, wrappedLines } from '../../shared/screenplay-layout.ts';
import type { ScriptElement } from '../../shared/types.ts';

test('standard columns: 60 for action, 40 for dialogue, cue 2.2" into the body', () => {
  assert.equal(columns('action'), 60);
  assert.equal(columns('dialogue'), 40);
  assert.equal(LINES_PER_PAGE, 54);
  assert.ok(Math.abs(placement('character').left - 2.2 / 6) < 1e-9);
});

test('word wrap counts lines like a typewriter', () => {
  assert.equal(wrappedLines('', 10), 1);
  assert.equal(wrappedLines('aaaa bbbb', 9), 1);
  assert.equal(wrappedLines('aaaa bbbbb', 9), 2);
  assert.equal(wrappedLines('x'.repeat(25), 10), 3);
  assert.equal(wrappedLines('well-to-do', 6), 2, 'breaks after hyphens: "well-" / "to-do"');
  assert.equal(wrappedLines('aaa well-to-do', 9), 2, '"aaa well-" then "to-do"');
  assert.equal(printed({ type: 'parenthetical', text: 'beat' }), '(beat)');
});

test('pages break at 54 lines and a scene heading never ends a page', () => {
  let n = 0;
  const el = (type: ScriptElement['type'], text = 'x'): ScriptElement => ({ id: String(n++), type, text });
  // 26 one-line actions = 1 + 25*2 = 51 lines, then a heading that would leave too little room below it.
  const els = [...Array.from({ length: 26 }, () => el('action')), el('heading', 'INT. ROOM - DAY'), el('action', 'x '.repeat(80))];
  const { placed, pages } = paginate(els);
  assert.equal(pages, 2);
  assert.equal(placed.get(els[26]!.id)!.page, 2, 'heading moved to the next page');
  assert.equal(placed.get(els[26]!.id)!.blank, 0, 'no blank line at the top of a page');
});

test('a heading follows its action to the next page when the action alone would not fit', () => {
  let n = 0;
  const el = (type: ScriptElement['type'], text = 'x'): ScriptElement => ({ id: String(n++), type, text });
  // 24 one-line actions use 47 lines; the heading (1 blank + 1) and its 5-line action (1 blank + 5) need 8 more: 55 > 54.
  const els = [...Array.from({ length: 24 }, () => el('action')), el('heading', 'INT. ROOM - DAY'), el('action', 'word '.repeat(55))];
  const { placed } = paginate(els);
  assert.equal(placed.get(els[25]!.id)!.page, 2);
  assert.equal(placed.get(els[24]!.id)!.page, 2, 'the heading is not stranded on page 1');
});
