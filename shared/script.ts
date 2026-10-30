// Write Room save merge. Pure: shared by the server (applies saves) and its tests.
// A save is a patch, not a replacement, so two writers on different lines never overwrite each other.
import type { ID, ScriptChange, ScriptElement, ScriptElementType } from './types.ts';

export const SCRIPT_ELEMENT_TYPES: ScriptElementType[] = [
  'heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
];

export interface ScriptPatch {
  /** Elements added or edited since the client's last save. */
  upsert: ScriptElement[];
  /** Ids the client deleted. */
  remove: ID[];
  /** The client's full reading order. */
  order: ID[];
}

type NewChange = Omit<ScriptChange, 'id' | 'authorId' | 'at'>;

/**
 * Applies `patch` to `current`. Order follows the client; elements the client has never seen (another writer's
 * new lines) stay after the line they followed on the server. Returns the merged elements and the tracked changes.
 */
export function applyPatch(current: ScriptElement[], patch: ScriptPatch): { elements: ScriptElement[]; changes: NewChange[] } {
  const byId = new Map(current.map((e) => [e.id, e]));
  const removed = new Set(patch.remove);
  const changes: NewChange[] = [];

  for (const id of removed) {
    const was = byId.get(id);
    if (was) changes.push({ elementId: id, kind: 'removed', type: was.type, before: was.text });
  }

  const next = new Map<ID, ScriptElement>();
  for (const e of current) if (!removed.has(e.id)) next.set(e.id, e);
  for (const raw of patch.upsert) {
    if (removed.has(raw.id) || typeof raw.id !== 'string' || !raw.id) continue;
    const el: ScriptElement = {
      id: raw.id,
      type: SCRIPT_ELEMENT_TYPES.includes(raw.type) ? raw.type : 'action',
      text: typeof raw.text === 'string' ? raw.text.slice(0, 10_000) : '',
    };
    const was = byId.get(el.id);
    if (!was) changes.push({ elementId: el.id, kind: 'added', type: el.type, after: el.text });
    else if (was.text !== el.text || was.type !== el.type) {
      changes.push({ elementId: el.id, kind: 'edited', type: el.type, before: was.text, after: el.text });
    }
    next.set(el.id, el);
  }

  // Client order first, then splice in anything the client didn't know about after its server predecessor.
  const order = patch.order.filter((id, i) => next.has(id) && patch.order.indexOf(id) === i);
  const placed = new Set(order);
  let prev: ID | null = null;
  for (const e of current) {
    if (!next.has(e.id)) continue;
    if (!placed.has(e.id)) {
      const at = prev ? order.indexOf(prev) + 1 : 0;
      order.splice(at, 0, e.id);
      placed.add(e.id);
    }
    prev = e.id;
  }
  for (const id of next.keys()) if (!placed.has(id)) order.push(id); // upserts missing from order

  return { elements: order.map((id) => next.get(id)!), changes };
}

/** Folds a new change into the pending log: one entry per element, so typing a line doesn't log every keystroke. */
export function foldChange(pending: ScriptChange[], change: ScriptChange): ScriptChange[] {
  const i = pending.findIndex((c) => c.revision === undefined && c.elementId === change.elementId && c.authorId === change.authorId);
  if (i < 0) return [...pending, change];
  const prior = pending[i]!;
  // Added then removed before anyone saw a revision: it never happened.
  if (prior.kind === 'added' && change.kind === 'removed') return pending.filter((_, j) => j !== i);
  const merged: ScriptChange = {
    ...change,
    kind: prior.kind === 'added' ? 'added' : change.kind,
    before: prior.kind === 'added' ? undefined : prior.before,
  };
  // Edited back to what it was: drop it.
  if (merged.kind === 'edited' && merged.before === merged.after) return pending.filter((_, j) => j !== i);
  return pending.map((c, j) => (j === i ? merged : c));
}
