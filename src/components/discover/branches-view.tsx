// Story versioning (PRD §44–45): every major run is a branch card, tied by string to the branch it grew from.
// Promoting one to canon keeps all the others.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { STC_BEATS } from '@shared/structure';
import type { Branch } from '@shared/types';

import { Hand, Pinned } from '@/components/board/paper';
import { Badge, Body, Button, CanonBadge, Caption, Card, confirm, haptics, Heading, Section, showToast } from '@/components/ui';
import { BRANCH_MODE_LABEL, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

import { Ledger, SIDE, useBoard } from './board-bits';
import { BranchCompare } from './branch-compare';
import { ErrorNote, useMutation } from './mutation';
import { NewBranchSheet } from './new-branch-sheet';

/** How far each generation steps in from its parent; the lineage string runs down that gutter. */
const STEP = 22;
const MAX_DEPTH = 4;

/** Parents before children, siblings oldest first: the order the lineage strings are read in. */
function lineage(branches: Branch[]): { branch: Branch; depth: number; children: Branch[] }[] {
  const ids = new Set(branches.map((b) => b.id));
  const byAge = [...branches].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const childrenOf = (id: string) => byAge.filter((b) => b.parentId === id);
  const seen = new Set<string>();
  const out: { branch: Branch; depth: number; children: Branch[] }[] = [];
  const walk = (b: Branch, depth: number) => {
    if (seen.has(b.id)) return;
    seen.add(b.id);
    const children = childrenOf(b.id);
    out.push({ branch: b, depth, children });
    for (const c of children) walk(c, depth + 1);
  };
  for (const root of byAge.filter((b) => !b.parentId || !ids.has(b.parentId))) walk(root, 0);
  return out;
}

/** One end of the string from a parent branch to a child: sits exactly on the card's pin, draws no pin of its own. */
function Knot({ child, end }: { child: string; end: 0 | 1 }) {
  return (
    <Pinned fasten="none" tilt={false} thread={`lineage-${child}`} order={end} style={styles.knot}>
      {null}
    </Pinned>
  );
}

export function BranchesView() {
  const { project, can } = useProject();
  const { wide } = useBoard();
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  if (!project) return null;

  const tree = (
    <Section title="Branches" note={`${project.branches.length} ${project.branches.length === 1 ? 'run' : 'runs'}`}>
      <Hand>Each major run is its own branch. Promoting one to canon never deletes the others.</Hand>
      {can('direct') && (
        <Button
          title="New branch"
          icon="plus"
          variant="secondary"
          onPress={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}
          block={!wide}
        />
      )}
      <View style={styles.tree}>
        {lineage(project.branches).map(({ branch: b, depth, children }) => (
          <View key={b.id} style={{ marginLeft: Math.min(depth, MAX_DEPTH) * STEP }}>
            <BranchCard branch={b} />
            {depth > 0 && <Knot child={b.id} end={1} />}
            {children.map((c) => (
              <Knot key={c.id} child={c.id} end={0} />
            ))}
          </View>
        ))}
      </View>
    </Section>
  );
  const compare = project.branches.length >= 2 ? <BranchCompare branches={project.branches} /> : null;
  const newSheet = <NewBranchSheet key={sheet.key} visible={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} />;

  if (!wide) {
    return (
      <>
        {tree}
        {compare}
        {newSheet}
      </>
    );
  }
  return (
    <View style={styles.wideRow}>
      <View style={styles.main}>{tree}</View>
      {compare ? <View style={{ width: SIDE + spacing.xxxl }}>{compare}</View> : null}
      {newSheet}
    </View>
  );
}

function BranchCard({ branch: b }: { branch: Branch }) {
  const { colors } = useTheme();
  const { project, can, call, charName } = useProject();
  const { busy, run, error } = useMutation();
  if (!project) return null;

  const active = b.id === project.activeBranchId;
  const parent = project.branches.find((p) => p.id === b.parentId);
  const canon = project.branches.find((p) => p.status === 'canon' && p.id !== b.id);
  const o = b.overrides;
  const override =
    b.mode === 'character-reinterpretation' && o?.characterId
      ? `${charName(o.characterId)} now prioritises ${o.priority ?? 'something new'}`
      : b.mode === 'goal-reinterpretation' && o?.goal
        ? `New goal: ${o.goal}`
        : b.mode === 'escalation' && o?.stakeShift
          ? `Stakes raised by ${o.stakeShift}`
          : null;

  const switchTo = () =>
    run('switch', async () => {
      await call('switchBranch', { branchId: b.id });
      showToast(`Now rehearsing in ${b.name}`, 'success');
    });

  const promote = async () => {
    const ok = await confirm(
      `Promote ${b.name} to canon?`,
      `${b.name} becomes the canonical version of the story${canon ? ` and ${canon.name} returns to exploring` : ''}. Nothing is deleted: every branch stays available to revisit and compare.`,
      { confirmLabel: 'Promote' },
    );
    if (!ok) return;
    await run('promote', async () => {
      await call('promoteBranch', { branchId: b.id });
      haptics.success();
      showToast(`${b.name} is now canon`, 'success');
    });
  };

  const meta = can('seeMeta');
  return (
    <Card tone={active ? 'accent' : 'default'} tilt={b.id}>
      <Heading>{b.name}</Heading>
      <View style={styles.stamps}>
        {b.status === 'canon' ? (
          <CanonBadge status="canon" />
        ) : b.status === 'archived' ? (
          <Badge label="Archived" color={colors.textTertiary} />
        ) : (
          <Badge label="Exploring" />
        )}
        {active && <Badge label="Active" color={colors.accentText} />}
      </View>
      <Caption>
        {BRANCH_MODE_LABEL[b.mode]}, created {timeAgo(b.createdAt)}
        {parent ? ` from ${parent.name}` : ''}
      </Caption>
      {b.note ? <Body>{b.note}</Body> : null}
      {override ? <Caption tone="primary">{override}</Caption> : null}

      <Ledger
        rows={[
          { label: 'Moments', value: b.state.events.length },
          ...(meta
            ? [
                { label: 'Current beat', value: STC_BEATS[b.state.beatIndex]?.name ?? 'Not started' },
                { label: 'Hero goal sequences', value: b.state.sequences.length },
              ]
            : []),
        ]}
      />

      {((can('direct') && !active) || (can('promoteCanon') && b.status !== 'canon')) && (
        <View style={styles.actions}>
          {can('direct') && !active && (
            <Button
              title="Switch to this branch"
              icon="arrow-right"
              loading={busy === 'switch'}
              disabled={!!busy}
              onPress={() => void switchTo()}
            />
          )}
          {can('promoteCanon') && b.status !== 'canon' && (
            <Button
              title="Promote to canon"
              icon="promote"
              variant="secondary"
              loading={busy === 'promote'}
              disabled={!!busy}
              onPress={() => void promote()}
            />
          )}
        </View>
      )}
      <ErrorNote message={error('switch') ?? error('promote')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  // Capped so a branch card keeps index-card proportions on a wide board.
  tree: { gap: spacing.xl, paddingTop: spacing.xs, maxWidth: 640 },
  // Same box as the card's own pin anchor (top-left), so the string ends on the pin head.
  knot: { position: 'absolute', top: 0, left: 0, width: 28, height: 24 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  main: { flex: 1, minWidth: 0, gap: spacing.xl },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
