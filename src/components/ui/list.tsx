import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Hand, StickyNote } from '@/components/board/paper';
import { alpha, palettes, spacing, useSurface, useTheme } from '@/theme';

import { Button, pressedStyle } from './button';
import { Card } from './layout';
import { Icon, type IconName } from './icon';
import { Body, Caption } from './text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Avatar, icon or badge on the left. */
  leading?: ReactNode;
  /** Badge or value on the right (before the chevron). */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Defaults to true when pressable (and not a choice). */
  chevron?: boolean;
  /** Makes the row one choice of a set: shows a check when true and announces the selection. */
  selected?: boolean;
  subtitleLines?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** One row of a list; group rows in <List>. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  selected,
  chevron = !!onPress && selected === undefined,
  subtitleLines = 2,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <Body strong numberOfLines={2}>
          {title}
        </Body>
        {subtitle ? <Caption numberOfLines={subtitleLines}>{subtitle}</Caption> : null}
      </View>
      {trailing}
      {selected && <Icon name="check" size={18} color={colors.accentText} />}
      {chevron && <Icon name="chevron-right" size={14} color={colors.textTertiary} />}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: alpha(colors.text, 0.08) }}
      style={({ pressed }) => [styles.row, pressedStyle(pressed), style]}>
      {content}
    </Pressable>
  );
}

/** Grouped rows ruled like an index card; on the board the card itself is pinned. */
export function List({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const onPaper = useSurface() === 'paper';
  const rows = Children.toArray(children);
  const ruled = (
    <View style={onPaper ? style : undefined}>
      {rows.map((row, i) => (
        <Fragment key={isValidElement(row) && row.key !== null ? row.key : i}>
          {i > 0 && <View style={[styles.separator, { backgroundColor: palettes.paper.border }]} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
  if (onPaper) return ruled;
  return (
    <Card tilt={false} style={[styles.listCard, style]}>
      {ruled}
    </Card>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  style?: StyleProp<ViewStyle>;
}

/** An empty board gets a sticky note: what goes here and how to add it. */
export function EmptyState({ icon, title, message, action, style }: EmptyStateProps) {
  const onPaper = useSurface() === 'paper';
  if (!onPaper) {
    return (
      <StickyNote style={[styles.emptyNote, style]}>
        <EmptyBody icon={icon} title={title} message={message} action={action} />
      </StickyNote>
    );
  }
  return <EmptyBody icon={icon} title={title} message={message} action={action} style={style} />;
}

function EmptyBody({ icon, title, message, action, style }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, style]}>
      {icon && (
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name={icon} size={24} color={colors.textSecondary} />
        </View>
      )}
      <Hand size="label" color={colors.text} style={styles.centre}>
        {title}
      </Hand>
      {message ? (
        <Body tone="secondary" style={styles.centre}>
          {message}
        </Body>
      ) : null}
      {action && (
        <Button title={action.label} icon={action.icon} onPress={action.onPress} variant="secondary" style={styles.emptyAction} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  text: { flex: 1, gap: 2 },
  listCard: { paddingHorizontal: 0, paddingLeft: spacing.xs, paddingBottom: spacing.xs, gap: 0 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  emptyNote: { alignSelf: 'center', width: '100%', maxWidth: 360, transform: [{ rotate: '-1deg' }] },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  centre: { textAlign: 'center' },
  emptyAction: { alignSelf: 'center', marginTop: spacing.sm },
});

/** A short term with its mark: what would be a sentence, read at a glance. The full sentence is spoken. */
export function Term({ icon, text, spoken }: { icon: IconName; text: string; spoken: string }) {
  const { colors } = useTheme();
  return (
    <View style={termStyle} accessible accessibilityLabel={spoken}>
      <Icon name={icon} size={14} color={colors.textSecondary} />
      <Caption tone="primary" style={{ flexShrink: 1 }}>
        {text}
      </Caption>
    </View>
  );
}

const termStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 };
