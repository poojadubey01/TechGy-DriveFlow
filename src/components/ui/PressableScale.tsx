import type { ReactNode } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/hooks/haptics';
import { spring } from '@/theme/motion';

type Feedback = keyof typeof haptic | 'none';

export type PressableScaleProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Scale while held (0.96 default). */
  scaleTo?: number;
  feedback?: Feedback;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'radio' | 'checkbox' | 'switch';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  /** Classes for the visible surface (background, radius, padding). */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Classes / style for the outer touch area (flex sizing in rows). */
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

/**
 * Spring-press micro-interaction with haptics.
 * The scale runs on the UI thread; the surface is a plain View so NativeWind classes always apply.
 */
export function PressableScale({
  children,
  onPress,
  scaleTo = 0.97,
  feedback = 'tap',
  disabled = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  className,
  style,
  containerClassName,
  containerStyle,
  hitSlop = 6,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      className={containerClassName}
      style={containerStyle}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      onPressIn={() => {
        scale.set(withSpring(scaleTo, spring.press));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, spring.press));
      }}
      onPress={() => {
        if (feedback !== 'none') haptic[feedback]();
        onPress?.();
      }}
    >
      <Animated.View style={animated}>
        <View className={className} style={[disabled ? { opacity: 0.5 } : null, style]}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}
