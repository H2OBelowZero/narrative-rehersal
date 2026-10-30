import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { CANON_LABEL, RISK_LABEL, ROLE_LABEL, TIER_LABEL } from '@shared/structure';
import type { CanonStatus, Risk, Role, Tier } from '@shared/types';

import { Stamp } from '@/components/board/paper';
import { alpha, onSurface, radii, spacing, TOUCH_TARGET, typography, useTheme } from '@/theme';

import { pressedStyle } from './button';
import { haptics } from './haptics';
import { Icon, type IconName } from './icon';

const CHIP_HEIGHT = 32;

export type BadgeVariant = 'soft' | 'solid' | 'outline' | 'dashed' | 'dotted';

export interface BadgeProps {
  label: string;
  /** Any palette colour (#RRGGBB). Defaults to secondary text. */
  color?: string;
  variant?: BadgeVariant;
  icon?: IconName;
  /** Strike the label through (rejected material). */
  strike?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small non-interactive status label. On paper it is a rubber stamp. */
export function Badge({ label, color, variant = 'soft', icon, strike = false, style }: BadgeProps) {
  const { colors, surface } = useTheme();
  const c = onSurface(color, surface) ?? colors.textSecondary;
  if (surface === 'paper') return <Stamp label={label} color={c} strike={strike} style={style} />;
  const solid = variant === 'solid';
  const fg = solid ? colors.bg : c;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.badge,
        {
          backgroundColor: solid ? c : variant === 'soft' ? alpha(c, 0.13) : 'transparent',
          borderColor: variant === 'soft' ? alpha(c, 0.28) : c,
          borderStyle: variant === 'dashed' || variant === 'dotted' ? variant : 'solid',
        },
        style,
      ]}>
      {icon && <Icon name={icon} size={11} color={fg} />}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.6}
        style={[styles.badgeText, { color: fg }, strike && styles.strike]}>
        {label}
      </Text>
    </View>
  );
}

const CANON_STYLE: Record<CanonStatus, { variant: BadgeVariant; icon?: IconName; strike?: boolean }> = {
  locked: { variant: 'solid', icon: 'lock' },
  canon: { variant: 'soft', icon: 'check' },
  proposed: { variant: 'dashed' },
  emergent: { variant: 'soft' },
  unknown: { variant: 'dotted', icon: 'question' },
  rejected: { variant: 'outline', strike: true },
};

/** Canon status of any story element (PRD §8): locked solid, proposed dashed, emergent amber, rejected struck. */
export function CanonBadge({ status, style }: { status: CanonStatus; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <Badge label={CANON_LABEL[status]} color={colors.canon[status]} {...CANON_STYLE[status]} style={style} />;
}

/** Resolution tier — describes the consequence band, never the quality of the choice. */
export function TierBadge({ tier, style }: { tier: Tier; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <Badge label={TIER_LABEL[tier]} color={colors.tier[tier]} style={style} />;
}

export function RiskBadge({ risk, style }: { risk: Risk; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <Badge label={RISK_LABEL[risk]} color={colors.risk[risk]} variant="outline" style={style} />;
}

export function RoleBadge({ role, style }: { role: Role; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <Badge label={ROLE_LABEL[role]} color={colors.role[role]} style={style} />;
}

export interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Pill for filters and toggles; static (no onPress) for tags. */
export function Chip({ label, onPress, selected = false, icon, disabled = false, accessibilityLabel, style }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.accentText : colors.text;
  const chipStyle: ViewStyle = {
    backgroundColor: selected ? colors.accentSoft : colors.surface,
    borderColor: selected ? alpha(colors.accent, 0.6) : colors.border,
  };
  const content = (
    <>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text numberOfLines={1} style={[typography.caption, styles.chipText, { color: fg }]}>
        {label}
      </Text>
    </>
  );
  if (!onPress) return <View style={[styles.chip, chipStyle, style]}>{content}</View>;
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={(TOUCH_TARGET - CHIP_HEIGHT) / 2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      android_ripple={{ color: alpha(colors.text, 0.1) }}
      style={({ pressed }) => [styles.chip, chipStyle, disabled && styles.disabled, pressedStyle(pressed), style]}>
      {content}
    </Pressable>
  );
}

export interface AvatarProps {
  name: string;
  role?: Role;
  size?: number;
}

/** Initials in the participant's role colour. */
export function Avatar({ name, role, size = 36 }: AvatarProps) {
  const { colors } = useTheme();
  const c = role ? colors.role[role] : colors.textSecondary;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      accessible={false}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: alpha(c, 0.16), borderColor: alpha(c, 0.35) },
      ]}>
      <Text maxFontSizeMultiplier={1} style={{ color: c, fontSize: size * 0.38, fontWeight: '600' }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  strike: { textDecorationLine: 'line-through' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  chipText: { fontWeight: '500' },
  disabled: { opacity: 0.45 },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
