// The dice moment (PRD §23 "bounded uncertainty"): a bone d20 is thrown onto the desk and tumbles while the server
// rolls and narrates, then settles on the real roll beside a slip naming the move. Honours reduce-motion (no throw,
// no ticking faces); haptic on land (native only via `haptics`).
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Polygon } from 'react-native-svg';

import { TIER_LABEL } from '@shared/structure';
import type { Resolution } from '@shared/types';

import { Paper, paperShadow, tiltFor } from '@/components/board/paper';
import { Caption, EASE_OUT, haptics, TierBadge } from '@/components/ui';
import { fonts, palettes, spacing } from '@/theme';

import { signed } from './effects';
import { CardTitle } from './scene-cards';

const TICK_MS = 70;
/** A fast server still gets a visible roll. */
const MIN_ROLL_MS = 900;
/** How long the landed face stays before revealing the consequence. */
const HOLD_MS = 1800;
const THROW_MS = 560;

const randomFace = () => 1 + Math.floor(Math.random() * 20);

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export interface DiceMomentProps {
  /** The approach being attempted. */
  label: string;
  /** Null while the server is still rolling and narrating. */
  resolution: Resolution | null;
  onDone: () => void;
}

export function DiceMoment({ label, resolution, onDone }: DiceMomentProps) {
  const reduceMotion = useReduceMotion();
  const [face, setFace] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const started = useRef(0);
  const x = useSharedValue(-170);
  const lift = useSharedValue(-50);
  const spin = useSharedValue(-340);
  const wobble = useSharedValue(0);
  const scale = useSharedValue(1);

  // Thrown in from the left: it skids across the desk, spinning, then rocks on its edges while the roll is out.
  useEffect(() => {
    started.current = Date.now();
    x.set(withTiming(0, { duration: THROW_MS, easing: EASE_OUT }));
    spin.set(withTiming(0, { duration: THROW_MS, easing: EASE_OUT }));
    lift.set(withSequence(withTiming(-70, { duration: 180, easing: EASE_OUT }), withSpring(0, { damping: 9, stiffness: 240 })));
    wobble.set(
      withDelay(THROW_MS, withRepeat(withSequence(withTiming(-8, { duration: 120 }), withTiming(8, { duration: 120 })), -1, true)),
    );
    return () => cancelAnimation(wobble);
  }, [x, spin, lift, wobble]);

  // Tick through faces until the roll lands.
  useEffect(() => {
    if (landed || reduceMotion) return;
    const timer = setInterval(() => setFace(randomFace()), TICK_MS);
    return () => clearInterval(timer);
  }, [landed, reduceMotion]);

  // Land once the real roll is known and the minimum roll time has passed.
  useEffect(() => {
    if (!resolution || landed) return;
    const wait = reduceMotion ? 0 : Math.max(0, MIN_ROLL_MS - (Date.now() - started.current));
    const timer = setTimeout(() => setLanded(true), wait);
    return () => clearTimeout(timer);
  }, [resolution, landed, reduceMotion]);

  const land = useEffectEvent(() => {
    if (!resolution) return;
    setFace(resolution.roll);
    haptics.light();
    cancelAnimation(wobble);
    wobble.set(withSpring(0, { damping: 14 }));
    spin.set(withSpring(tiltFor(resolution.roll, 9), { damping: 14 }));
    scale.set(withSequence(withTiming(1.12, { duration: 110, easing: EASE_OUT }), withSpring(1, { damping: 12 })));
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`Rolled ${resolution.roll}. ${TIER_LABEL[resolution.tier]}.`);
    }
    const timer = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(timer);
  });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- landing is a one-shot reaction to the timer above
  useEffect(() => (landed ? land() : undefined), [landed]);

  const dieStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: lift.get() },
      { rotate: `${spin.get() + wobble.get()}deg` },
      { scale: scale.get() },
    ],
  }));
  // The shadow stays on the desk: it tightens as the die comes down.
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + lift.get() / 200,
    transform: [{ translateX: x.get() }, { scaleX: 1 + lift.get() / 160 }],
  }));

  const ink = palettes.paper;
  const tint = landed && resolution ? ink.tier[resolution.tier] : ink.text;

  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: palettes.desk.scrim }]} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={landed ? onDone : undefined}
        accessibilityRole="button"
        accessibilityLabel={landed ? 'Show the consequence' : 'Rolling'}
      />
      <View pointerEvents="box-none" style={styles.stage} accessibilityLiveRegion="polite">
        <View style={styles.dieArea} pointerEvents="none">
          <Animated.View style={[styles.shadow, shadowStyle]}>
            <Svg width={DIE} height={24}>
              <Ellipse cx={DIE / 2} cy={12} rx={DIE * 0.42} ry={9} fill="#000" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.die, dieStyle]}>
            <D20 />
            <Text style={[styles.face, { color: tint }]} maxFontSizeMultiplier={1} accessibilityLabel={face ? `${face}` : 'Rolling'}>
              {face ?? ''}
            </Text>
          </Animated.View>
        </View>

        <View style={[styles.slipShadow, paperShadow]}>
          <Paper style={styles.slip}>
            <CardTitle lines={2}>{label}</CardTitle>
            {landed && resolution ? (
              <>
                <Caption tone="primary" style={styles.math}>
                  Rolled {resolution.roll}
                  {resolution.modifierTotal ? `, ${signed(resolution.modifierTotal)} = ${resolution.total}` : ''} against{' '}
                  {resolution.dc}
                </Caption>
                <TierBadge tier={resolution.tier} style={styles.stamp} />
              </>
            ) : (
              <Caption style={styles.centre}>Rolling. The Director is narrating what happens…</Caption>
            )}
          </Paper>
        </View>
      </View>
    </View>
  );
}

const DIE = 136;
const C = DIE / 2;
const R = C - 4;
const r = R * 0.6;
const at = (radius: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)] as const;
};
const pts = (...ps: (readonly [number, number])[]) => ps.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

/** An icosahedron seen face-on: the front face, and the nine facets around it lit from the lamp above. */
function D20() {
  const H = (deg: number) => at(R, deg);
  const [t0, t1, t2] = [at(r, -90), at(r, 30), at(r, 150)];
  const facets: [string, string][] = [
    [pts(t0, H(-90), H(-30)), BONE.high],
    [pts(t0, H(210), H(-90)), BONE.high],
    [pts(t0, H(-30), t1), BONE.mid],
    [pts(t2, H(210), t0), BONE.mid],
    [pts(t1, H(-30), H(30)), BONE.side],
    [pts(t2, H(150), H(210)), BONE.side],
    [pts(t1, H(30), H(90)), BONE.low],
    [pts(t2, H(90), H(150)), BONE.low],
    [pts(t1, H(90), t2), BONE.low],
  ];
  return (
    <Svg width={DIE} height={DIE} style={StyleSheet.absoluteFill}>
      {facets.map(([p, fill], i) => (
        <Polygon key={i} points={p} fill={fill} stroke={BONE.edge} strokeWidth={1.2} strokeLinejoin="round" />
      ))}
      <Polygon points={pts(t0, t1, t2)} fill={BONE.face} stroke={BONE.edge} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

/** Old bone, lit from above. */
const BONE = { face: '#F1E8D4', high: '#E6DAC0', mid: '#DACBAB', side: '#CDBB97', low: '#B9A47C', edge: '#6F5E42' };

const styles = StyleSheet.create({
  scrim: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, zIndex: 10 },
  stage: { alignItems: 'center', gap: spacing.xl, width: '100%', maxWidth: 320 },
  dieArea: { width: DIE, height: DIE + 16, alignItems: 'center' },
  shadow: { position: 'absolute', bottom: 0 },
  die: { width: DIE, height: DIE, alignItems: 'center', justifyContent: 'center' },
  face: {
    fontFamily: fonts.typewriterBold,
    fontSize: 27,
    lineHeight: 32,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  slipShadow: { alignSelf: 'stretch', borderRadius: 2, transform: [{ rotate: '-1deg' }] },
  slip: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  math: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  stamp: { alignSelf: 'center' },
  centre: { textAlign: 'center' },
});
