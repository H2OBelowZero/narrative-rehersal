// The rehearsal moments behind a discovery, setup, theme signal or screenplay line: pinned under the card they
// support and tied to it with string (EvidenceTrail), or on a sheet of paper (useEvidence).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { EventKind, StoryEvent } from '@shared/types';

import { Hand } from '@/components/board/paper';
import { Body, Caption, Card, Eyebrow, Sheet, TierBadge } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, spacing } from '@/theme';

export interface Evidence {
  title: string;
  eventIds: string[];
  /** The event log the ids belong to (the relevant branch's state). */
  events: StoryEvent[];
}

const KIND_LABEL: Record<EventKind, string> = {
  narration: 'Narration',
  action: 'Action',
  resolution: 'Outcome',
  propagation: 'Ripple',
  directive: 'Direction',
  'fresh-news': 'Fresh news',
  'beat-advance': 'Story beat',
  'scene-open': 'Scene opens',
  'scene-close': 'Scene closes',
  note: 'Note',
};

/** Linked moments I can see, and how many the server kept from my seat. */
function findMoments(eventIds: string[], events: StoryEvent[]) {
  const ids = [...new Set(eventIds)];
  const found = ids.map((id) => events.find((e) => e.id === id)).filter((e): e is StoryEvent => e !== undefined);
  return { found, hidden: ids.length - found.length };
}

const hiddenNote = (hidden: number) =>
  hidden === 1 ? '1 linked moment isn’t visible from your seat.' : `${hidden} linked moments aren’t visible from your seat.`;

/** One moment, typed on a slip: what kind, who, the performer's words, what happened, the outcome stamp. */
function Moment({ event: e }: { event: StoryEvent }) {
  const { charName } = useProject();
  return (
    <>
      <Eyebrow>{[KIND_LABEL[e.kind], e.actorId && charName(e.actorId)].filter(Boolean).join(' · ')}</Eyebrow>
      {e.playerInput ? (
        <View style={styles.tight}>
          <Caption strong>Performed</Caption>
          <Body style={styles.quote}>“{e.playerInput}”</Body>
        </View>
      ) : null}
      {e.text && e.text !== e.playerInput ? <Body>{e.text}</Body> : null}
      {e.resolution && (
        <View style={styles.row}>
          <TierBadge tier={e.resolution.tier} />
          <Caption style={styles.grow}>{e.resolution.approachLabel}</Caption>
        </View>
      )}
      <Caption>{timeAgo(e.at)}</Caption>
    </>
  );
}

/**
 * Evidence pinned to the board under the card it supports. The card owns order 0 of `thread`; each moment is
 * pinned after it, so the string runs from the claim down to what backs it.
 */
export function EvidenceTrail({ thread, eventIds, events }: { thread: string; eventIds: string[]; events: StoryEvent[] }) {
  const { found, hidden } = findMoments(eventIds, events);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.trail}>
      {found.map((e, i) => (
        <Card key={e.id} thread={thread} order={i + 1} pin="brass" tilt={e.id} style={styles.slip}>
          <Moment event={e} />
        </Card>
      ))}
      {hidden > 0 && <Hand style={styles.aside}>{hiddenNote(hidden)}</Hand>}
      {found.length === 0 && hidden === 0 && <Hand style={styles.aside}>No rehearsal moments are linked to this.</Hand>}
    </Animated.View>
  );
}

/** `show(evidence)` opens the sheet; render `sheet` once in the calling view. */
export function useEvidence() {
  const [state, setState] = useState<{ evidence: Evidence | null; visible: boolean }>({ evidence: null, visible: false });
  return {
    show: (evidence: Evidence) => setState({ evidence, visible: true }),
    sheet: (
      <EvidenceSheet
        evidence={state.evidence}
        visible={state.visible}
        onClose={() => setState((s) => ({ ...s, visible: false }))}
      />
    ),
  };
}

function EvidenceSheet({ evidence, visible, onClose }: { evidence: Evidence | null; visible: boolean; onClose: () => void }) {
  const { found, hidden } = findMoments(evidence?.eventIds ?? [], evidence?.events ?? []);
  return (
    <Sheet visible={visible} onClose={onClose} title={evidence?.title ?? 'Evidence'}>
      {found.length === 0 && hidden === 0 && <Caption>No rehearsal moments are linked to this.</Caption>}
      {found.map((e) => (
        <Card key={e.id} tone="sunken" style={styles.sheetSlip}>
          <Moment event={e} />
        </Card>
      ))}
      {hidden > 0 && <Caption>{hiddenNote(hidden)}</Caption>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  trail: { gap: spacing.lg, paddingLeft: spacing.xxl, paddingTop: spacing.xs },
  slip: { gap: spacing.sm, paddingBottom: spacing.md },
  aside: { paddingLeft: spacing.xs },
  sheetSlip: { gap: spacing.sm },
  tight: { gap: 2 },
  quote: { fontFamily: fonts.typewriterItalic },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
});
