// Tactile press: surfaces give under your finger (scale 0.98), quick in, quicker out. Android keeps its ripple
// instead, which is the platform's own press language. With a pointer, anything you can press lifts toward the lamp
// as the cursor arrives, so interactive paper reads differently from paper that is only pinned up. Reanimated
// follows the system reduce-motion setting.
import type { ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Strong ease-out: starts fast so the interface feels like it heard you. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCALES = Platform.OS !== 'android';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({ children, style, onPressIn, onPressOut, onHoverIn, onHoverOut, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const pressed = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }, { scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      onHoverIn={(e) => {
        if (!props.disabled) lift.set(withTiming(-2, { duration: 180, easing: EASE_OUT }));
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        lift.set(withTiming(0, { duration: 220, easing: EASE_OUT }));
        onHoverOut?.(e);
      }}
      onPressIn={(e) => {
        if (SCALES) scale.set(withTiming(0.98, { duration: 120, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (SCALES) scale.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
      style={[style, pressed]}>
      {children}
    </AnimatedPressable>
  );
}
