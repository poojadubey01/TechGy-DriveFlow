import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { type Asset, thumb } from '@/data/clients';
import { colors } from '@/theme/tokens';

type Props = {
  /** 0 → 1 build progress, driven on the UI thread. */
  progress: SharedValue<number>;
  slides: number;
  photos: readonly Asset[];
  columns?: number;
  /** Most tiles to draw; extra slides are summed up in the last tile ("+12"). */
  maxTiles?: number;
};

function Tile({ index, slides, progress, photo }: { index: number; slides: number; progress: SharedValue<number>; photo: Asset }) {
  const start = index / slides;
  const end = (index + 1) / slides;

  // The photo fades in when its slice of progress completes.
  const done = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [Math.min(end, 0.97), Math.min(end + 0.03, 1)], [0, 1], Extrapolation.CLAMP);
    return { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: p, transform: [{ scale: interpolate(p, [0, 1], [0.86, 1]) }] };
  });
  // The "building" state shows while this tile is the one in progress.
  const building = useAnimatedStyle(() => {
    // Exactly one tile is "building" at a time: from its start until it completes.
    const on = progress.value >= start && progress.value < end ? 1 : 0;
    return { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: on };
  });

  return (
    <View style={styles.tile}>
      <View style={styles.empty} />
      <Animated.View style={building}>
        <LinearGradient colors={[colors.brand, '#9AA5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        <View style={styles.center}>
          <Text className="font-jk-semibold text-[11px] text-white">Building…</Text>
        </View>
      </Animated.View>
      <Animated.View style={done}>
        <Image source={thumb(photo)} style={styles.fill} contentFit="cover" transition={0} accessible={false} />
        <View style={styles.tick}>
          <Check size={10} color={colors.brandDeep} strokeWidth={3.4} />
        </View>
      </Animated.View>
    </View>
  );
}

/** The deck filling up slide by slide while the AI builds it. */
export function SlideGrid({ progress, slides, photos, columns = 4, maxTiles = 12 }: Props) {
  const shown = Math.min(slides, maxTiles);
  const hidden = slides - shown;
  const rows: number[][] = [];
  for (let i = 0; i < shown; i += columns) rows.push(Array.from({ length: Math.min(columns, shown - i) }, (_, k) => i + k));
  return (
    <View className="gap-2" accessibilityLabel={`Building ${slides} slides`}>
      {rows.map((row, r) => (
        <View key={r} className="flex-row gap-2">
          {row.map((i) =>
            hidden > 0 && i === shown - 1 ? (
              <View key={i} style={[styles.tile, styles.more]} accessible accessibilityLabel={`and ${hidden + 1} more slides`}>
                <Text className="font-jk-semibold text-[13px] text-brand-deep">+{hidden + 1}</Text>
              </View>
            ) : (
              <Tile key={i} index={i} slides={shown - (hidden > 0 ? 1 : 0)} progress={progress} photo={photos[i % photos.length]!} />
            ),
          )}
          {row.length < columns && Array.from({ length: columns - row.length }, (_, k) => <View key={`pad${k}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, height: 56, borderRadius: 12 },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1.5, borderColor: '#C3CAFF' },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 12 },
  center: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  empty: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C3CAFF', backgroundColor: 'rgba(255,255,255,0.5)' },
  tick: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
