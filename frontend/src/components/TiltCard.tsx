import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/hooks/haptics';
import { spring } from '@/theme/motion';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; maxTilt?: number; height: number };

/**
 * Interactive 3D card: drag a finger across it and it tilts toward the touch with real perspective,
 * then springs back elastically on release. Disabled when Reduce motion is on.
 */
export function TiltCard({ children, style, maxTilt = 10, height }: Props) {
  const reduce = useReducedMotion();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const lift = useSharedValue(0);

  const pan = usePanGesture({
    enabled: !reduce,
    minDistance: 0,
    onBegin: () => {
      'worklet';
      lift.set(withSpring(1, spring.settle));
      scheduleOnRN(haptic.tap);
    },
    onUpdate: (e) => {
      'worklet';
      ry.set(interpolate(e.translationX, [-160, 160], [-maxTilt, maxTilt], 'clamp'));
      rx.set(interpolate(e.translationY, [-height / 2, height / 2], [maxTilt, -maxTilt], 'clamp'));
    },
    onFinalize: () => {
      'worklet';
      rx.set(withSpring(0, spring.elastic));
      ry.set(withSpring(0, spring.elastic));
      lift.set(withSpring(0, spring.settle));
    },
  });

  const animated = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
      { scale: 1 + lift.value * 0.02 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animated} accessibilityHint="Drag to tilt the cover">
        <View style={style}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}
