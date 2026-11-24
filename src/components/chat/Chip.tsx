import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

import { PressableScale } from '../ui/PressableScale';

type Props = { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void };

/** Answer chip: white outline, fills brand blue when chosen (colour cross-fades on the UI thread). */
export function Chip({ label, selected = false, disabled, onPress }: Props) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: duration.base }));
  }, [on, selected]);

  const surface = useAnimatedStyle(() => ({
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.card, colors.brand]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.edge, colors.brand]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled && !selected}
      feedback="select"
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Animated.View style={surface}>
        <Text className={`font-jk-semibold text-[14px] ${selected ? 'text-white' : 'text-brand-deep'}`}>{label}</Text>
      </Animated.View>
    </PressableScale>
  );
}
