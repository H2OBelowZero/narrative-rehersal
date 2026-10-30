// Small pieces shared by the Story tab: mutation/sheet state, redaction-aware prose, canon status picking,
// the wide-layout switch, measured card grids and the prints that stand in for people without a photograph.
import { useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CANON_LABEL, CANON_STATUSES } from '@shared/structure';
import type { CanonStatus, Character, CharacterRole } from '@shared/types';

import { characterImage, fillImage } from '@/components/board/materials';
import { Body, Caption, CanonBadge, Chip, Eyebrow, Icon, type IconName, pressedStyle } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useProject } from '@/lib/session';
import { alpha, fonts, spacing, useTheme } from '@/theme';

/** Tablets and desktop web (the sidebar layout): boards restructure into rows and side panels. */
export const useWide = () => useWindowDimensions().width >= 900;

/** Equal columns at least `min` wide that fill a measured row (attach `onLayout` to the row). */
export function useGrid(min: number, gap: number) {
  const [width, setWidth] = useState(0);
  const cols = width ? Math.max(1, Math.floor((width + gap) / (min + gap))) : 1;
  const item = width ? Math.floor((width - gap * (cols - 1)) / cols) : min;
  return { onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), cols, item };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const PRINT_BORDER = 7; // Polaroid's white border (components/board/paper.tsx)
const DARKROOM = '#1A1714';

/** Laid over a Polaroid without a photograph: an unexposed print carrying the person's initials. */
export function PrintInitials({ name, width, aspect = 4 / 5 }: { name: string; width: number; aspect?: number }) {
  const w = width - PRINT_BORDER * 2;
  return (
    <View pointerEvents="none" style={[styles.printInitials, { width: w, height: w / aspect }]}>
      <Text maxFontSizeMultiplier={1} style={[styles.initials, { fontSize: Math.round(w * 0.24) }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** A small print of a character (relationship rows): their photograph, or their initials. */
export function Thumb({ character, size = 40, style }: { character?: Pick<Character, 'name' | 'image'>; size?: number; style?: StyleProp<ViewStyle> }) {
  const source = character ? characterImage(character) : undefined;
  return (
    <View style={[styles.thumb, { width: size, height: Math.round(size * 1.2) }, style]} accessible={false}>
      {source ? (
        <Image source={source} style={fillImage} resizeMode="cover" accessible={false} />
      ) : (
        <Text maxFontSizeMultiplier={1} style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>
          {initials(character?.name ?? '')}
        </Text>
      )}
    </View>
  );
}

export const CHARACTER_ROLES: CharacterRole[] = ['protagonist', 'antagonist', 'ally', 'supporting', 'wildcard'];
export const CHARACTER_ROLE_LABEL: Record<CharacterRole, string> = {
  protagonist: 'Protagonist',
  antagonist: 'Antagonist',
  ally: 'Ally',
  supporting: 'Supporting',
  wildcard: 'Wildcard',
};

/** PRD §8 — what each canon status means. */
const CANON_MEANING: Record<CanonStatus, string> = {
  locked: 'Must remain true.',
  canon: 'Established and authoritative.',
  proposed: 'Possible but not yet accepted.',
  emergent: 'Discovered through simulation.',
  unknown: 'Intentionally unresolved.',
  rejected: 'Previously tested and discarded.',
};

/**
 * One mutation at a time for a form or control. `busy` holds the key of the run in flight;
 * `error` keeps the last failure for inline display (useProject().call has already toasted it).
 */
export function useMutation() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run, setError };
}

/**
 * Sheet open/close state that keeps its content mounted while the sheet animates out.
 * `state.key` changes on every open, so keying the sheet by it resets the form's draft.
 */
export function useSheet<T>() {
  const [state, setState] = useState<{ value: T; key: number; visible: boolean } | null>(null);
  return {
    state,
    open: (value: T) => setState((s) => ({ value, key: (s?.key ?? 0) + 1, visible: true })),
    close: () => setState((s) => (s ? { ...s, visible: false } : s)),
  };
}

/** Placeholder for an empty authored field; in a redacted view the field was hidden, not left blank. */
export function useEmptyText(): (fallback?: string) => string {
  const redacted = !!useProject().project?.redacted;
  return (fallback = 'Not written yet') => (redacted ? 'Not in your brief' : fallback);
}

/** Labelled authored prose. */
export function Prose({ label, value }: { label: string; value: string | undefined }) {
  const emptyText = useEmptyText();
  return (
    <View style={styles.tight}>
      <Eyebrow>{label}</Eyebrow>
      {value?.trim() ? (
        <Body>{value}</Body>
      ) : (
        <Body tone="tertiary" style={styles.italic}>
          {emptyText()}
        </Body>
      )}
    </View>
  );
}

/** A List row with free-form content (full text, meters); pressable when `onPress` is given. */
export function Row({
  onPress,
  accessibilityLabel,
  highlighted = false,
  children,
  style: extra,
}: {
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Tints the row (the active item of a list). */
  highlighted?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const style = [styles.listRow, highlighted && { backgroundColor: colors.accentSoft }, extra];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: alpha(colors.text, 0.08) }}
      style={({ pressed }) => [style, pressedStyle(pressed)]}>
      {children}
    </Pressable>
  );
}

/** Label/value line for dense administrative blocks. */
export function KeyValue({ label, icon, children }: { label: string; icon?: IconName; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.kv}>
      <View style={[styles.kvLabel, styles.kvLabelRow]}>
        {icon && <Icon name={icon} size={14} color={colors.textSecondary} />}
        <Caption>{label}</Caption>
      </View>
      <View style={styles.kvValue}>{typeof children === 'string' ? <Body>{children}</Body> : children}</View>
    </View>
  );
}

/** Plain bulleted lines. */
export function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.tight}>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet}>
          <Body tone="tertiary">•</Body>
          <Body style={styles.grow}>{item}</Body>
        </View>
      ))}
    </View>
  );
}

const PROMOTED: CanonStatus[] = ['canon', 'locked'];

export function StatusPicker({
  value,
  onChange,
  current,
  disabled,
}: {
  value: CanonStatus;
  onChange: (status: CanonStatus) => void;
  /** The saved status, kept selectable even when this role could not choose it. */
  current?: CanonStatus;
  disabled?: boolean;
}) {
  const { can } = useProject();
  const canPromote = can('promoteCanon');
  // 'canon' and 'locked' are owner-only; a non-owner still sees (and can return to) the saved status.
  const choices = CANON_STATUSES.filter((s) => canPromote || !PROMOTED.includes(s) || s === current);
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Canon status">
      <Caption strong tone="primary">
        Status
      </Caption>
      <View style={styles.chips}>
        {choices.map((s) => (
          <Chip key={s} label={CANON_LABEL[s]} selected={value === s} disabled={disabled} onPress={() => onChange(s)} />
        ))}
      </View>
      <Caption>{CANON_MEANING[value]}</Caption>
      {!canPromote && <Caption tone="tertiary">Only the Project Owner promotes to canon.</Caption>}
    </View>
  );
}

export function CanonLegend() {
  return (
    <View style={styles.tight}>
      {CANON_STATUSES.map((s) => (
        <View key={s} style={styles.legendRow}>
          <View style={styles.legendBadge}>
            <CanonBadge status={s} />
          </View>
          <Caption style={styles.legendText}>{CANON_MEANING[s]}</Caption>
        </View>
      ))}
    </View>
  );
}

/** Layout styles shared across the Story tab. */
export const storyStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flex: 1 },
  tight: { gap: spacing.xs },
  group: { gap: spacing.sm },
  italic: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kv: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  kvLabel: { width: 128, paddingTop: 3 },
  kvLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  kvValue: { flex: 1 },
  bullet: { flexDirection: 'row', gap: spacing.sm },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xxs },
  legendText: { flexGrow: 1, flexBasis: 160 },
  legendBadge: { width: 96 },
  listRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.xs + 2, overflow: 'hidden' },
  /** Wide screens: side-by-side columns of the board. */
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  column: { flex: 1, minWidth: 0, gap: spacing.xl },
  printInitials: {
    position: 'absolute',
    top: PRINT_BORDER,
    left: PRINT_BORDER,
    backgroundColor: DARKROOM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.typewriterBold, color: '#8B8173', letterSpacing: 1 },
  thumb: {
    backgroundColor: DARKROOM,
    borderWidth: 3,
    borderColor: '#F3EEE3',
    borderRadius: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = storyStyles;
