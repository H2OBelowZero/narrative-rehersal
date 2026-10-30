import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { alpha, radii, spacing, TOUCH_TARGET, typography, useTheme, type Palette } from '@/theme';

import { haptics } from './haptics';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: TOUCH_TARGET, lg: 52 };
const FONT: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 17 };

function variantColors(colors: Palette, variant: ButtonVariant): { bg: string; fg: string; border?: string } {
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, fg: colors.onAccent };
    case 'secondary':
      return { bg: colors.surface, fg: colors.text, border: colors.border };
    case 'ghost':
      return { bg: 'transparent', fg: colors.accentText };
    case 'destructive':
      return { bg: colors.danger, fg: colors.onDanger };
  }
}

/** Press-down dimming for iOS and web; Android uses android_ripple instead. */
export const pressedStyle = (pressed: boolean): ViewStyle | undefined =>
  pressed && Platform.OS !== 'android' ? { opacity: 0.72 } : undefined;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  block = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const c = variantColors(colors, variant);
  const inactive = disabled || loading;
  const smallHitSlop = size === 'sm' ? (TOUCH_TARGET - HEIGHT.sm) / 2 : undefined;

  return (
    <PressableScale
      onPress={() => {
        haptics.light();
        onPress();
      }}
      disabled={inactive}
      hitSlop={smallHitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={{ color: alpha(c.fg, 0.16) }}
      style={[
        styles.base,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          backgroundColor: c.bg,
          borderColor: c.border ?? 'transparent',
        },
        block && styles.block,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : (
        icon && <Icon name={icon} size={FONT[size] + 2} color={c.fg} />
      )}
      <Text
        numberOfLines={1}
        style={[typography.body, styles.label, { color: c.fg, fontSize: FONT[size], lineHeight: FONT[size] + 6 }]}>
        {title}
      </Text>
    </PressableScale>
  );
}

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  size?: number;
  color?: ColorValue;
  /** Tinted circular background. */
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 20,
  color,
  filled = false,
  disabled = false,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      android_ripple={{ color: alpha(colors.text, 0.12), borderless: true, radius: TOUCH_TARGET / 2 }}
      style={({ pressed }) => [
        styles.icon,
        filled && { backgroundColor: colors.surfaceAlt },
        disabled && styles.disabled,
        pressedStyle(pressed),
        style,
      ]}>
      <Icon name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  label: { fontWeight: '600' },
  disabled: { opacity: 0.45 },
  icon: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
