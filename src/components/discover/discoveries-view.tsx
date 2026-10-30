// Discovery Room (PRD §29–31, §53–54) as a planning board: the north-star tally typed on a card, each discovery a
// sticky note coloured and stamped by kind, and the setup/payoff and theme trackers pinned alongside.
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Discovery, DiscoveryKind, Project } from '@shared/types';

import { fillImage, materials } from '@/components/board/materials';
import { Hand, paperShadow, tiltFor, type NoteColor } from '@/components/board/paper';
import { Pin } from '@/components/board/string-board';
import { Button, Caption, Card, EmptyState, haptics, Heading, pressedStyle, showToast } from '@/components/ui';
import { DISCOVERY_KIND_LABEL } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, palettes, spacing, TOUCH_TARGET, world } from '@/theme';

import { SIDE, useBoard } from './board-bits';
import { DiscoveryCard, KIND_NOTE } from './discovery-card';
import { useEvidence } from './evidence';
import { ErrorNote, useMutation } from './mutation';
import { SetupPayoffTracker, ThemeAlignment } from './trackers';

const KINDS = Object.keys(DISCOVERY_KIND_LABEL) as DiscoveryKind[];
/** Narrowest a note column gets before the board drops a column. */
const NOTE_MIN = 360;

/** Emerged and taken seriously (PRD §54): being considered or promoted. */
const isMeaningful = (d: Discovery) => d.status === 'considering' || d.status === 'promoted';

export function DiscoveriesView() {
  const { project, sim, can } = useProject();
  const { wide, inner } = useBoard();
  const [kind, setKind] = useState<DiscoveryKind | 'all'>('all');
  const evidence = useEvidence();
  if (!project || !sim) return null;

  const discoveries = [...project.discoveries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const kinds = KINDS.filter((k) => discoveries.some((d) => d.kind === k));
  const shown = kind === 'all' ? discoveries : discoveries.filter((d) => d.kind === kind);
  const eventsOf = (d: Discovery) =>
    (project.branches.find((b) => b.id === d.branchId) ?? project.branches[0])?.state.events ?? [];

  const trackers = can('analyze');
  const main = wide && trackers ? inner - SIDE - spacing.xl : inner;
  const columns = wide ? Math.max(1, Math.min(3, Math.floor((main + spacing.xl) / (NOTE_MIN + spacing.xl)))) : 1;

  const board =
    discoveries.length === 0 ? (
      <EmptyState
        icon="discover"
        title="No discoveries yet"
        message={
          can('analyze')
            ? 'Rehearse a few moments, then analyze the run to surface what emerged that nobody planned.'
            : 'They appear here once the team analyzes a rehearsal.'
        }
      />
    ) : (
      <View style={styles.list}>
        {kinds.length > 1 && (
          <View style={styles.tabs} accessibilityLabel="Filter by kind">
            <KindTab label="All" count={discoveries.length} selected={kind === 'all'} onPress={() => setKind('all')} />
            {kinds.map((k) => (
              <KindTab
                key={k}
                label={DISCOVERY_KIND_LABEL[k]}
                color={KIND_NOTE[k]}
                count={discoveries.filter((d) => d.kind === k).length}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </View>
        )}
        <View style={styles.columns}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={styles.column}>
              {shown
                .filter((_, i) => i % columns === c)
                .map((d) => (
                  <DiscoveryCard key={d.id} discovery={d} events={eventsOf(d)} />
                ))}
            </View>
          ))}
        </View>
        {shown.length === 0 && <Hand>Nothing of this kind yet.</Hand>}
      </View>
    );

  const side = trackers ? (
    <>
      <SetupPayoffTracker sim={sim} onEvidence={evidence.show} />
      <ThemeAlignment sim={sim} theme={project.model.theme} onEvidence={evidence.show} />
    </>
  ) : null;

  if (!wide) {
    return (
      <>
        <NorthStar project={project} />
        {board}
        {side}
        {evidence.sheet}
      </>
    );
  }
  return (
    <View style={styles.wideRow}>
      <View style={styles.main}>
        <NorthStar project={project} wide />
        {board}
      </View>
      {side ? <View style={[styles.side, { width: SIDE }]}>{side}</View> : null}
      {evidence.sheet}
    </View>
  );
}

/** North-star metric (PRD §54): a count of discoveries, never a score. Typed on the card that heads the board. */
function NorthStar({ project, wide = false }: { project: Project; wide?: boolean }) {
  const { can, call, branch } = useProject();
  const { busy, run, error } = useMutation();
  const meaningful = project.discoveries.filter(isMeaningful);
  const session = project.activeSessionId;
  const thisSession = session ? meaningful.filter((d) => d.sessionId === session).length : null;

  const analyze = () =>
    run('analyze', async () => {
      const before = project.discoveries.length;
      const next = await call('analyzeDiscoveries', {});
      const found = next.discoveries.length - before;
      showToast(
        found ? `${found} new ${found === 1 ? 'discovery' : 'discoveries'} to review` : 'Nothing new stood out in this run yet',
        found ? 'success' : 'info',
      );
    });

  return (
    <Card tone="accent" tilt={false}>
      <View style={wide ? styles.northWide : styles.northStack}>
        <View style={[styles.northText, wide && styles.grow]}>
          <Heading>
            {thisSession === null ? 'No session running' : `${thisSession} meaningful ${thisSession === 1 ? 'discovery' : 'discoveries'} this session`}
          </Heading>
          <Caption>
            {meaningful.length} across the project so far, counted when the team is considering a discovery or has
            promoted it.
          </Caption>
        </View>
        {can('analyze') && (
          <View style={[styles.tight, wide && styles.northAction]}>
            <Button
              title={busy ? 'Analyzing…' : 'Analyze this run'}
              icon="search"
              loading={!!busy}
              onPress={() => void analyze()}
              block
              accessibilityHint={branch ? `Looks for what emerged in ${branch.name}` : undefined}
            />
            <ErrorNote message={error('analyze')} />
          </View>
        )}
      </View>
    </Card>
  );
}

/** A filter tag in the note's own colour, typed with its kind and count. The one in use is pinned. */
function KindTab({
  label,
  count,
  color,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  color?: NoteColor;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (selected) return;
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tabHit, pressedStyle(pressed && !selected)]}>
      <View
        style={[
          styles.tag,
          paperShadow,
          { backgroundColor: color ? world.note[color] : palettes.paper.bg },
          { transform: [{ rotate: `${tiltFor(label, 1.6).toFixed(2)}deg` }, { translateY: selected ? -2 : 0 }] },
        ]}>
        {!color && <Image source={materials.paper} resizeMode="cover" style={fillImage} accessible={false} />}
        <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.tagText}>
          {label.toUpperCase()} <Text style={styles.tagCount}>{count}</Text>
        </Text>
        {selected && <View style={styles.tagMark} />}
      </View>
      {selected && <Pin kind="red" size={18} style={styles.tagPin} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  tabHit: { minHeight: TOUCH_TARGET + 4, paddingTop: spacing.sm, justifyContent: 'flex-end' },
  tag: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm, borderRadius: 1, overflow: 'hidden' },
  tagText: { fontFamily: fonts.typewriterBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: palettes.paper.text },
  tagCount: { fontFamily: fonts.typewriter },
  tagMark: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 4, height: 2, backgroundColor: palettes.paper.text },
  tagPin: { position: 'absolute', top: 0, alignSelf: 'center' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  column: { flex: 1, minWidth: 0, gap: spacing.xl + spacing.xs },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  main: { flex: 1, minWidth: 0, gap: spacing.xl },
  side: { gap: spacing.xl },
  northStack: { gap: spacing.md },
  northWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  northText: { gap: spacing.sm },
  northAction: { width: 240 },
  tally: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tallyValue: { fontSize: 44, lineHeight: 48, fontVariant: ['tabular-nums'] },
  grow: { flex: 1 },
  tight: { gap: spacing.xs },
});
