// Beside the page (in a sheet on phones): the revision history in the industry's page colours, the changes made
// since the last revision and by whom, and the notes left on lines.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Participant, Script, ScriptChange } from '@shared/types';

import { Stamp } from '@/components/board/paper';
import { Avatar, Body, Button, Caption, Eyebrow, Heading, SegmentedControl, TextField, confirm, pressedStyle } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, palettes, radii, spacing } from '@/theme';

import { ELEMENT_LABEL, latestRevision, pendingChanges, revisionColor, stampTime } from './format';

export type PanelTab = 'revisions' | 'changes' | 'notes';
const TABS = [
  { value: 'revisions', label: 'Revisions' },
  { value: 'changes', label: 'Changes' },
  { value: 'notes', label: 'Notes' },
] as const;

const ink = palettes.paper;

export interface ScriptPanelProps {
  script: Script;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  /** The line a new note will be pinned to. */
  anchorId: string | null;
  onClearAnchor: () => void;
  /** Moves the caret to a line on the page. */
  onJump: (elementId: string) => void;
  /** Unsaved typing must reach the server before a revision snapshots it. */
  saved: boolean;
}

export function ScriptPanel({ script, tab, onTab, anchorId, onClearAnchor, onJump, saved }: ScriptPanelProps) {
  const pending = pendingChanges(script);
  const open = script.comments.filter((c) => !c.resolved).length;
  const label = (t: PanelTab) => {
    const base = TABS.find((x) => x.value === t)!.label;
    if (t === 'changes' && pending.length) return `${base} ${pending.length}`;
    if (t === 'notes' && open) return `${base} ${open}`;
    return base;
  };
  return (
    <View style={styles.panel}>
      <SegmentedControl
        options={TABS.map((t) => ({ value: t.value, label: label(t.value) }))}
        value={tab}
        onChange={onTab}
        accessibilityLabel="Script panel"
      />
      {tab === 'revisions' && <Revisions script={script} saved={saved} />}
      {tab === 'changes' && <Changes script={script} onJump={onJump} />}
      {tab === 'notes' && <Notes script={script} anchorId={anchorId} onClearAnchor={onClearAnchor} onJump={onJump} />}
    </View>
  );
}

function usePeople() {
  const { project } = useProject();
  return (id: string): Participant | undefined => project?.participants.find((p) => p.id === id);
}

// ───────── Revisions ─────────

function Revisions({ script, saved }: { script: Script; saved: boolean }) {
  const { call, can, me, projectId } = useProject();
  const person = usePeople();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const editable = can('editModel');
  const pending = pendingChanges(script).length;
  const next = revisionColor((latestRevision(script)?.number ?? 0) + 1);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      // Toasted by the project call.
    } finally {
      setBusy(null);
    }
  };

  const snapshot = () =>
    run('save', async () => {
      await call('saveRevision', { scriptId: script.id, name: name.trim() || `${next.name} revision`, note: note.trim() });
      setName('');
      setNote('');
    });

  const restore = async (n: number) => {
    const c = revisionColor(n);
    const ok = await confirm(`Restore the ${c.name} pages?`, 'The working copy goes back to this revision. Every line it changes is tracked, so nothing is lost.', {
      confirmLabel: 'Restore',
    });
    if (ok) await run(`restore-${n}`, () => call('restoreRevision', { scriptId: script.id, number: n }));
  };

  const remove = async () => {
    const ok = await confirm(`Delete “${script.title}”?`, 'The script, its revisions and its notes are removed for everyone.', {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await run('delete', async () => {
      await call('deleteScript', { scriptId: script.id });
      router.dismissTo({ pathname: '/project/[id]/write', params: { id: projectId } });
    });
  };

  return (
    <View style={styles.section}>
      {editable && (
        <View style={styles.group}>
          <Heading>Save the {next.name} revision</Heading>
          <Caption>
            {pending
              ? `Files ${pending} ${pending === 1 ? 'change' : 'changes'} under the new revision and starts the next set of asterisks.`
              : 'Nothing has changed since the last revision.'}
          </Caption>
          <TextField label="Name" value={name} onChangeText={setName} placeholder={`${next.name} revision`} returnKeyType="next" />
          <TextField label="Note" value={note} onChangeText={setNote} multiline placeholder="What this pass did. Optional." />
          <Button
            title={saved ? 'Save revision' : 'Saving your typing…'}
            icon="bookmark"
            block
            disabled={!saved || !pending}
            loading={busy === 'save'}
            onPress={() => void snapshot()}
          />
        </View>
      )}
      <View style={styles.group}>
        <Eyebrow>History</Eyebrow>
        {[...script.revisions].reverse().map((r) => {
          const c = revisionColor(r.number);
          const filed = script.changes.filter((ch) => ch.revision === r.number).length;
          const by = person(r.authorId);
          const latest = r.number === latestRevision(script)?.number;
          return (
            <View key={r.number} style={styles.revision}>
              <View style={[styles.swatch, { backgroundColor: c.paper }]} accessibilityLabel={`${c.name} pages`}>
                <Text style={styles.swatchNo}>v{r.number}</Text>
              </View>
              <View style={styles.grow}>
                <View style={styles.revHead}>
                  <Body strong style={styles.shrink}>
                    {r.name}
                  </Body>
                  {latest && <Stamp label="Current" color={ink.canon.canon} />}
                </View>
                <Caption>
                  {c.name} pages · {by?.name ?? 'A former member'} · {stampTime(r.createdAt)}
                </Caption>
                {r.note ? <Caption tone="primary">{r.note}</Caption> : null}
                {r.number > 1 && <Caption tone="tertiary">{filed ? `${filed} ${filed === 1 ? 'change' : 'changes'} filed` : 'No tracked changes'}</Caption>}
                {editable && !latest && (
                  <Button
                    title="Restore these pages"
                    variant="ghost"
                    size="sm"
                    icon="history"
                    loading={busy === `restore-${r.number}`}
                    onPress={() => void restore(r.number)}
                    style={styles.start}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      {(script.createdBy === me?.id || me?.role === 'owner') && (
        <Button title="Delete script" variant="destructive" size="sm" icon="trash" loading={busy === 'delete'} onPress={() => void remove()} style={styles.start} />
      )}
    </View>
  );
}

// ───────── Changes ─────────

const KIND: Record<ScriptChange['kind'], string> = { added: 'Added', edited: 'Edited', removed: 'Removed' };

function Changes({ script, onJump }: { script: Script; onJump: (id: string) => void }) {
  const person = usePeople();
  const pending = [...pendingChanges(script)].sort((a, b) => b.at.localeCompare(a.at));
  const since = revisionColor(latestRevision(script)?.number ?? 1).name;
  if (!pending.length) {
    return (
      <View style={styles.section}>
        <Heading>No changes since the {since} pages</Heading>
        <Caption>Every line anyone adds, edits or removes shows here with their name, until the next revision is saved.</Caption>
      </View>
    );
  }
  const authors = [...new Set(pending.map((c) => c.authorId))];
  const present = new Set(script.elements.map((e) => e.id));
  return (
    <View style={styles.section}>
      <Caption>
        {pending.length} {pending.length === 1 ? 'change' : 'changes'} since the {since} pages. Revised lines carry an asterisk in the
        margin.
      </Caption>
      {authors.map((authorId) => {
        const who = person(authorId);
        const mine = pending.filter((c) => c.authorId === authorId);
        return (
          <View key={authorId} style={styles.group}>
            <View style={styles.author}>
              <Avatar name={who?.name ?? '?'} role={who?.role} size={28} />
              <Body strong style={styles.grow}>
                {who?.name ?? 'A former member'}
              </Body>
              <Caption tone="tertiary">{mine.length}</Caption>
            </View>
            {mine.map((c) => {
              const live = c.kind !== 'removed' && present.has(c.elementId);
              return (
                <Pressable
                  key={c.id}
                  disabled={!live}
                  onPress={() => onJump(c.elementId)}
                  accessibilityRole={live ? 'button' : 'text'}
                  accessibilityHint={live ? 'Moves to this line' : undefined}
                  style={({ pressed }) => [styles.change, { borderColor: ink.separator }, pressedStyle(pressed)]}>
                  <View style={styles.revHead}>
                    <Stamp label={KIND[c.kind]} color={c.kind === 'removed' ? ink.danger : c.kind === 'added' ? ink.tier.success : ink.accentText} />
                    <Caption tone="tertiary" style={styles.shrink}>
                      {ELEMENT_LABEL[c.type]} · {timeAgo(c.at)}
                    </Caption>
                  </View>
                  {c.before ? (
                    <Text style={[styles.typed, styles.struck]} numberOfLines={3}>
                      {c.before}
                    </Text>
                  ) : null}
                  {c.after ? (
                    <Text style={styles.typed} numberOfLines={3}>
                      {c.after}
                    </Text>
                  ) : c.kind === 'added' ? (
                    <Caption tone="tertiary">An empty line</Caption>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ───────── Notes ─────────

function Notes({
  script,
  anchorId,
  onClearAnchor,
  onJump,
}: {
  script: Script;
  anchorId: string | null;
  onClearAnchor: () => void;
  onJump: (id: string) => void;
}) {
  const { call, can, me } = useProject();
  const person = usePeople();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const anchor = anchorId ? script.elements.find((e) => e.id === anchorId) : undefined;
  const present = new Set(script.elements.map((e) => e.id));
  const notes = [...script.comments].sort((a, b) => b.at.localeCompare(a.at));
  const open = notes.filter((n) => !n.resolved);
  const resolved = notes.filter((n) => n.resolved);

  const add = async () => {
    if (!text.trim()) return;
    setBusy('add');
    try {
      await call('addScriptComment', { scriptId: script.id, text: text.trim(), ...(anchor && { elementId: anchor.id }) });
      setText('');
      onClearAnchor();
    } catch {
      // Toasted; the note stays in the field.
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (commentId: string, value: boolean) => {
    setBusy(commentId);
    try {
      await call('resolveScriptComment', { scriptId: script.id, commentId, resolved: value });
    } catch {
      // Toasted.
    } finally {
      setBusy(null);
    }
  };

  const list = (items: typeof notes) =>
    items.map((n) => {
      const who = person(n.authorId);
      const live = !!n.elementId && present.has(n.elementId);
      const mayResolve = n.authorId === me?.id || can('editModel');
      return (
        <View key={n.id} style={[styles.note, { borderColor: ink.separator }, n.resolved && styles.resolved]}>
          <View style={styles.author}>
            <Avatar name={who?.name ?? '?'} role={who?.role} size={26} />
            <Body strong style={styles.grow} numberOfLines={1}>
              {who?.name ?? 'A former member'}
            </Body>
            <Caption tone="tertiary">{timeAgo(n.at)}</Caption>
          </View>
          {n.quote !== undefined && (
            <Pressable
              disabled={!live}
              onPress={() => n.elementId && onJump(n.elementId)}
              accessibilityRole={live ? 'button' : 'text'}
              accessibilityLabel={`On the line: ${n.quote || 'an empty line'}`}
              accessibilityHint={live ? 'Moves to this line' : 'This line has since been removed'}
              style={({ pressed }) => [styles.quote, { backgroundColor: ink.surfaceAlt }, pressedStyle(pressed)]}>
              <Text style={[styles.typed, !live && styles.struck]} numberOfLines={2}>
                {n.quote || '(empty line)'}
              </Text>
            </Pressable>
          )}
          <Body>{n.text}</Body>
          {mayResolve && (
            <Button
              title={n.resolved ? 'Reopen' : 'Resolve'}
              variant="ghost"
              size="sm"
              icon={n.resolved ? 'refresh' : 'check'}
              loading={busy === n.id}
              onPress={() => void resolve(n.id, !n.resolved)}
              style={styles.start}
            />
          )}
        </View>
      );
    });

  return (
    <View style={styles.section}>
      {can('react') && (
        <View style={styles.group}>
          {anchor ? (
            <View style={[styles.quote, { backgroundColor: ink.surfaceAlt }]}>
              <Caption>On the line</Caption>
              <Text style={styles.typed} numberOfLines={2}>
                {anchor.text || '(empty line)'}
              </Text>
              <Button title="Note on the whole script instead" variant="ghost" size="sm" onPress={onClearAnchor} style={styles.start} />
            </View>
          ) : (
            <Caption>On the whole script. To pin a note to a line, put the caret in it and choose Note on line.</Caption>
          )}
          <TextField label="Note" value={text} onChangeText={setText} multiline placeholder="What should change, and why." />
          <Button title="Add note" icon="send" block disabled={!text.trim()} loading={busy === 'add'} onPress={() => void add()} />
        </View>
      )}
      {open.length ? list(open) : <Caption tone="tertiary">No open notes.</Caption>}
      {resolved.length > 0 && (
        <Button
          title={showResolved ? 'Hide resolved notes' : `Show ${resolved.length} resolved`}
          variant="ghost"
          size="sm"
          onPress={() => setShowResolved((v) => !v)}
          style={styles.start}
        />
      )}
      {showResolved && list(resolved)}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  section: { gap: spacing.lg },
  group: { gap: spacing.sm },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  start: { alignSelf: 'flex-start' },
  revision: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.xs },
  swatch: {
    width: 40,
    height: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ink.border,
  },
  swatchNo: { fontFamily: fonts.typewriterBold, fontSize: 12, color: ink.text },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  change: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  typed: { fontFamily: fonts.typewriter, fontSize: 14, lineHeight: 20, color: ink.text },
  struck: { textDecorationLine: 'line-through', color: ink.textSecondary },
  note: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  resolved: { opacity: 0.7 },
  quote: { padding: spacing.sm, borderRadius: radii.sm, gap: spacing.xxs },
});
