import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { spring } from '@/theme/motion';
import { colors, fonts } from '@/theme/tokens';

type Props = {
  lines: readonly string[];
  size?: number;
  lineHeight?: number;
  delay?: number;
  color?: string;
};

function Line({ text, index, size, lineHeight, delay, color }: { text: string; index: number; size: number; lineHeight: number; delay: number; color: string }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    p.set(withDelay(delay + index * 120, withSpring(1, spring.settle)));
  }, [delay, index, p, reduce]);

  // No clipping mask: each line rises and fades in, so descenders (g, y, p) are never cut off.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5, 1], [0, 1, 1]),
    transform: [{ translateY: interpolate(p.value, [0, 1], [lineHeight * 0.35, 0]) }],
  }));

  return (
    <View style={{ height: lineHeight, overflow: 'visible' }}>
      <Animated.View style={style}>
        <Text
          accessible={false}
          // Android clips glyphs that hang below a tight line height (the "g" in "Tag."):
          // bottom padding gives descenders room, the negative margin keeps the spacing.
          style={{
            fontFamily: fonts.semibold,
            fontSize: size,
            lineHeight,
            letterSpacing: -size * 0.038,
            color,
            paddingBottom: Math.round(size * 0.3),
            marginBottom: -Math.round(size * 0.3),
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Big headline whose lines rise and fade in, one after another. */
export function KineticHeadline({ lines, size = 68, lineHeight = 70, delay = 250, color = colors.ink }: Props) {
  return (
    <View accessible focusable={false} accessibilityRole="header" accessibilityLabel={lines.join(' ')}>
      {lines.map((l, i) => (
        <Line key={l + i} text={l} index={i} size={size} lineHeight={lineHeight} delay={delay} color={color} />
      ))}
    </View>
  );
}
