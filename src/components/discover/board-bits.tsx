// Small pieces of the Discover board: the width it has to work with, a binder clip for typed pages, and a
// typewriter ledger (label, typed dot leaders, value) for tallies on index cards.
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { Caption } from '@/components/ui';
import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

/** Same breakpoint as the string-nav sidebar (tablets, desktop web). */
const WIDE = 900;
// ponytail: mirrors string-nav's SIDEBAR_WIDTH and the Screen's side padding; export them there if they drift.
const SIDEBAR = 232;
const GUTTERS = 32;
/** Widest the Discover board grows on desktop; wider than reading measure because it lays cards in rows. */
export const BOARD_MAX = 1180;
/** Side panel on wide boards (trackers, compare, page notes). */
export const SIDE = 340;

/** Whether the board is wide (sidebar layout) and how much width its content really has. */
export function useBoard() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const inner = wide ? Math.min(width - SIDEBAR - GUTTERS, BOARD_MAX) : Math.min(width - GUTTERS, MAX_CONTENT_WIDTH);
  return { wide, inner };
}

/** A black binder clip holding the top edge of a typed page. Geometry only; sits over the paper. */
export function BinderClip({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.clip, style]}>
      <View style={styles.wire} />
      <View style={styles.body}>
        <View style={styles.shine} />
      </View>
    </View>
  );
}

/** Typed tally lines: "Open ........ 3". The periods are typed, as on a typewriter ledger. */
export function Ledger({ rows }: { rows: { label: string; value: string | number }[] }) {
  return (
    <View style={styles.ledger}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
          <Caption tone="primary" style={styles.label}>
            {r.label}
          </Caption>
          <Caption tone="tertiary" numberOfLines={1} ellipsizeMode="clip" style={styles.leader}>
            {' . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .'}
          </Caption>
          <Caption tone="primary" strong style={styles.value}>
            {r.value}
          </Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: -13, alignSelf: 'center', alignItems: 'center', zIndex: 2 },
  wire: {
    width: 26,
    height: 12,
    marginBottom: -3,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#B8B2A5',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  body: {
    width: 48,
    height: 17,
    backgroundColor: '#1D1A17',
    borderRadius: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    ...Platform.select<ViewStyle>({
      web: { boxShadow: '0 2px 3px rgba(0,0,0,0.45)' } as ViewStyle,
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  shine: { position: 'absolute', top: 3, left: 5, right: 5, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  ledger: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  label: { flexShrink: 1, maxWidth: '62%' },
  // react-native-web ignores ellipsizeMode and always ellipsizes one-line text: clip the typed periods instead.
  leader: { flex: 1, minWidth: spacing.md, ...(Platform.OS === 'web' ? ({ textOverflow: 'clip' } as object) : null) },
  value: { flexShrink: 1, maxWidth: '55%', textAlign: 'right', fontVariant: ['tabular-nums'] },
});
