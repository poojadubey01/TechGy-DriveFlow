import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';

import type { Client } from '@/data/clients';
import { enter } from '@/theme/motion';
import { colors, shadow } from '@/theme/tokens';

import { PressableScale } from '../ui/PressableScale';

type Props = { matches: readonly Client[]; highlightId?: string; onPick: (c: Client) => void };

/** The @ picker: a white sheet above the composer, filtered as you type. */
export function MentionSheet({ matches, highlightId, onPick }: Props) {
  return (
    <Animated.View
      entering={enter.fade()}
      exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
      accessibilityLabel="Tag a client"
    >
      <View className="rounded-[28px] bg-card px-3 pb-3 pt-4" style={{ boxShadow: shadow.lift }}>
      <View className="flex-row justify-between px-2 pb-3">
        <Text className="font-jk-semibold text-[12px] uppercase tracking-[1.2px] text-muted">Tag a client</Text>
        <Text className="font-jk text-[12px] text-muted">
          {matches.length} {matches.length === 1 ? 'client' : 'clients'}
        </Text>
      </View>
      {matches.length === 0 ? (
        <Text className="px-2 pb-2 font-jk text-[14px] text-muted">No client matches that name.</Text>
      ) : (
        matches.map((c, i) => {
          const hi = c.id === highlightId || (!highlightId && i === 0);
          return (
            <View key={c.id}>
              <PressableScale onPress={() => onPick(c)} feedback="select" scaleTo={0.98} accessibilityLabel={`Tag ${c.name}`}>
                {hi ? (
                  <LinearGradient
                    colors={['#1F37FF', '#4A5EFF']}
                    start={{ x: 0, y: 0.3 }}
                    end={{ x: 1, y: 0.7 }}
                    style={{ height: 64, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <Image source={c.cover} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" accessible={false} />
                    <View className="flex-1">
                      <Text className="font-jk-semibold text-[15px] text-white">{c.name}</Text>
                      <Text className="font-jk text-[12px] text-white/75">
                        {c.meta} · {c.photos} photos
                      </Text>
                    </View>
                    <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-white">
                      <Check size={14} color={colors.brandDeep} strokeWidth={3} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View className="h-16 flex-row items-center gap-3 px-3">
                    <Image source={c.cover} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" accessible={false} />
                    <View className="flex-1">
                      <Text className="font-jk-semibold text-[15px] text-ink">{c.name}</Text>
                      <Text className="font-jk text-[12px] text-muted">
                        {c.meta} · {c.photos} photos
                      </Text>
                    </View>
                  </View>
                )}
              </PressableScale>
            </View>
          );
        })
      )}
    </View></Animated.View>
  );
}
