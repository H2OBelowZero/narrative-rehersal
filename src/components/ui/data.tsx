import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TIER_LABEL } from '@shared/structure';
import type { Odds, Tier } from '@shared/types';

import { radii, spacing, useTheme } from '@/theme';

import { Caption } from './text';

const TIERS: Tier[] = ['critical', 'success', 'complication', 'failure'];
const BAR = 8;

export type MeterProps = { label?: string; style?: StyleProp<ViewStyle> } & (
  | { kind: 'trust'; value: number }
  | { kind: 'divergence'; value: number | null }
);

/** Words, not numbers: divergence describes the room, never a participant. */
export function divergenceWords(value: number | null): string {
  if (value === null) return 'Not enough answers yet';
  if (value < 0.25) return 'Closely aligned';
  if (value < 0.5) return 'Some divergence';
  if (value < 0.75) return 'Divergent readings';
  return 'Widely divergent readings';
}

/**
 * trust: −5..5 bar growing from the centre (warm right for trust, left for distrust).
 * divergence: 0..1 interpretation spread, described in words.
 */
export function Meter(props: MeterProps) {
  const { colors } = useTheme();
  const { label, style } = props;

  if (props.kind === 'trust') {
    const v = Math.max(-5, Math.min(5, Math.round(props.value)));
    const caption = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    return (
      <View
        style={[styles.meter, style]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label ? `${label}: trust ${caption}` : `Trust ${caption}`}
        accessibilityValue={{ min: -5, max: 5, now: v }}>
        {label && <Caption style={styles.label}>{label}</Caption>}
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.centre, { backgroundColor: colors.border }]} />
          <View
            style={[
              styles.fill,
              {
                backgroundColor: v >= 0 ? colors.canon.canon : colors.tier.complication,
                width: `${(Math.abs(v) / 5) * 50}%`,
              },
              v >= 0 ? { left: '50%' } : { right: '50%' },
            ]}
          />
        </View>
        <Caption tone="primary" strong style={styles.value}>
          {caption}
        </Caption>
      </View>
    );
  }

  const words = divergenceWords(props.value);
  return (
    <View
      style={[styles.meter, style]}
      accessible
      accessibilityLabel={label ? `${label}: ${words}` : words}>
      {label && <Caption style={styles.label}>{label}</Caption>}
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        {props.value !== null && (
          <View
            style={[
              styles.fill,
              { left: 0, backgroundColor: colors.textSecondary, width: `${Math.max(0, Math.min(1, props.value)) * 100}%` },
            ]}
          />
        )}
      </View>
      <Caption style={styles.words}>{words}</Caption>
    </View>
  );
}

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Spoken name, e.g. "Goal progress". */
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Progress toward a threshold (goal progress, beats covered). */
export function ProgressBar({ value, max, label, color, style }: ProgressBarProps) {
  const { colors } = useTheme();
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={[styles.track, styles.progress, { backgroundColor: colors.surfaceAlt }, style]}>
      <View style={[styles.fill, { left: 0, width: `${ratio * 100}%`, backgroundColor: color ?? colors.accent }]} />
    </View>
  );
}

export interface OddsBarProps {
  odds: Odds;
  /** Show the tier legend with percentages. Default true. */
  legend?: boolean;
  style?: StyleProp<ViewStyle>;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Stacked chance of each resolution tier. Chance odds, shown plainly. */
export function OddsBar({ odds, legend = true, style }: OddsBarProps) {
  const { colors } = useTheme();
  const summary = TIERS.map((t) => `${TIER_LABEL[t]} ${pct(odds[t])}`).join(', ');
  return (
    <View style={[styles.odds, style]} accessible accessibilityLabel={`Chances: ${summary}`}>
      <View style={[styles.oddsTrack, { backgroundColor: colors.surfaceAlt }]}>
        {TIERS.filter((t) => odds[t] > 0).map((t) => (
          <View key={t} style={{ flex: odds[t], backgroundColor: colors.tier[t] }} />
        ))}
      </View>
      {legend && (
        <View style={styles.legend}>
          {TIERS.map((t) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.tier[t] }]} />
              <Caption>
                {TIER_LABEL[t]} <Caption tone="primary" strong>{pct(odds[t])}</Caption>
              </Caption>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { minWidth: 72 },
  track: { flex: 1, height: BAR, borderRadius: BAR / 2, overflow: 'hidden' },
  progress: { flex: 0, alignSelf: 'stretch' },
  centre: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: BAR / 2 },
  value: { minWidth: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  words: { minWidth: 120 },
  odds: { gap: spacing.sm },
  oddsTrack: { flexDirection: 'row', height: BAR + 2, borderRadius: radii.sm, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
