import { memo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useLoop } from '@/hooks/useLoop';
import { duration } from '@/theme/motion';

import type { GlowBackgroundProps, GlowBlob, GlowFocus } from './types';

/**
 * Web version of the aurora (the browser preview has no Skia canvas loaded):
 * the same blobs as blurred, animated views.
 */
const TAU = Math.PI * 2;

type BlobProps = { blob: GlowBlob; index: number; w: number; h: number; t: SharedValue<number>; focus?: GlowFocus };

const Blob = memo(function Blob({ blob, index, w, h, t, focus }: BlobProps) {
  const amp = blob.drift ?? 24;
  const phase = (blob.phase ?? index * 0.27) * TAU;
  const r = blob.r * w;
  const baseX = blob.x * w;
  const baseY = blob.y * h;
  const follows = index === 0 && focus !== undefined;

  const style = useAnimatedStyle(() => {
    let x = baseX + amp * Math.sin(t.value * TAU + phase);
    let y = baseY + amp * 0.8 * Math.cos(t.value * TAU + phase * 1.3);
    if (follows && focus) {
      x += (focus.x.value - x) * 0.55 * focus.active.value;
      y += (focus.y.value - y) * 0.55 * focus.active.value;
    }
    const s = 1 + 0.06 * Math.sin(t.value * TAU * 2 + phase);
    return { transform: [{ translateX: x - r }, { translateY: y - r }, { scale: s }] };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: blob.color,
          opacity: blob.opacity ?? 1,
          filter: `blur(${Math.round(Math.max(24, r * 0.38))}px)`,
        },
        style,
      ]}
    />
  );
});

export function GlowBackground({ blobs, period = duration.drift, focus, animated = false }: GlowBackgroundProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const t = useLoop(period, { enabled: animated });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={onLayout}>
      {size.w > 0 && blobs.map((b, i) => <Blob key={i} blob={b} index={i} w={size.w} h={size.h} t={t} focus={focus} />)}
    </View>
  );
}
