import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, Eyebrow, Icon, pressedStyle } from '@/components/ui';
import { alpha, spacing, TOUCH_TARGET, useTheme } from '@/theme';

export interface DisclosureProps {
  title: string;
  /** One line shown under the title while collapsed. */
  summary?: string;
  /** Small caps title (section-like) instead of a caption. */
  eyebrow?: boolean;
  initiallyOpen?: boolean;
  children: ReactNode;
}

/** A tappable header that shows or hides its content. */
export function Disclosure({ title, summary, eyebrow = false, initiallyOpen = false, children }: DisclosureProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={summary}
        accessibilityState={{ expanded: open }}
        android_ripple={{ color: alpha(colors.text, 0.08) }}
        style={({ pressed }) => [styles.header, pressedStyle(pressed)]}>
        <View style={styles.titles}>
          {eyebrow ? (
            <Eyebrow>{title}</Eyebrow>
          ) : (
            <Caption strong tone="accent">
              {title}
            </Caption>
          )}
          {!open && summary ? <Caption numberOfLines={1}>{summary}</Caption> : null}
        </View>
        <Icon
          name="chevron-right"
          size={13}
          color={colors.textTertiary}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
  titles: { flex: 1, gap: 2 },
  body: { gap: spacing.md },
});
