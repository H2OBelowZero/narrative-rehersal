// Reaction capture (PRD §32 "observed audience reaction", §33): one strip per story event, plus an optional note.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { REACTIONS } from '@shared/structure';
import type { Reaction, ReactionKind } from '@shared/types';

import { Button, Caption, Chip, IconButton, pressedStyle, Sheet, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useProject } from '@/lib/session';
import { alpha, radii, spacing, TOUCH_TARGET, useTheme } from '@/theme';

export const REACTION_KINDS = Object.keys(REACTIONS) as ReactionKind[];

const PILL_HEIGHT = 32;

export interface ReactionStripProps {
  eventId: string;
  reactions: Reaction[];
  /** Opens the note sheet for this event. */
  onNote: (eventId: string) => void;
}

/**
 * Reactions already given, plus one quiet control that opens the full set. Tap an emoji to add or remove yours;
 * counts are everyone's. Closed by default so the story, not six emoji per moment, carries the stage.
 */
export function ReactionStrip({ eventId, reactions, onNote }: ReactionStripProps) {
  const { colors } = useTheme();
  const { me, project, call } = useProject();
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = async (kind: ReactionKind) => {
    setBusy(kind);
    try {
      await call('react', { eventId, kind });
      setOpen(false);
    } catch {
      // call() has already shown the error.
    } finally {
      setBusy(null);
    }
  };

  const nameOf = (id: string) => project?.participants.find((p) => p.id === id)?.name ?? 'Someone';
  const notes = reactions.filter((r) => r.note);
  const shown = open ? REACTION_KINDS : REACTION_KINDS.filter((kind) => reactions.some((r) => r.kind === kind));

  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        {shown.map((kind) => {
          const count = reactions.filter((r) => r.kind === kind).length;
          const mine = reactions.some((r) => r.kind === kind && r.participantId === me?.id);
          const { emoji, label } = REACTIONS[kind];
          return (
            <Pressable
              key={kind}
              onPress={() => void toggle(kind)}
              disabled={busy !== null}
              hitSlop={{ top: (TOUCH_TARGET - PILL_HEIGHT) / 2, bottom: (TOUCH_TARGET - PILL_HEIGHT) / 2 }}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${count}`}
              accessibilityHint={mine ? 'Removes your reaction' : 'Adds your reaction'}
              accessibilityState={{ selected: mine, busy: busy === kind }}
              style={({ pressed }) => [
                styles.pill,
                mine && { backgroundColor: colors.accentSoft, borderColor: alpha(colors.accent, 0.6) },
                pressedStyle(pressed),
              ]}>
              {busy === kind ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Text style={[styles.emoji, !mine && count === 0 && styles.quiet]}>{emoji}</Text>
              )}
              {count > 0 && (
                <Caption strong={mine} tone={mine ? 'accent' : 'secondary'} style={styles.count}>
                  {count}
                </Caption>
              )}
            </Pressable>
          );
        })}
        {open ? (
          <>
            <IconButton
              icon="edit"
              size={15}
              color={colors.textTertiary}
              accessibilityLabel="React with a note"
              onPress={() => {
                setOpen(false);
                onNote(eventId);
              }}
            />
            <IconButton icon="close" size={15} color={colors.textTertiary} accessibilityLabel="Close reactions" onPress={() => setOpen(false)} />
          </>
        ) : (
          <Chip icon="plus" label="React" accessibilityLabel="React to this moment" onPress={() => setOpen(true)} />
        )}
      </View>
      {notes.map((r) => (
        <Caption key={r.id} style={styles.note}>
          {REACTIONS[r.kind].emoji} {nameOf(r.participantId)}: “{r.note}”
        </Caption>
      ))}
    </View>
  );
}

export interface ReactionNoteSheetProps {
  /** The event being reacted to; null hides the sheet. */
  eventId: string | null;
  onClose: () => void;
}

/** Adds one reaction with a short note. Kinds I've already used on this event are disabled (re-sending would remove them). */
export function ReactionNoteSheet({ eventId, onClose }: ReactionNoteSheetProps) {
  const { me, project, call } = useProject();
  const [kind, setKind] = useState<ReactionKind | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const used = new Set(
    (project?.reactions ?? []).filter((r) => r.eventId === eventId && r.participantId === me?.id).map((r) => r.kind),
  );

  const close = () => {
    setKind(null);
    setNote('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!eventId || !kind) return;
    setSaving(true);
    setError(null);
    try {
      await call('react', { eventId, kind, note: note.trim() || undefined });
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={eventId !== null}
      onClose={close}
      title="React with a note"
      footer={
        <Button
          title="Add reaction"
          block
          loading={saving}
          disabled={!kind || used.has(kind)}
          onPress={() => void submit()}
        />
      }>
      <Caption>How did this moment land for you? The crew sees your reaction and note.</Caption>
      <View style={styles.kinds}>
        {REACTION_KINDS.map((k) => (
          <Chip
            key={k}
            label={`${REACTIONS[k].emoji}  ${REACTIONS[k].label}`}
            accessibilityLabel={REACTIONS[k].label}
            selected={kind === k}
            disabled={used.has(k)}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      {used.size > 0 && (
        <Caption tone="tertiary">Dimmed reactions are already yours on this moment. Tap them in the strip to remove them.</Caption>
      )}
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="What struck you?"
        multiline
        maxLength={280}
        error={error}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Drawn at the foot of the event's own paper, inside its padding and aligned with its text.
  wrap: { gap: spacing.xs, marginTop: -spacing.xs },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 40,
    height: PILL_HEIGHT,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  emoji: { fontSize: 16, lineHeight: 20 },
  quiet: { opacity: 0.45 },
  count: { fontVariant: ['tabular-nums'] },
  note: { paddingLeft: spacing.sm, paddingBottom: spacing.sm },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
