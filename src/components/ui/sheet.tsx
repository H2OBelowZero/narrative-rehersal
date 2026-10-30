import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fillImage, materials } from '@/components/board/materials';
import { palettes, radii, spacing, SurfaceProvider } from '@/theme';

import { IconButton } from './button';
import { Heading } from './text';
import { ToastHost } from './toast';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned actions below the scrolling body (e.g. the primary button). */
  footer?: ReactNode;
}

/**
 * A sheet of paper slid across the desk: page sheet on iOS (swipe to dismiss), full-screen slide on Android
 * (hardware back closes), centred sheet over a scrim on web (Escape or scrim click closes). Its contents are paper.
 */
export function Sheet(props: SheetProps) {
  return (
    <SurfaceProvider surface="paper">
      <PaperSheet {...props} />
    </SurfaceProvider>
  );
}

function PaperSheet({ visible, onClose, title, children, footer }: SheetProps) {
  const colors = palettes.paper;
  const texture = <Image source={materials.paper} resizeMode="cover" style={fillImage} accessible={false} />;
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const bottomInset = web ? 0 : insets.bottom;

  const content = (
    <>
      {texture}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Heading style={styles.title} numberOfLines={1}>
          {title}
        </Heading>
        <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
      </View>
      <ScrollView
        style={web ? styles.webScroll : styles.fill}
        contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + (footer ? 0 : bottomInset) }]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && (
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.separator, backgroundColor: colors.bg, paddingBottom: spacing.md + bottomInset },
          ]}>
          {footer}
        </View>
      )}
      {visible && <ToastHost />}
    </>
  );

  if (web) {
    return (
      <Modal visible={visible} onRequestClose={onClose} transparent animationType="fade">
        <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  const android = Platform.OS === 'android';
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={android ? undefined : 'pageSheet'}
      allowSwipeDismissal
      statusBarTranslucent
      navigationBarTranslucent
      backdropColor={colors.bg}>
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: colors.bg, paddingTop: android ? insets.top : 0 }]}
        behavior={android ? 'height' : 'padding'}>
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  footer: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  webScroll: { flexShrink: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
});
