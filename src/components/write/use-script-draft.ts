// The working copy of one script on this device: edits apply locally at once and are saved as patches about a
// second after typing stops. Another writer's saves are taken in whenever this copy has nothing unsaved.
import { useEffect, useRef, useState } from 'react';

import type { Script, ScriptElement } from '@shared/types';

import { useProject } from '@/lib/session';

const SAVE_DELAY_MS = 1000;

interface Pending {
  upsert: Set<string>;
  remove: Set<string>;
  order: boolean;
  title: boolean;
}

const nothing = (): Pending => ({ upsert: new Set(), remove: new Set(), order: false, title: false });
const isEmpty = (p: Pending) => !p.upsert.size && !p.remove.size && !p.order && !p.title;

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

export function useScriptDraft(script: Script) {
  const { call } = useProject();
  const [elements, setElements] = useState<ScriptElement[]>(script.elements);
  const [title, setTitleState] = useState(script.title);
  const [pending, setPending] = useState<Pending>(nothing);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(script.version);

  // Someone (or our own last save) moved the server copy on: adopt it while nothing here is unsaved.
  if (script.version !== seen && !saving && isEmpty(pending)) {
    setSeen(script.version);
    setElements(script.elements);
    setTitleState(script.title);
  }

  const send = async (p: Pending, els: ScriptElement[], t: string) => {
    setSaving(true);
    setPending(nothing());
    try {
      await call('saveScript', {
        scriptId: script.id,
        ...(p.title && t.trim() && { title: t.trim() }),
        patch: { upsert: els.filter((e) => p.upsert.has(e.id)), remove: [...p.remove], order: els.map((e) => e.id) },
      });
      setFailed(false);
    } catch {
      // Put the unsaved work back; the next edit or a retry sends it again.
      setPending((now) => ({
        upsert: new Set([...p.upsert, ...now.upsert]),
        remove: new Set([...p.remove, ...now.remove]),
        order: p.order || now.order,
        title: p.title || now.title,
      }));
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  // Latest state for the unmount flush.
  const latest = useRef({ pending, elements, title, send });
  useEffect(() => {
    latest.current = { pending, elements, title, send };
  });
  useEffect(
    () => () => {
      const l = latest.current;
      if (!isEmpty(l.pending)) void l.send(l.pending, l.elements, l.title);
    },
    [],
  );

  useEffect(() => {
    if (saving || failed || isEmpty(pending)) return;
    const timer = setTimeout(() => void send(pending, elements, title), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send is recreated each render; the state it reads is listed
  }, [pending, elements, title, saving, failed]);

  /** Replaces the element list; `touched` were added or edited, `removed` deleted. */
  const edit = (next: ScriptElement[], touched: string[], removed: string[] = [], reordered = false) => {
    setElements(next);
    setFailed(false);
    setPending((p) => {
      const upsert = new Set(p.upsert);
      const remove = new Set(p.remove);
      for (const id of touched) upsert.add(id);
      for (const id of removed) {
        upsert.delete(id);
        remove.add(id);
      }
      return { upsert, remove, order: p.order || reordered || touched.length > 0 || removed.length > 0, title: p.title };
    });
  };

  const setTitle = (t: string) => {
    setTitleState(t);
    setFailed(false);
    setPending((p) => ({ ...p, title: true }));
  };

  const state: SaveState = saving ? 'saving' : failed ? 'failed' : isEmpty(pending) ? 'saved' : 'unsaved';
  return { elements, title, edit, setTitle, state, retry: () => void send(pending, elements, title) };
}
