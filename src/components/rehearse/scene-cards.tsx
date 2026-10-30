// Director-facing situation (PRD §47): the goal with its progress, what is at stake and the observed obstacle.
// Three index cards at the head of the board; the rehearsal's string starts from them.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Caption, Card } from '@/components/ui';
import { useProject } from '@/lib/session';
import { alpha, fonts, spacing, useTheme } from '@/theme';

/** The one thread the rehearsal hangs on: situation, then every event in the order it happened. */
export const FEED = 'feed';

export function SituationCards() {
  const { sequence } = useProject();
  if (!sequence) return null;
  const cards = [
    { key: 'goal', label: 'Goal', body: sequence.goal },
    { key: 'stake', label: 'Stake', body: sequence.stake },
    { key: 'obstacle', label: 'Obstacle', body: sequence.obstacle },
  ].filter((c) => c.body);
  return (
    <View style={styles.stack}>
      {cards.map((c, i) => (
        <Card key={c.key} thread={FEED} order={i} tilt={`${sequence.id}-${c.key}`} style={styles.card}>
          <CardTitle>{c.label}</CardTitle>
          <Body strong={c.key === 'goal'}>{c.body}</Body>
          {c.key === 'goal' && (
            <View style={styles.progress}>
              <GoalSegments progress={sequence.progress} required={sequence.required} style={styles.segmentsWide} />
              <Caption>
                {sequence.progress >= sequence.required ? 'Reached' : `${sequence.progress} of ${sequence.required}`}
              </Caption>
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

/** The typed header of an index card ("GOAL", "A. ASK MARA DIRECTLY"). Render inside paper. */
export function CardTitle({ children, lines }: { children: string; lines?: number }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" numberOfLines={lines} maxFontSizeMultiplier={1.6} style={[styles.title, { color: colors.text }]}>
      {children.toUpperCase()}
    </Text>
  );
}

/** Goal progress as quiet segments, one per step needed. */
export function GoalSegments({
  progress,
  required,
  style,
}: {
  progress: number;
  required: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const filled = Math.min(progress, required);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Goal progress"
      accessibilityValue={{ min: 0, max: required, now: filled }}
      style={[styles.segments, style]}>
      {Array.from({ length: required }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, { backgroundColor: i < filled ? colors.accentText : alpha(colors.text, 0.14) }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  card: { gap: spacing.sm, paddingBottom: spacing.md },
  title: { fontFamily: fonts.typewriterBold, fontSize: 13, lineHeight: 18, letterSpacing: 1.1 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segmentsWide: { width: 96 },
  segments: { flexDirection: 'row', gap: 3, minWidth: 40 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
});
