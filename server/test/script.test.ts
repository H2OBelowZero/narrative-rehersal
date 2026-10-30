import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPatch, foldChange } from '../../shared/script.ts';
import type { ScriptChange, ScriptElement } from '../../shared/types.ts';

const el = (id: string, text = id): ScriptElement => ({ id, type: 'action', text });
const ids = (els: ScriptElement[]) => els.map((e) => e.id);

test('a save keeps another writer’s new line after the line it followed', () => {
  // Server has a, x (added by someone else), b; this client only knew a, b and added c at the end.
  const { elements, changes } = applyPatch([el('a'), el('x'), el('b')], { upsert: [el('c')], remove: [], order: ['a', 'b', 'c'] });
  assert.deepEqual(ids(elements), ['a', 'x', 'b', 'c']);
  assert.deepEqual(changes.map((c) => c.kind), ['added']);
});

test('edits and removals are tracked; untouched lines are not', () => {
  const { elements, changes } = applyPatch([el('a'), el('b'), el('c')], {
    upsert: [el('a', 'A!'), el('c')],
    remove: ['b'],
    order: ['a', 'c'],
  });
  assert.deepEqual(ids(elements), ['a', 'c']);
  assert.deepEqual(changes.map((c) => `${c.kind}:${c.elementId}`).sort(), ['edited:a', 'removed:b']);
});

test('pending changes fold per line and author', () => {
  const base = { type: 'action' as const, authorId: 'p1', at: '' };
  let log: ScriptChange[] = [];
  log = foldChange(log, { ...base, id: '1', elementId: 'a', kind: 'edited', before: 'x', after: 'xy' });
  log = foldChange(log, { ...base, id: '2', elementId: 'a', kind: 'edited', before: 'xy', after: 'xyz' });
  assert.equal(log.length, 1);
  assert.equal(log[0]!.before, 'x');
  log = foldChange(log, { ...base, id: '3', elementId: 'a', kind: 'edited', before: 'xyz', after: 'x' });
  assert.equal(log.length, 0, 'edited back to the original');
  log = foldChange(log, { ...base, id: '4', elementId: 'n', kind: 'added', after: '' });
  log = foldChange(log, { ...base, id: '5', elementId: 'n', kind: 'removed', before: '' });
  assert.equal(log.length, 0, 'added then removed');
});
