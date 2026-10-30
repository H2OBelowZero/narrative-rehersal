import { useState } from 'react';
import {
  Pressable,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { fillImage, materials } from '@/components/board/materials';
import { alpha, fonts, palettes, radii, spacing, TOUCH_TARGET, typography, useTheme } from '@/theme';

import { IconButton, pressedStyle } from './button';
import { haptics } from './haptics';
import { Body, Caption } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  helper?: string;
  /** Replaces the helper and marks the field invalid. */
  error?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function TextField({ label, helper, error, multiline, style, onFocus, onBlur, ...input }: TextFieldProps) {
  const { colors, surface } = useTheme();
  const [focused, setFocused] = useState(false);
  const onPaper = surface === 'paper';
  const borderColor = error ? colors.danger : focused ? (onPaper ? colors.text : colors.accent) : colors.border;
  return (
    <View style={[styles.field, style]}>
      <Caption strong tone="primary" importantForAccessibility="no">
        {label}
      </Caption>
      <TextInput
        {...input}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        cursorColor={colors.accentText}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typography.body,
          styles.input,
          multiline && styles.multiline,
          onPaper
            ? [styles.typed, { color: colors.text, borderColor, borderBottomWidth: focused || error ? 2 : 1.25 }]
            : { color: colors.text, backgroundColor: colors.surface, borderColor, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      />
      {(error || helper) && (
        <Caption tone={error ? 'danger' : 'secondary'} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {error ?? helper}
        </Caption>
      )}
    </View>
  );
}

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Mutually exclusive choice among 2–4 short options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { colors, surface } = useTheme();
  const onPaper = surface === 'paper';
  const ink = palettes.paper;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segments, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            android_ripple={{ color: alpha(colors.text, 0.1) }}
            style={({ pressed }) => [
              styles.segment,
              onPaper
                ? { borderBottomColor: selected ? colors.text : 'transparent' }
                : [styles.tab, selected && styles.tabSelected],
              pressedStyle(pressed && !selected),
            ]}>
            {!onPaper && <Image source={materials.paper} resizeMode="cover" style={fillImage} accessible={false} />}
            {!onPaper && !selected && <View style={[fillImage, styles.tabShade]} />}
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={[
                styles.segmentText,
                { color: onPaper && !selected ? colors.textSecondary : ink.text },
              ]}>
              {o.label.toUpperCase()}
            </Text>
            {!onPaper && selected && <View style={[styles.tabMark, { backgroundColor: palettes.desk.accent }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Shown to the left and used as the spoken name. */
  label: string;
  disabled?: boolean;
}

/** Integer stepper (capabilities 0–5 by default). */
export function Stepper({ value, onChange, min = 0, max = 5, label, disabled = false }: StepperProps) {
  const set = (next: number) => {
    if (disabled || next < min || next > max) return;
    haptics.selection();
    onChange(next);
  };
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <Body style={styles.stepperLabel} numberOfLines={1}>
        {label}
      </Body>
      <IconButton
        icon="minus"
        size={16}
        filled
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => set(value - 1)}
        disabled={disabled || value <= min}
      />
      <Body strong style={styles.stepperValue}>
        {value}
      </Body>
      <IconButton
        icon="plus"
        size={16}
        filled
        accessibilityLabel={`Increase ${label}`}
        onPress={() => set(value + 1)}
        disabled={disabled || value >= max}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  input: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  typed: {
    // Positioned so react-native-web paints it above the absolutely placed paper texture.
    position: 'relative',
    fontFamily: fonts.typewriter,
    backgroundColor: 'rgba(255, 250, 238, 0.45)',
    borderRadius: 0,
    paddingHorizontal: spacing.xs,
  },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  /** Index-card tabs clipped along the top of the board; the chosen one is lifted and marked in brass. */
  tab: { borderRadius: radii.sm, borderBottomWidth: 0 },
  tabSelected: { transform: [{ translateY: -2 }], elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  tabShade: { backgroundColor: 'rgba(38, 26, 14, 0.24)' },
  tabMark: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 5, height: 2 },
  segmentText: { fontFamily: fonts.typewriterBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperLabel: { flex: 1 },
  stepperValue: { minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
