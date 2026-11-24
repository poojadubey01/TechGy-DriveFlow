import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import { memo } from 'react';
import { Dimensions, StyleSheet, useWindowDimensions, View } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { useLoop } from '@/hooks/useLoop';
import { duration } from '@/theme/motion';

import type { GlowBackgroundProps, GlowBlob, GlowFocus } from './types';

const TAU = Math.PI * 2;

type BlobProps = {
  blob: GlowBlob;
  index: number;
  w: number;
  h: number;
  t: SharedValue<number>;
  focus?: GlowFocus;
};

/** A single drifting, breathing light blob drawn with Skia on the UI thread. */
const Blob = memo(function Blob({ blob, index, w, h, t, focus }: BlobProps) {
  const amp = blob.drift ?? 24;
  const phase = (blob.phase ?? index * 0.27) * TAU;
  const baseX = blob.x * w;
  const baseY = blob.y * h;
  const baseR = blob.r * w;
  const follows = index === 0 && focus !== undefined;

  const cx = useDerivedValue(() => {
    const drift = baseX + amp * Math.sin(t.value * TAU + phase);
    if (!follows || !focus) return drift;
    return drift + (focus.x.value - drift) * 0.55 * focus.active.value;
  });
  const cy = useDerivedValue(() => {
    const drift = baseY + amp * 0.8 * Math.cos(t.value * TAU + phase * 1.3);
    if (!follows || !focus) return drift;
    return drift + (focus.y.value - drift) * 0.55 * focus.active.value;
  });
  const r = useDerivedValue(() => baseR * (1 + 0.06 * Math.sin(t.value * TAU * 2 + phase)));

  return (
    <Circle cx={cx} cy={cy} r={r} color={blob.color} opacity={blob.opacity ?? 1}>
      <BlurMask blur={Math.max(24, baseR * 0.38)} style="normal" />
    </Circle>
  );
});

/**
 * Animated aurora: soft brand-blue blobs that drift and breathe.
 * Purely decorative (pointerEvents none). Freezes when Reduce motion is on.
 */
export function GlowBackground({ blobs, period = duration.drift, focus, animated = false }: GlowBackgroundProps) {
  // Screens are full-window, so the glow is sized from the window itself. Measuring with onLayout
  // could catch a mid-transition size on Android and leave the glow ending in a hard line.
  const win = useWindowDimensions();
  // Android edge-to-edge draws under the navigation bar, which the window height leaves out.
  const w = win.width;
  const h = Math.max(win.height, Dimensions.get('screen').height);
  const t = useLoop(period, { enabled: animated });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas key={`${w}x${h}`} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
        {blobs.map((b, i) => (
          <Blob key={i} blob={b} index={i} w={w} h={h} t={t} focus={focus} />
        ))}
      </Canvas>
    </View>
  );
}
