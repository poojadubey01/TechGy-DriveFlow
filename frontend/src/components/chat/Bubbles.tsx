import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { useLoop } from '@/hooks/useLoop';
import { enter } from '@/theme/motion';
import { colors, shadow } from '@/theme/tokens';

const logo = require('../../../assets/images/logo-blue.png');

export function AiAvatar() {
  return (
    <View className="h-[34px] w-[34px] items-center justify-center rounded-xl bg-card" style={{ boxShadow: shadow.soft }}>
      <Image source={logo} style={{ width: 20, height: 20 }} contentFit="contain" accessible={false} />
    </View>
  );
}

/** Assistant message: avatar + white card. Children may include extra content (photo strip). */
export function AiBubble({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <Animated.View entering={enter.fade()} style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
      <View className="flex-row items-start gap-2.5">
        <AiAvatar />
        <View className="flex-shrink rounded-[22px] rounded-bl-lg bg-card px-4 py-3.5" style={{ boxShadow: shadow.card }}>
          <Text className="font-jk text-[15px] leading-[22px] text-ink">{children}</Text>
          {extra}
        </View>
      </View>
    </Animated.View>
  );
}

/** The user's own message: brand-blue bubble on the right. */
export function MeBubble({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={enter.fade()} style={{ alignSelf: 'flex-end', maxWidth: '86%' }}>
      <View className="rounded-[22px] rounded-br-lg bg-brand px-4 py-3" style={{ boxShadow: shadow.brandSoft }}>
        <Text className="font-jk text-[15px] leading-[22px] text-white">{children}</Text>
      </View>
    </Animated.View>
  );
}

function Dot({ index }: { index: number }) {
  const t = useLoop(900);
  const style = useAnimatedStyle(() => {
    const p = (t.value + index * 0.18) % 1;
    return {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.brand,
      opacity: interpolate(p, [0, 0.3, 0.6, 1], [0.35, 1, 0.35, 0.35]),
      transform: [{ translateY: interpolate(p, [0, 0.3, 0.6, 1], [0, -4, 0, 0]) }],
    };
  });
  return <Animated.View style={style} />;
}

/** "AI is thinking" indicator. */
export function TypingBubble() {
  return (
    <Animated.View entering={enter.fade()} style={{ alignSelf: 'flex-start' }} accessibilityLabel="DriveFlow is typing">
      <View className="flex-row items-end gap-2.5">
        <AiAvatar />
        <View className="h-11 flex-row items-center gap-1.5 rounded-[22px] rounded-bl-lg bg-card px-4" style={{ boxShadow: shadow.card }}>
          {[0, 1, 2].map((i) => (
            <Dot key={i} index={i} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/** Inline highlighted @mention inside a Text. */
export function Mention({ name, onDark }: { name: string; onDark?: boolean }) {
  return (
    <Text className={`font-jk-semibold ${onDark ? 'text-white underline' : 'text-brand-deep'}`}>@{name}</Text>
  );
}
