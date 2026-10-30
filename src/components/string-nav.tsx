// Navigation you follow: the six project areas hang from one red string. Choosing an area sends a bead of light
// along the string from where you are to where you're going, and the new board slides in from that side.
// Phones: a walnut rail along the bottom with paper tags on the string. Wide screens: the sidebar from the desk
// mockup, strung top to bottom. Structure stays a plain 6-destination tab bar (tablist semantics, 44pt targets).
import { router, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { STC_BEATS } from '@shared/structure';

import { fillImage, materials } from '@/components/board/materials';
import { Pin, Thread } from '@/components/board/string-board';
import { Icon, haptics, pressedStyle, type IconName } from '@/components/ui';
import { useProject } from '@/lib/session';
import { fonts, handType, palettes, spacing, SurfaceProvider, TOUCH_TARGET, world } from '@/theme';

export type TabName = 'home' | 'story' | 'write' | 'rehearse' | 'crew' | 'discover';
const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'story', label: 'Story', icon: 'story' },
  { name: 'write', label: 'Write', icon: 'edit' },
  { name: 'rehearse', label: 'Rehearse', icon: 'rehearse' },
  { name: 'crew', label: 'Crew', icon: 'crew' },
  { name: 'discover', label: 'Discover', icon: 'discover' },
];

/** Sidebar layout from this width (tablets, desktop web). */
const WIDE = 900;
const EASE_ALONG = Easing.bezier(0.77, 0, 0.175, 1);
const desk = palettes.desk;

// Which way the string was followed on the last move: the arriving board enters from that side.
let lastIndex = 0;
let lastDirection = 0;
export const stringDirection = () => lastDirection;

/**
 * Travel along the string to another area from inside a board (a card on Home, a link in Rehearse):
 * the bead and the arriving board move the same way a nav tap would. `params` joins the area's query (e.g. view).
 */
export function followString(projectId: string, to: TabName, params: Record<string, string> = {}) {
  const index = TABS.findIndex((t) => t.name === to);
  lastDirection = Math.sign(index - lastIndex);
  lastIndex = index;
  router.navigate({ pathname: `/project/[id]/${to}`, params: { id: projectId, ...params } });
}

function useActiveIndex(): number {
  const path = usePathname();
  const i = TABS.findIndex((t) => path.includes(`/${t.name}`));
  return i < 0 ? 0 : i;
}

export function StringNav() {
  const { projectId } = useProject();
  const active = useActiveIndex();
  // Keep the string's memory in step with back navigation and deep links, not only taps.
  useEffect(() => {
    lastIndex = active;
  }, [active]);
  const wide = useWindowDimensions().width >= WIDE;
  const href = (name: TabName) => ({ pathname: `/project/[id]/${name}` as const, params: { id: projectId } });
  const triggers = TABS.map((t, i) => (
    <TabTrigger key={t.name} name={t.name} href={href(t.name)} asChild>
      <Tag icon={t.icon} index={i} wide={wide}>
        {t.label}
      </Tag>
    </TabTrigger>
  ));
  return (
    <Tabs style={[styles.fill, wide && styles.row]}>
      {wide ? (
        <TabList asChild>
          <Sidebar>{triggers}</Sidebar>
        </TabList>
      ) : null}
      <TabSlot style={styles.fill} />
      {!wide ? (
        <TabList asChild>
          <Rail>{triggers}</Rail>
        </TabList>
      ) : null}
    </Tabs>
  );
}

// ───────── Phone: the rail ─────────

const RAIL_STRING_Y = 16;

function Rail({ children, style: _style, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  const active = useActiveIndex();
  const [width, setWidth] = useState(0);
  const step = width / TABS.length;
  const pins = TABS.map((_, i) => ({ x: step * (i + 0.5), y: RAIL_STRING_Y }));
  const path = [{ x: -8, y: RAIL_STRING_Y - 4 }, ...pins, { x: width + 8, y: RAIL_STRING_Y - 4 }];

  return (
    <View
      {...props}
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.rail, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <Image source={materials.walnut} resizeMode="repeat" style={fillImage} accessible={false} />
      <View pointerEvents="none" style={styles.railEdge} />
      {width > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={width} height={48}>
            <Thread points={path} />
          </Svg>
          <Bead points={pins} active={active} axis="x" />
        </View>
      )}
      <View style={styles.railTags}>{children}</View>
    </View>
  );
}

// ───────── Wide: the sidebar ─────────

const SIDEBAR_WIDTH = 232;
const ITEM_HEIGHT = 52;
const SIDEBAR_STRING_X = 30;

function Sidebar({ children, style: _style, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  const active = useActiveIndex();
  const { project, sim } = useProject();
  const pins = TABS.map((_, i) => ({ x: SIDEBAR_STRING_X, y: ITEM_HEIGHT * (i + 0.5) }));
  const beat = sim ? sim.beatIndex + 1 : 0;

  return (
    <View {...props} style={[styles.sidebar, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Pressable
        onPress={() => router.dismissTo('/')}
        accessibilityRole="link"
        accessibilityLabel="All projects"
        style={({ pressed }) => [styles.brand, pressedStyle(pressed)]}>
        <Text style={[handType.wordmark, styles.wordmarkSmall]}>THE</Text>
        <Text style={[handType.wordmark, styles.wordmark]}>STORY DESK</Text>
      </Pressable>
      <Pressable
        onPress={() => router.dismissTo('/')}
        accessibilityRole="link"
        accessibilityLabel="Back to all projects"
        style={({ pressed }) => [styles.project, pressedStyle(pressed)]}>
        <Icon name="back" size={14} color={desk.textSecondary} />
        <Text numberOfLines={1} style={styles.projectTitle}>
          {project?.model.title ?? 'Projects'}
        </Text>
      </Pressable>

      <View accessibilityRole="tablist" style={styles.sideTags}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Shifted up so the thread's overhang above the first pin is drawn, not clipped. */}
          <Svg
            width={SIDEBAR_WIDTH}
            height={ITEM_HEIGHT * TABS.length + 36}
            viewBox={`0 -12 ${SIDEBAR_WIDTH} ${ITEM_HEIGHT * TABS.length + 36}`}
            style={styles.sideThread}>
            <Thread minBow={0} points={[{ x: SIDEBAR_STRING_X - 6, y: -12 }, ...pins, { x: SIDEBAR_STRING_X - 6, y: ITEM_HEIGHT * TABS.length + 20 }]} />
          </Svg>
          <Bead points={pins} active={active} axis="y" />
        </View>
        {children}
      </View>

      {sim && (
        <View style={styles.progress} accessible accessibilityLabel={`Story progress: beat ${beat} of ${STC_BEATS.length}`}>
          <Text style={styles.progressLabel}>STORY PROGRESS</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(beat / STC_BEATS.length) * 100}%` }]} />
          </View>
          <Text style={styles.progressValue}>
            {STC_BEATS[sim.beatIndex]!.name} · beat {beat} of {STC_BEATS.length}
          </Text>
        </View>
      )}
      <Text style={styles.motto}>Run the story before you make the story.</Text>
    </View>
  );
}

// ───────── Shared ─────────

/** A bead of light riding the string from the last pin to the chosen one. */
function Bead({ points, active, axis }: { points: { x: number; y: number }[]; active: number; axis: 'x' | 'y' }) {
  const t = useSharedValue(active);
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withSequence(withTiming(1, { duration: 90 }), withTiming(1, { duration: 360 }), withTiming(0, { duration: 260 })));
    t.set(withTiming(active, { duration: 460, easing: EASE_ALONG }));
  }, [active, t, glow]);

  const bead = useAnimatedStyle(() => {
    const i = Math.min(Math.max(Math.floor(t.get()), 0), points.length - 2);
    const f = Math.min(Math.max(t.get() - i, 0), 1);
    const a = points[i] ?? points[0]!;
    const b = points[i + 1] ?? a;
    const along = a[axis] + (b[axis] - a[axis]) * f;
    // Follow the string's sag between pins (the same quadratic the thread draws).
    const sag = 2 * f * (1 - f) * Math.min(44, 8 + Math.abs(b[axis] - a[axis]) * 0.1);
    const x = axis === 'x' ? along : a.x - sag * 0.7;
    const y = axis === 'x' ? a.y + sag : along;
    return { opacity: glow.get(), transform: [{ translateX: x - 5 }, { translateY: y - 5 }] };
  });
  return <Animated.View style={[styles.bead, bead]} />;
}

function Tag({ children, isFocused, icon, index, wide, style: _style, ...props }: TabTriggerSlotProps & { icon: IconName; index: number; wide: boolean }) {
  const swing = useSharedValue(0);
  useEffect(() => {
    if (isFocused) swing.set(withSequence(withTiming(lastDirection * -5, { duration: 1 }), withSpring(0, { damping: 9, stiffness: 180 })));
  }, [isFocused, swing]);
  const swingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.get()}deg` }] }));
  const label = String(children);

  return (
    <Pressable
      {...props}
      onPress={(e) => {
        if (!isFocused) {
          lastDirection = Math.sign(index - lastIndex);
          lastIndex = index;
          haptics.selection();
        }
        props.onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [wide ? styles.sideItem : styles.railItem, wide && isFocused && styles.sideItemActive, pressedStyle(pressed)]}>
      {wide ? (
        <>
          <View style={styles.sidePin}>
            <Pin kind={isFocused ? 'red' : 'brass'} size={isFocused ? 20 : 15} />
          </View>
          <Icon name={icon} size={17} color={isFocused ? desk.text : desk.textSecondary} />
          <Text style={[styles.sideLabel, { color: isFocused ? desk.text : desk.textSecondary }]}>{label}</Text>
        </>
      ) : (
        <>
          <Pin kind={isFocused ? 'red' : 'brass'} size={isFocused ? 18 : 13} style={styles.railPin} />
          <Animated.View style={[styles.tag, swingStyle]}>
            <Image source={materials.paper} resizeMode="cover" style={fillImage} accessible={false} />
            {/* Idle tags sit back in the lamp's shadow; the paper stays opaque so the string never shows through. */}
            {!isFocused && <View style={[fillImage, styles.tagShade]} />}
            {/* The tag is paper: its ink must not be carried to the desk palette. */}
            <SurfaceProvider surface="paper">
              <Icon name={icon} size={15} color={palettes.paper.text} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.tagLabel}>
                {label.toUpperCase()}
              </Text>
            </SurfaceProvider>
          </Animated.View>
        </>
      )}
    </Pressable>
  );
}

/** Wraps a tab's content so the arriving board slides in from the side the string was followed from. */
export function FollowString({ children, focused }: { children: ReactNode; focused: boolean }) {
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!focused || !lastDirection) return;
    x.set(withSequence(withTiming(lastDirection * 28, { duration: 1 }), withTiming(0, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1) })));
    opacity.set(withSequence(withTiming(0.35, { duration: 1 }), withTiming(1, { duration: 240 })));
  }, [focused, x, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateX: x.get() }] }));
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  // Rail
  rail: { overflow: 'hidden', paddingTop: 6 },
  railEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  railTags: { flexDirection: 'row' },
  railItem: { flex: 1, alignItems: 'center', minHeight: TOUCH_TARGET + 22, paddingTop: 2 },
  railPin: { zIndex: 2 },
  tag: {
    marginTop: -3,
    // Clears the pin's needle, which hangs over the top of the tag.
    paddingTop: 11,
    // Six tags share a 320pt phone: a tag may shrink to its column and its label scales down to fit.
    minWidth: 50,
    maxWidth: 76,
    paddingHorizontal: 6,
    paddingBottom: 4,
    alignItems: 'center',
    gap: 1,
    borderRadius: 2,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.5)' },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  tagShade: { backgroundColor: 'rgba(38, 26, 14, 0.22)' },
  tagLabel: { fontFamily: fonts.typewriterBold, fontSize: 10, lineHeight: 13, letterSpacing: 0.5, color: palettes.paper.text },
  bead: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB27A',
    ...Platform.select({
      web: { boxShadow: `0 0 10px 3px ${world.stringHighlight}` },
      default: { shadowColor: world.stringHighlight, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  // Sidebar
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: desk.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: desk.border,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', minHeight: TOUCH_TARGET, justifyContent: 'center' },
  wordmarkSmall: { color: desk.textSecondary, fontSize: 11, lineHeight: 14, letterSpacing: 3 },
  wordmark: { color: desk.text },
  project: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET },
  projectTitle: { fontFamily: fonts.typewriterBold, fontSize: 14, letterSpacing: 1, color: desk.text, flexShrink: 1, textTransform: 'uppercase' },
  sideTags: { marginHorizontal: -spacing.lg },
  sideThread: { position: 'absolute', top: -12, left: 0 },
  sideItem: { height: ITEM_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: SIDEBAR_STRING_X + 18 },
  sideItemActive: { backgroundColor: 'rgba(239, 231, 216, 0.07)' },
  sidePin: { position: 'absolute', left: SIDEBAR_STRING_X - 10, width: 20, alignItems: 'center' },
  sideLabel: { fontSize: 15, fontWeight: '500' },
  progress: { gap: spacing.xs, marginTop: 'auto' },
  progressLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: '600', color: desk.textSecondary },
  progressTrack: { height: 2, backgroundColor: desk.border },
  progressFill: { height: 2, backgroundColor: desk.text },
  progressValue: { fontSize: 12, color: desk.textTertiary },
  motto: { ...handType.note, fontSize: 19, color: desk.textSecondary },
});
