import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { type Client, thumb } from '@/data/clients';
import { cardGradients, shadow } from '@/theme/tokens';

import { PressableScale } from './ui/PressableScale';

type Props = { client: Client; index: number; onPress?: () => void };

/** Gradient client card. Each card down the stack is a lighter step from deep blue to lavender. */
export function ClientCard({ client, index, onPress }: Props) {
  const stops = cardGradients[Math.min(index, cardGradients.length - 1)]!;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={`${client.name}, ${client.meta}, ${client.photos} photos`}
      style={{ borderRadius: 24, boxShadow: index === 0 ? shadow.brandSoft : shadow.card }}
    >
      <LinearGradient
        colors={stops}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={{ height: 78, borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Image source={thumb(client.cover)} contentFit="cover" transition={250} style={{ width: 50, height: 50, borderRadius: 14 }} accessible={false} />
        <View className="flex-1 gap-0.5">
          <Text className="font-jk-semibold text-[16px] text-white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {client.name}
          </Text>
          <Text className="font-jk text-[13px] text-white/75" numberOfLines={1}>
            {client.meta}
          </Text>
        </View>
        <View className="h-[32px] justify-center rounded-full border-[1.5px] border-white/70 px-3">
          <Text className="font-jk-semibold text-[12px] text-white">{client.photos} {client.photos === 1 ? 'photo' : 'photos'}</Text>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}
