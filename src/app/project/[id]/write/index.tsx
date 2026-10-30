// Write Room board: every script in the project pinned as an index card, the coloured revision pages fanned behind
// it. A blank card starts a new script; a compiled draft from the Screenplay Room can be typed up to rewrite.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Participant, Script } from '@shared/types';

import { paperShadow, Stamp } from '@/components/board/paper';
import { BOARD_MAX, useBoard } from '@/components/discover/board-bits';
import { BlindLock, useBlindSession } from '@/components/discover/blind-lock';
import { revisionColor, latestRevision, pageCount, pendingChanges, sceneCount } from '@/components/write/format';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Icon,
  List,
  ListRow,
  Screen,
  Section,
  Sheet,
  TextField,
} from '@/components/ui';
import { errorMessage, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, palettes, spacing, useTheme } from '@/theme';

const CARD_WIDE = 300;
const ink = palettes.paper;

export default function WriteBoard() {
  const { project, projectId, refresh, can, call } = useProject();
  const blind = useBlindSession();
  const { wide } = useBoard();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  if (!project) return null;

  if (blind) {
    return (
      <Screen onRefresh={refresh}>
        <BlindLock />
      </Screen>
    );
  }

  const open = (scriptId: string) => router.push({ pathname: '/project/[id]/write/[scriptId]', params: { id: projectId, scriptId } });
  const editable = can('editModel');
  const q = query.trim().toLowerCase();
  const scripts = [...project.scripts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.elements.some((e) => e.text.toLowerCase().includes(q)));
  const drafts = [...project.screenplays].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const typeUp = async (draftId: string, title: string) => {
    setTyping(draftId);
    try {
      const before = new Set(project.scripts.map((s) => s.id));
      const next = await call('createScript', { title, fromDraftId: draftId });
      const made = next.scripts.find((s) => !before.has(s.id));
      if (made) open(made.id);
    } catch {
      // Toasted.
    } finally {
      setTyping(null);
    }
  };

  const total = project.scripts.length;
  return (
    <Screen onRefresh={refresh} contentStyle={wide ? { maxWidth: BOARD_MAX } : undefined}>
      <Section title="Scripts" note={`${total} ${total === 1 ? 'script' : 'scripts'}`}>
        <View style={[styles.tools, wide && styles.toolsWide]}>
          {total > 0 && (
            <TextField
              label="Find a script"
              value={query}
              onChangeText={setQuery}
              placeholder="Title or a line from the pages"
              returnKeyType="search"
              autoCorrect={false}
              style={wide ? styles.search : undefined}
            />
          )}
          {editable && <Button title="New script" icon="plus" onPress={() => setCreating(true)} style={wide ? styles.newWide : undefined} block={!wide} />}
        </View>
        {total === 0 ? (
          <EmptyState
            icon="edit"
            title="No scripts yet"
            message={
              editable
                ? 'Start a blank script, or type up a draft the Screenplay Room compiled from rehearsal and rewrite it here.'
                : 'Writers, producers, directors and the owner start scripts here. You can read them and leave notes.'
            }
            action={editable ? { label: 'New script', icon: 'plus', onPress: () => setCreating(true) } : undefined}
          />
        ) : scripts.length === 0 ? (
          <Caption>Nothing matches “{query.trim()}”.</Caption>
        ) : (
          <View style={styles.grid}>
            {scripts.map((s) => (
              <ScriptCard key={s.id} script={s} width={wide ? CARD_WIDE : undefined} onOpen={() => open(s.id)} />
            ))}
          </View>
        )}
      </Section>

      {editable && drafts.length > 0 && (
        <Section title="From rehearsal" note="compiled drafts">
          <Caption>Type a compiled draft up as a script to rewrite it with revisions and notes. The draft itself keeps its provenance.</Caption>
          <List>
            {drafts.map((d) => {
              const typed = project.scripts.some((s) => s.fromDraftId === d.id);
              return (
                <ListRow
                  key={d.id}
                  title={`${d.title}, v${d.version}`}
                  subtitle={`${d.elements.length} lines · compiled ${timeAgo(d.createdAt)}${typed ? ' · typed up already' : ''}`}
                  onPress={typing ? undefined : () => void typeUp(d.id, d.title)}
                />
              );
            })}
          </List>
        </Section>
      )}

      <NewScriptSheet visible={creating} onClose={() => setCreating(false)} onCreated={open} />
    </Screen>
  );
}

function ScriptCard({ script, width, onOpen }: { script: Script; width?: number; onOpen: () => void }) {
  const { project } = useProject();
  const rev = latestRevision(script);
  const color = revisionColor(rev?.number ?? 1);
  const pending = pendingChanges(script).length;
  const notes = script.comments.filter((c) => !c.resolved).length;
  const pages = pageCount(script.elements);
  const scenes = sceneCount(script.elements);
  const writers = [...new Set([script.createdBy, ...script.changes.map((c) => c.authorId)])]
    .map((id) => project?.participants.find((p) => p.id === id))
    .filter((p) => !!p)
    .slice(0, 4);
  // Older revisions fanned behind the card, as coloured pages are inserted into a script.
  const behind = (script.revisions.length > 1 ? [rev!.number, rev!.number - 1] : []).map(revisionColor);
  const summary = [
    script.title,
    `${color.name} pages, revision ${rev?.number ?? 1}`,
    `about ${pages} ${pages === 1 ? 'page' : 'pages'}`,
    pending ? `${pending} unrevised changes` : null,
    notes ? `${notes} open notes` : null,
    `updated ${timeAgo(script.updatedAt)}`,
  ];

  return (
    <View style={[styles.cardWrap, width ? { width } : styles.full]}>
      {behind.map((c, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.sheetBehind, paperShadow, { backgroundColor: c.paper, transform: [{ rotate: `${i ? -2.4 : 1.8}deg` }, { translateY: i ? 9 : 5 }] }]}
        />
      ))}
      <Card tilt={script.id} pin={pending ? 'red' : 'brass'} onPress={onOpen} accessibilityLabel={summary.filter(Boolean).join('. ')} style={styles.card}>
        <ScriptFace script={script} color={color} pages={pages} scenes={scenes} pending={pending} notes={notes} writers={writers} />
      </Card>
    </View>
  );
}

function ScriptFace({
  script,
  color,
  pages,
  scenes,
  pending,
  notes,
  writers,
}: {
  script: Script;
  color: { name: string; paper: string };
  pages: number;
  scenes: number;
  pending: number;
  notes: number;
  writers: Participant[];
}) {
  const { colors } = useTheme(); // paper
  const opening = script.elements.find((e) => e.type === 'heading' && e.text.trim())?.text;
  const firstAction = script.elements.find((e) => e.type === 'action' && e.text.trim())?.text;
  return (
    <>
      <View style={styles.face}>
        <Heading numberOfLines={2} style={styles.title}>
          {script.title.toUpperCase()}
        </Heading>
        <View style={styles.stamps}>
          <Stamp label={`${color.name} rev.`} color={colors.text} />
          {pending > 0 && <Stamp label={`${pending} revised`} color={colors.accentText} />}
        </View>
        {/* The first lines of the page, typed small, so a card reads like the script it is. */}
        <View style={[styles.excerpt, { borderColor: colors.separator }]}>
          {opening ? <Text style={[styles.excerptText, styles.excerptHead]} numberOfLines={1}>{opening}</Text> : null}
          {firstAction ? (
            <Text style={styles.excerptText} numberOfLines={3}>
              {firstAction}
            </Text>
          ) : (
            <Text style={[styles.excerptText, { color: colors.textTertiary }]}>{opening ? 'No action yet.' : 'A blank page.'}</Text>
          )}
        </View>
      </View>
      <View style={styles.foot}>
        <Caption tone="tertiary">
          {scenes} {scenes === 1 ? 'scene' : 'scenes'} · ~{pages} {pages === 1 ? 'page' : 'pages'} · {timeAgo(script.updatedAt)}
        </Caption>
        <View style={[styles.seat, { borderTopColor: colors.separator }]}>
          <View style={styles.writers}>
            {writers.map((w) => (
              <Avatar key={w.id} name={w.name} role={w.role} size={24} />
            ))}
          </View>
          {notes > 0 && (
            <View style={styles.noteCount}>
              <Icon name="bookmark" size={14} color={colors.accentText} />
              <Caption tone="accent" strong>
                {notes}
              </Caption>
            </View>
          )}
          <Icon name="arrow-right" size={14} color={colors.textTertiary} />
        </View>
      </View>
    </>
  );
}

function NewScriptSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { project, call } = useProject();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return setError('Give the script a working title.');
    setBusy(true);
    setError(null);
    try {
      const before = new Set(project?.scripts.map((s) => s.id));
      const next = await call('createScript', { title: title.trim() });
      const made = next.scripts.find((s) => !before.has(s.id));
      setTitle('');
      onClose();
      if (made) onCreated(made.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New script" footer={<Button title="Start writing" block size="lg" loading={busy} onPress={submit} />}>
      <TextField
        label="Working title"
        value={title}
        onChangeText={setTitle}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={error}
        placeholder={project?.model.title ? `${project.model.title}` : 'Untitled'}
      />
      <Body>
        The first page opens on a scene heading. Enter starts the line that usually follows; the type strip, or Tab on a keyboard, changes it.
      </Body>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tools: { gap: spacing.md },
  toolsWide: { flexDirection: 'row', alignItems: 'flex-end' },
  search: { flex: 1, maxWidth: 420 },
  newWide: { marginLeft: 'auto' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, paddingTop: spacing.md },
  full: { width: '100%' },
  cardWrap: { paddingTop: spacing.xs },
  sheetBehind: { position: 'absolute', top: spacing.xs, left: 6, right: 6, bottom: 0, borderRadius: 2 },
  card: { minHeight: 236, justifyContent: 'space-between' },
  face: { gap: spacing.sm },
  title: { letterSpacing: 1.2 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  excerpt: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: spacing.sm, gap: spacing.xs, marginTop: spacing.xs },
  excerptText: { fontFamily: fonts.typewriter, fontSize: 12, lineHeight: 17, color: ink.textSecondary },
  excerptHead: { fontFamily: fonts.typewriterBold, color: ink.text },
  foot: { gap: spacing.sm, marginTop: spacing.md },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    minHeight: 34,
  },
  writers: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  noteCount: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
