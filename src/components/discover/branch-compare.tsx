// Side-by-side comparison of two branches (PRD §44–45). Outcomes are consequences, never a ranking.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { STC_BEATS, TIER_LABEL } from '@shared/structure';
import type { Branch, Tier } from '@shared/types';

import { Body, Caption, Card, Chip, Section } from '@/components/ui';
import { useProject } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

import { branchStats, sharedHistory, trustDifferences } from './compare';

const TIERS: Tier[] = ['critical', 'success', 'complication', 'failure'];
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BranchCompare({ branches }: { branches: Branch[] }) {
  const { project, can, charName } = useProject();
  const active = branches.find((b) => b.id === project?.activeBranchId) ?? branches[0];
  const [aId, setA] = useState(active?.id);
  const [bId, setB] = useState(
    () => (branches.find((b) => b.id === active?.parentId) ?? branches.find((b) => b.id !== active?.id))?.id,
  );
  const a = branches.find((b) => b.id === aId);
  const b = branches.find((x) => x.id === bId);
  if (!project || !a || !b) return null;

  const sa = branchStats(a, project.discoveries);
  const sb = branchStats(b, project.discoveries);
  const shared = sharedHistory(a, b);
  const trust = trustDifferences(a, b);
  const meta = can('seeMeta');
  const text = (label: string, x: string, y: string) => <Row key={label} label={label} a={x} b={y} differs={x !== y} />;

  return (
    <Section title="Compare branches">
      <Card>
        <Picker label="First" branches={branches} value={a.id} other={b.id} onChange={setA} />
        <Picker label="Second" branches={branches} value={b.id} other={a.id} onChange={setB} />
      </Card>

      <Card>
        <Caption>
          {shared
            ? `Both share the first ${plural(shared, 'moment', 'moments')}, then play out differently.`
            : 'These branches share no moments.'}
        </Caption>
        <View style={styles.cells}>
          <Caption strong tone="primary" numberOfLines={1} style={styles.cell}>
            {a.name}
          </Caption>
          <Caption strong tone="primary" numberOfLines={1} style={styles.cell}>
            {b.name}
          </Caption>
        </View>
        {text('Moments played', `${sa.events}`, `${sb.events}`)}
        <Row
          label="Outcomes"
          a={<Outcomes tiers={sa.tiers} />}
          b={<Outcomes tiers={sb.tiers} />}
          differs={TIERS.some((t) => sa.tiers[t] !== sb.tiers[t])}
        />
        {meta &&
          text(
            'Hero goal sequences',
            `${sa.sequences} · ${sa.achieved} achieved`,
            `${sb.sequences} · ${sb.achieved} achieved`,
          )}
        {meta &&
          text(
            'Beats satisfied',
            `${sa.beatsSatisfied} of ${STC_BEATS.length} · at ${STC_BEATS[sa.beatIndex]?.name}`,
            `${sb.beatsSatisfied} of ${STC_BEATS.length} · at ${STC_BEATS[sb.beatIndex]?.name}`,
          )}
        {text(
          'Setups',
          `${sa.setups.open} open · ${plural(sa.setups.candidates, 'payoff candidate', 'payoff candidates')} · ${sa.setups.paidOff} paid off`,
          `${sb.setups.open} open · ${plural(sb.setups.candidates, 'payoff candidate', 'payoff candidates')} · ${sb.setups.paidOff} paid off`,
        )}
        {text(
          'Discoveries',
          `${sa.discoveries.total} · ${sa.discoveries.promoted} promoted`,
          `${sb.discoveries.total} · ${sb.discoveries.promoted} promoted`,
        )}
      </Card>

      <Card>
        <Caption strong tone="primary">
          Trust that ended differently
        </Caption>
        {trust.length === 0 ? (
          <Caption>Every relationship ended with the same trust in both branches.</Caption>
        ) : (
          trust.map(({ relationship: r, a: x, b: y }) => (
            <Row
              key={r.id}
              label={`${charName(r.from)} → ${charName(r.to)} · ${r.label}`}
              a={`Trust ${signed(x)}`}
              b={`Trust ${signed(y)}`}
              differs
            />
          ))
        )}
      </Card>
    </Section>
  );
}

function Picker({
  label,
  branches,
  value,
  other,
  onChange,
}: {
  label: string;
  branches: Branch[];
  value: string;
  other: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.picker}>
      <Caption strong tone="primary">
        {label}
      </Caption>
      <View style={styles.chips}>
        {branches.map((b) => (
          <Chip
            key={b.id}
            label={b.name}
            selected={b.id === value}
            disabled={b.id === other}
            onPress={() => onChange(b.id)}
            accessibilityLabel={`${label} branch: ${b.name}`}
          />
        ))}
      </View>
    </View>
  );
}

function Row({ label, a, b, differs }: { label: string; a: ReactNode; b: ReactNode; differs: boolean }) {
  const { colors } = useTheme();
  const cell = (value: ReactNode) =>
    typeof value === 'string' ? (
      <Body style={styles.cell} strong={differs}>
        {value}
      </Body>
    ) : (
      <View style={styles.cell}>{value}</View>
    );
  return (
    <View style={[styles.row, { borderTopColor: colors.separator }]}>
      <Caption>{label}</Caption>
      <View style={styles.cells}>
        {cell(a)}
        {cell(b)}
      </View>
    </View>
  );
}

function Outcomes({ tiers }: { tiers: Record<Tier, number> }) {
  const { colors } = useTheme();
  const present = TIERS.filter((t) => tiers[t] > 0);
  if (!present.length) return <Body tone="tertiary">No rolls yet</Body>;
  return (
    <View style={styles.outcomes}>
      {present.map((t) => (
        <View key={t} style={styles.outcome}>
          <View style={[styles.dot, { backgroundColor: colors.tier[t] }]} />
          <Caption tone="primary">
            {TIER_LABEL[t]} {tiers[t]}
          </Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: spacing.xs + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  cells: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
  outcomes: { gap: 2 },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
