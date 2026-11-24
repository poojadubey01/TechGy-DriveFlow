import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/hooks/haptics';
import { spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

type Props = { value: boolean; onChange: (v: boolean) => void; label: string };

/** iOS-style switch with a springy knob that squashes while travelling. */
export function Toggle({ value, onChange, label }: Props) {
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(value ? 1 : 0, spring.pop));
  }, [on, value]);

  const track = useAnimatedStyle(() => ({ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: interpolateColor(on.value, [0, 1], ['#858BA1', colors.brand]) }));
  const knob = useAnimatedStyle(() => {
    const travel = Math.min(1, Math.max(0, on.value));
    const squash = 1 + 0.25 * Math.sin(travel * Math.PI);
    return { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, transform: [{ translateX: travel * 18 }, { scaleX: squash }] };
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        haptic.select();
        onChange(!value);
      }}
    >
      <Animated.View style={track}>
        <Animated.View style={knob} />
      </Animated.View>
    </Pressable>
  );
}
