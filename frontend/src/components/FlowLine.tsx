import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { easing, enter } from '@/theme/motion';
import { colors, fonts } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Design space the illustration is drawn in; it is scaled to the screen width. */
const DESIGN_W = 390;
const DESIGN_H = 230;
const LINE = 'M-10 70 C 30 40, 60 30, 86 72 C 112 116, 120 196, 160 190 C 200 184, 190 120, 236 118 C 280 116, 300 70, 340 34';
const ARROW = 'M318 32 L342 32 L342 56';
const LENGTH = 560;

/**
 * Label anchors in design space (same as the FigCraft frame):
 * "Create portfolio" sits on the first rise, above node 1; "Branded proposal" ends just
 * before the arrow head; "Quick deck" sits right of node 2.
 */
const LABELS = [
  { text: 'Create portfolio', x: 36, y: 24, tone: 'light' as const, anchor: 'left' as const },
  { text: 'Branded proposal', x: 306, y: 16, tone: 'light' as const, anchor: 'right' as const },
  { text: 'Quick deck', x: 256, y: 118, tone: 'brand' as const, anchor: 'left' as const },
];
/** Dots on the curve: under "Create portfolio", beside "Quick deck", and under "Branded proposal" near the arrow. */
const NODES = [
  { x: 86, y: 72, delay: 700 },
  { x: 236, y: 118, delay: 1250 },
  { x: 313, y: 62, delay: 1600 },
];

/** A static dot on the line (fades in once when the line reaches it). x/y are screen pixels. */
function Node({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <Animated.View entering={enter.fade(0, delay)} style={{ position: 'absolute', left: x - 14, top: y - 14, width: 28, height: 28 }}>
      <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}>
        <View className="h-3.5 w-3.5 rounded-full bg-white" />
      </View>
    </Animated.View>
  );
}

/** React Native draws filter blur on Android and web; on iOS the label just fades and settles in. */
const SETTLED = { padding: 16, margin: -16 } as const;
const CAN_BLUR = Platform.OS !== 'ios';

/**
 * Small feature label. Static once shown (no floating); it appears once with a soft blur-in.
 * The pill itself is a plain View so its background and shadow always render.
 */
function Label({ text, x, y, tone, anchor, index, width, k }: (typeof LABELS)[number] & { index: number; width: number; k: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  // Once the blur-in has finished, the filtered layer is removed so nothing clips the pill or its shadow.
  const [settled, setSettled] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    p.set(
      withDelay(
        1500 + index * 160,
        withTiming(1, { duration: 700, easing: easing.out }, (done) => {
          'worklet';
          if (done) scheduleOnRN(setSettled, true);
        }),
      ),
    );
  }, [index, p, reduce]);

  const reveal = useAnimatedStyle(() => {
    // Padding (cancelled by the negative margin) gives the blur and shadow room to draw.
    const base = { padding: 16, margin: -16, opacity: p.value, transform: [{ scale: interpolate(p.value, [0, 1], [1.06, 1]) }] };
    return CAN_BLUR ? { ...base, filter: `blur(${((1 - p.value) * 8).toFixed(2)}px)` } : base;
  });

  const brand = tone === 'brand';
  return (
    // A plain absolutely-positioned View pins the pill to its point on the curve (and keeps it
    // only as wide as its text). Only the inner layer is animated (the one-time blur-in).
    <View pointerEvents="none" style={[{ position: 'absolute', top: y, flexDirection: 'row' }, anchor === 'right' ? { right: width - x } : { left: x }]}>
      <Animated.View style={settled ? SETTLED : reveal}>
        {/* Same spec as the FigCraft label: 24 px pill, 12 px radius, 10 px padding, 11 px text, soft shadow. */}
        <View
          style={{
            height: 24 * k,
            paddingHorizontal: 10 * k,
            borderRadius: 12 * k,
            justifyContent: 'center',
            alignSelf: 'flex-start',
            backgroundColor: brand ? colors.brand : colors.white,
            boxShadow: brand ? '0px 8px 20px rgba(0, 34, 255, 0.24)' : '0px 8px 20px rgba(28, 40, 120, 0.12)',
          }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontFamily: fonts.medium,
              fontSize: 11 * k,
              lineHeight: 14 * k,
              includeFontPadding: false,
              color: brand ? colors.white : colors.brandDeep,
            }}
          >
            {text}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** The welcome illustration: a line that draws itself, three dots, and three small feature labels. */
export function FlowLine({ width }: { width: number }) {
  const reduce = useReducedMotion();
  const draw = useSharedValue(reduce ? 1 : 0);
  const scale = width / DESIGN_W;
  // Labels follow the screen size too (within limits) so they keep the design's proportions.
  const labelScale = Math.min(1.1, Math.max(0.85, scale));

  useEffect(() => {
    if (reduce) return;
    draw.set(withDelay(350, withTiming(1, { duration: 1400, easing: easing.out })));
  }, [draw, reduce]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - draw.value) }));
  const arrowProps = useAnimatedProps(() => ({ opacity: interpolate(draw.value, [0.85, 1], [0, 1], 'clamp') }));

  // The SVG scales the curve through its viewBox; nodes and labels are placed at the same
  // design coordinates × scale, so they always sit on the line at any screen width.
  // Labels keep their real size (11 px text) instead of being stretched.
  const height = DESIGN_H * scale;
  return (
    <View pointerEvents="none" style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} fill="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <AnimatedPath d={LINE} stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={[LENGTH, LENGTH]} animatedProps={lineProps} />
        <AnimatedPath d={ARROW} stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" animatedProps={arrowProps} />
      </Svg>
      {NODES.map((n) => (
        <Node key={n.x} x={n.x * scale} y={n.y * scale} delay={n.delay} />
      ))}
      {LABELS.map((l, i) => (
        <Label key={l.text} {...l} x={l.x * scale} y={l.y * scale} index={i} width={width} k={labelScale} />
      ))}
    </View>
  );
}
