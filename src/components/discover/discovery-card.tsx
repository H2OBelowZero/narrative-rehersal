// One discovery (PRD §31) as a sticky note on the planning board: what was observed, how it might be read, and
// the team's decision. Its evidence pins below it on the same string. Discovery is not canon: only the Project
// Owner promotes.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Discovery, DiscoveryKind, StoryEvent } from '@shared/types';

import { Pinned, StickyNote, type NoteColor } from '@/components/board/paper';
import { Badge, Body, Button, CanonBadge, Caption, Card, Chip, confirm, Eyebrow, haptics, Heading, showToast } from '@/components/ui';
import { DISCOVERY_KIND_LABEL, DISCOVERY_STATUS_LABEL, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { radii, spacing, useTheme, type Palette } from '@/theme';

import { EvidenceTrail } from './evidence';
import { ErrorNote, useMutation } from './mutation';

/** Planning-board colours by kind. The kind is always stamped on the note as well: never colour alone. */
export const KIND_NOTE: Record<DiscoveryKind, NoteColor> = {
  story: 'yellow',
  structure: 'yellow',
  'setup-payoff': 'yellow',
  character: 'pink',
  empathy: 'pink',
  relationship: 'blue',
  divergence: 'blue',
  theme: 'green',
};

type Decision = 'considering' | 'promoted' | 'rejected';

const DECIDED: Record<Decision, string> = {
  considering: 'Taken into consideration by',
  promoted: 'Promoted by',
  rejected: 'Rejected by',
};

const statusColor = (colors: Palette, status: Discovery['status']) =>
  ({
    new: colors.accentText,
    considering: colors.textSecondary,
    promoted: colors.canon.canon,
    rejected: colors.canon.rejected,
  })[status];

const moments = (n: number) => `${n} ${n === 1 ? 'moment' : 'moments'}`;

export function DiscoveryCard({ discovery: d, events }: { discovery: Discovery; events: StoryEvent[] }) {
  const { colors } = useTheme();
  const { project, can, call, charName } = useProject();
  const { busy, run, error } = useMutation();
  const [choice, setChoice] = useState(d.resolution && d.options.includes(d.resolution) ? d.resolution : undefined);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  if (!project) return null;

  const promoted = d.status === 'promoted';
  const canDecide = can('analyze') && !promoted;
  const branchName = project.branches.find((b) => b.id === d.branchId)?.name;
  const decidedBy = project.participants.find((p) => p.id === d.decidedBy)?.name;
  const thread = `evidence-${d.id}`;
  const evidence = d.evidenceEventIds.length;

  const decide = (decision: Decision) =>
    run(decision, async () => {
      await call('decideDiscovery', { discoveryId: d.id, decision, ...(choice && { resolution: choice }) });
      if (decision === 'promoted') {
        haptics.success();
        showToast('Promoted to canon', 'success');
      }
    });

  const promote = async () => {
    const trait = d.characterId && d.observed ? ` and "${d.observed}" becomes an emergent trait of ${charName(d.characterId)}` : '';
    const ok = await confirm(
      'Promote to canon?',
      `"${d.interpretation ?? d.observation}" becomes a canon fact${trait}. A promoted discovery can’t be decided again.`,
      { confirmLabel: 'Promote' },
    );
    if (ok) await decide('promoted');
  };

  return (
    <View>
      <Pinned thread={thread} order={0} tilt={d.id}>
        <StickyNote color={KIND_NOTE[d.kind]} style={styles.note}>
          <View style={styles.stamps}>
            <Badge label={DISCOVERY_KIND_LABEL[d.kind]} color={colors.text} />
            <Badge label={DISCOVERY_STATUS_LABEL[d.status]} color={statusColor(colors, d.status)} strike={d.status === 'rejected'} />
          </View>
          <View style={styles.tight}>
            <Heading>{d.title}</Heading>
            <Caption>
              {[
                d.characterId && charName(d.characterId),
                d.branchId !== project.activeBranchId && branchName && `in ${branchName}`,
                `found ${timeAgo(d.createdAt)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
          </View>
          <Body>{d.observation}</Body>

          {(d.declared || d.observed) && (
            <View style={styles.compare}>
              <Field label="Declared" value={d.declared} />
              <View style={styles.divider} />
              <Field label="Observed" value={d.observed} />
            </View>
          )}

          {d.interpretation ? (
            <View style={styles.tight}>
              <Eyebrow>Possible interpretation</Eyebrow>
              <Body>{d.interpretation}</Body>
            </View>
          ) : null}

          {(d.directorQuestion || d.options.length > 0) && (
            <View style={styles.tight}>
              {d.directorQuestion ? (
                <Body>
                  Director asks: <Body strong>{d.directorQuestion}</Body>
                </Body>
              ) : null}
              {d.options.length > 0 && (
                <View style={styles.chips} accessibilityRole={canDecide ? 'radiogroup' : undefined}>
                  {d.options.map((o) => (
                    <Chip
                      key={o}
                      label={o}
                      selected={(canDecide ? choice : d.resolution) === o}
                      onPress={canDecide ? () => setChoice((c) => (c === o ? undefined : o)) : undefined}
                    />
                  ))}
                </View>
              )}
              {canDecide && d.options.length > 0 && <Caption>Your choice is recorded with the decision.</Caption>}
            </View>
          )}
          {d.resolution && !d.options.includes(d.resolution) ? <Caption>Resolution: {d.resolution}</Caption> : null}

          {evidence > 0 && (
            <Button
              title={evidenceOpen ? 'Hide evidence' : `Follow the evidence (${moments(evidence)})`}
              icon={evidenceOpen ? 'close' : 'link'}
              variant="secondary"
              size="sm"
              onPress={() => setEvidenceOpen((o) => !o)}
              accessibilityHint={evidenceOpen ? undefined : 'Pins the rehearsal moments behind this discovery below it'}
            />
          )}

          {promoted && <WhatChanged discovery={d} />}
          {decidedBy && d.status !== 'new' ? (
            <Caption>
              {DECIDED[d.status]} {decidedBy}
            </Caption>
          ) : null}

          {canDecide && (
            <View style={styles.tight}>
              <View style={styles.actions}>
                {can('promoteCanon') && (
                  <Button
                    title="Promote to canon"
                    icon="promote"
                    size="sm"
                    loading={busy === 'promoted'}
                    disabled={!!busy}
                    onPress={promote}
                  />
                )}
                {d.status !== 'considering' && (
                  <Button
                    title={d.status === 'rejected' ? 'Reconsider' : 'Consider'}
                    variant="secondary"
                    size="sm"
                    loading={busy === 'considering'}
                    disabled={!!busy}
                    onPress={() => void decide('considering')}
                  />
                )}
                {d.status !== 'rejected' && (
                  <Button
                    title="Reject"
                    variant="secondary"
                    size="sm"
                    loading={busy === 'rejected'}
                    disabled={!!busy}
                    onPress={() => void decide('rejected')}
                  />
                )}
              </View>
              {!can('promoteCanon') && <Caption>Only the Project Owner promotes to canon.</Caption>}
              <ErrorNote message={error('promoted') ?? error('considering') ?? error('rejected')} />
            </View>
          )}
        </StickyNote>
      </Pinned>
      {evidenceOpen && <EvidenceTrail thread={thread} eventIds={d.evidenceEventIds} events={events} />}
    </View>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.field} accessible accessibilityLabel={`${label}: ${value || 'not stated'}`}>
      <Eyebrow>{label}</Eyebrow>
      <Body strong={!!value} tone={value ? 'primary' : 'secondary'}>
        {value || 'Not stated'}
      </Body>
    </View>
  );
}

/** The canon fact and emergent trait the server wrote when this discovery was promoted. */
function WhatChanged({ discovery: d }: { discovery: Discovery }) {
  const { project, character } = useProject();
  const fact = project?.model.canon.find((c) => c.discoveryId === d.id);
  const who = character(d.characterId);
  const trait = who?.intrinsic.find((t) => t.source === 'emergent' && t.label === d.observed);
  return (
    <Card tone="sunken" style={styles.changed}>
      <Eyebrow>What changed</Eyebrow>
      {trait && who && (
        <View style={styles.changeRow}>
          <Body style={styles.grow}>
            Emergent trait for {who.name}: <Body strong>{trait.label}</Body>
          </Body>
          <CanonBadge status={trait.status} />
        </View>
      )}
      {fact && (
        <View style={styles.changeRow}>
          <Body style={styles.grow}>
            Canon fact: <Body strong>{fact.text}</Body>
          </Body>
          <CanonBadge status={fact.status} />
        </View>
      )}
      {!trait && !fact && <Caption>Promoted to canon.</Caption>}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Wide left margin: the evidence string runs down the note's edge, clear of the typing.
  note: { paddingLeft: spacing.xl + 2, gap: spacing.md },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  tight: { gap: spacing.xs + 2 },
  grow: { flex: 1 },
  compare: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(255, 250, 238, 0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(36, 30, 23, 0.28)',
  },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(36, 30, 23, 0.28)' },
  field: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  changed: { gap: spacing.sm, padding: spacing.md },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
