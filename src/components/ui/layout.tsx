// Screens are cork boards in a walnut frame; cards are paper pinned to them; sections are masking-tape labels.
import { useState, type ReactNode, type Ref } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fillImage, materials } from '@/components/board/materials';
import { Paper, paperShadow, Pinned, TapeLabel } from '@/components/board/paper';
import { StringBoard, type PinAt, type PinKind } from '@/components/board/string-board';
import { alpha, MAX_CONTENT_WIDTH, palettes, radii, spacing, SurfaceProvider, typography, useSurface, useTheme } from '@/theme';

import { pressedStyle } from './button';
import { PressableScale } from './pressable-scale';

export interface ScreenProps {
  children: ReactNode;
  /** Enables pull-to-refresh (native); the spinner shows until the promise settles. */
  onRefresh?: () => Promise<unknown>;
  /** Wrap in a KeyboardAvoidingView (forms, composers). */
  keyboard?: boolean;
  /** false renders a fixed View instead of a ScrollView. Default true. */
  scroll?: boolean;
  /**
   * Safe-area edges to pad manually on Android/web — use for screens without a native header
   * ('top') or outside the tab bar ('bottom'). iOS insets come from contentInsetAdjustmentBehavior.
   */
  edges?: ('top' | 'bottom')[];
  /** Pinned below the scroll area (e.g. a composer), inside the keyboard avoidance. */
  footer?: ReactNode;
  /** Pinned above the scroll area (e.g. an editor's tool bar); it may overhang the board (tooltips). */
  header?: ReactNode;
  scrollRef?: Ref<ScrollView>;
  contentStyle?: StyleProp<ViewStyle>;
  /** The desk instead of the cork board (forms, settings). */
  plain?: boolean;
}

/** A cork board: scrolls, respects safe areas and native headers, strings its pinned cards together. */
export function Screen({
  children,
  onRefresh,
  keyboard = false,
  scroll = true,
  edges = [],
  footer,
  header,
  scrollRef,
  contentStyle,
  plain = false,
}: ScreenProps) {
  const desk = palettes.desk;
  const insets = useSafeAreaInsets();
  const cork = !plain;
  // Wide screens show the board as the mockup does: framed in walnut, on the desk. Phones run it edge to edge.
  const { width } = useWindowDimensions();
  const framedOnDesk = cork && width >= FRAME_ON_DESK;
  const [refreshing, setRefreshing] = useState(false);

  const manual = Platform.OS !== 'ios' || !scroll;
  const padding: ViewStyle = {
    paddingTop: spacing.xl + (manual && edges.includes('top') ? insets.top : 0),
    paddingBottom: spacing.xxxl + (manual && edges.includes('bottom') && !footer ? insets.bottom : 0),
  };
  const board = (
    <View style={[styles.boardFill, padding]}>
      <StringBoard style={[styles.inner, contentStyle]}>{children}</StringBoard>
    </View>
  );

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={[styles.fill, { backgroundColor: cork ? 'transparent' : desk.bg }]}
      contentContainerStyle={styles.grow}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={desk.accentText}
            colors={[desk.accent]}
            progressBackgroundColor={desk.surface}
          />
        ) : undefined
      }>
      {board}
    </ScrollView>
  ) : (
    <View style={[styles.fill, { backgroundColor: cork ? 'transparent' : desk.bg }]}>{board}</View>
  );

  const lit = (
    <View style={[styles.fill, cork && { backgroundColor: palettes.desk.surface }]} collapsable={false}>
      {cork && (
        // The board and the lamp over it stay put while the cards scroll across them, so the light falls off
        // toward the frame on the cork but never dims the paper: text keeps its contrast into the corners.
        <View pointerEvents="none" style={fillImage}>
          <Image source={materials.cork} resizeMode="repeat" style={fillImage} accessible={false} />
          <Image source={materials.lampFalloff} resizeMode="stretch" style={fillImage} accessible={false} />
        </View>
      )}
      {body}
      {cork && !framedOnDesk && (
        <View pointerEvents="none" style={styles.frameRail}>
          <Image source={materials.walnut} resizeMode="repeat" style={fillImage} accessible={false} />
        </View>
      )}
    </View>
  );

  const framed = (
    <View style={[styles.fill, framedOnDesk && [styles.desk, footer ? null : styles.deskWithProps]]} collapsable={false}>
      {header && (
        <SurfaceProvider surface="desk">
          <View style={[styles.header, { borderBottomColor: desk.border, backgroundColor: desk.bg }, framedOnDesk && styles.headerOnDesk]}>
            {header}
          </View>
        </SurfaceProvider>
      )}
      {framedOnDesk ? (
        <View style={[styles.frame, paperShadow]}>
          <Image source={materials.walnut} resizeMode="repeat" style={fillImage} accessible={false} />
          <View style={styles.frameInner}>{lit}</View>
        </View>
      ) : (
        lit
      )}
      {framedOnDesk && !footer && (
        <View pointerEvents="none" style={styles.props}>
          <Image source={materials.deskProps} resizeMode="contain" style={fillImage} accessible={false} />
        </View>
      )}
      {footer && (
        <SurfaceProvider surface="desk">
          <View
            style={[
              styles.footer,
              { borderTopColor: desk.border, backgroundColor: desk.bg, paddingBottom: spacing.sm + (edges.includes('bottom') ? insets.bottom : 0) },
            ]}>
            <View style={styles.innerFooter}>{footer}</View>
          </View>
        </SurfaceProvider>
      )}
    </View>
  );

  if (keyboard && Platform.OS !== 'web') {
    return (
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} collapsable={false}>
        {framed}
      </KeyboardAvoidingView>
    );
  }
  return framed;
}

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** accent: brass-edged (current, chosen); sunken: an unpinned slip, darker paper. */
  tone?: 'default' | 'accent' | 'sunken';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Cards sharing a thread are joined by red string, in `order`. */
  thread?: string;
  order?: number;
  pin?: PinKind;
  /** 'left' (default) runs a thread down the board; 'top' runs it across a row. */
  at?: PinAt;
  fasten?: 'pin' | 'tape' | 'none';
  /** Tilt seed, or false to hang it square (forms, long reading). */
  tilt?: string | number | false;
}

/** An index card pinned to the board. Inside another card it becomes a flat slip of paper. */
export function Card({
  children,
  onPress,
  tone = 'default',
  accessibilityLabel,
  style,
  thread,
  order,
  pin,
  at = 'left',
  fasten = 'pin',
  tilt,
}: CardProps) {
  const nested = useSurface() === 'paper';
  const ink = palettes.paper;

  if (nested || tone === 'sunken') {
    const slip = [styles.slip, { backgroundColor: nested ? ink.surfaceAlt : ink.surfaceAlt, borderColor: ink.separator }, style];
    const inner = <SurfaceProvider surface="paper">{children}</SurfaceProvider>;
    if (!onPress) return <View style={slip}>{inner}</View>;
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={slip}>
        {inner}
      </PressableScale>
    );
  }

  const paper = (
    <Paper style={[styles.card, at === 'top' && styles.cardTopPin, tone === 'accent' && styles.accent, style]}>{children}</Paper>
  );
  return (
    <Pinned thread={thread} order={order} pin={pin ?? (tone === 'accent' ? 'brass' : 'red')} at={at} fasten={fasten} tilt={tilt}>
      <View style={[styles.shadowed, paperShadow]}>
        {onPress ? (
          <PressableScale
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            android_ripple={{ color: alpha(ink.text, 0.08) }}>
            {paper}
          </PressableScale>
        ) : (
          paper
        )}
      </View>
    </Pinned>
  );
}

export interface SectionProps {
  title?: string;
  /** A handwritten aside next to the tape ("Setup", "the story so far"). */
  note?: string;
  /** Trailing text action in the section header ("See all"). */
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A group on the board, headed by a strip of masking tape. On paper it is a typed heading instead. */
export function Section({ title, note, action, children, style }: SectionProps) {
  const onPaper = useSurface() === 'paper';
  // Surface typography: on paper a section label is typed, not set in the desk's system face.
  const { colors, typography: type } = useTheme();
  return (
    <View style={[styles.section, style]}>
      {(title || action) && (
        <View style={styles.sectionHeader}>
          {title ? (
            onPaper ? (
              <Text accessibilityRole="header" style={[type.eyebrow, { color: colors.textSecondary }]}>
                {title}
              </Text>
            ) : (
              <TapeLabel note={note}>{title}</TapeLabel>
            )
          ) : (
            <View />
          )}
          {action && (
            <Pressable
              onPress={action.onPress}
              hitSlop={12}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionHit, pressedStyle(pressed)]}>
              <Text style={[typography.caption, styles.action, { color: onPaper ? colors.accentText : palettes.desk.text }]}>
                {action.label}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

/** From this width the board is framed on the desk (matches the sidebar breakpoint). */
const FRAME_ON_DESK = 900;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  boardFill: { flexGrow: 1, paddingHorizontal: spacing.lg },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: spacing.xl },
  innerFooter: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  /** Phones: the top rail of the walnut frame the board hangs in. */
  frameRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 9,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.7)',
  },
  desk: { backgroundColor: palettes.desk.bg, padding: spacing.lg + 2 },
  deskWithProps: { paddingBottom: 84 },
  frame: { flex: 1, padding: 13, borderRadius: radii.md, overflow: 'hidden' },
  frameInner: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.75)',
  },
  // Rests on the frame's walnut lip only: the cork above is where content scrolls.
  props: { position: 'absolute', left: spacing.sm, bottom: -10, width: 110, height: 108 },
  header: { zIndex: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerOnDesk: { borderBottomWidth: 0, marginBottom: spacing.md },
  footer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shadowed: { borderRadius: radii.sm },
  card: {
    padding: spacing.lg,
    paddingLeft: spacing.xl + 2,
    paddingTop: spacing.xl + 2,
    gap: spacing.md,
  },
  cardTopPin: { paddingLeft: spacing.lg },
  accent: { borderWidth: 2, borderColor: palettes.desk.accent },
  slip: {
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 28,
  },
  actionHit: { minHeight: 32, justifyContent: 'center' },
  action: { fontWeight: '600', textDecorationLine: 'underline' },
});
