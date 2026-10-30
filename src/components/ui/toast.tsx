import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { paperShadow, Tape } from '@/components/board/paper';
import { MAX_CONTENT_WIDTH, palettes, radii, spacing, SurfaceProvider } from '@/theme';

import { haptics } from './haptics';
import { Icon } from './icon';
import { Body } from './text';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

// The most recently mounted host shows toasts, so a Sheet (its own native window) can show them above itself.
const hosts: ((toast: ToastMessage) => void)[] = [];
let nextId = 1;

/** Shows a brief message from anywhere. Errors stay longer and buzz. */
export function showToast(message: string, tone: ToastTone = 'info') {
  const toast = { id: nextId++, message, tone };
  // Next tick: a Sheet closed in the same handler has unmounted its host by then, so the toast lands on the root.
  setTimeout(() => hosts.at(-1)?.(toast), 0);
  if (tone === 'error') haptics.error();
  if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
}

/** Renders toasts; mounted once at the root (and inside each Sheet). */
export function ToastHost() {
  const colors = palettes.paper;
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const show = (t: ToastMessage) => setToast(t);
    hosts.push(show);
    return () => {
      hosts.splice(hosts.indexOf(show), 1);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const accent = toast && { info: colors.textSecondary, success: colors.tier.success, error: colors.danger }[toast.tone];
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      {toast && accent && (
        <Animated.View key={toast.id} entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)}>
          <Pressable
            onPress={() => setToast(null)}
            accessibilityRole="alert"
            accessibilityHint="Dismisses the message"
            style={[styles.toast, paperShadow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Tape width={56} style={styles.tape} />
            <Icon
              name={toast.tone === 'error' ? 'warning' : toast.tone === 'success' ? 'check' : 'info'}
              size={18}
              color={accent}
            />
            <SurfaceProvider surface="paper">
              <Body style={styles.message}>{toast.message}</Body>
            </SurfaceProvider>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: MAX_CONTENT_WIDTH - 2 * spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-0.6deg' }],
  },
  tape: { position: 'absolute', top: -7, alignSelf: 'center', left: '40%' },
  message: { flexShrink: 1 },
});
