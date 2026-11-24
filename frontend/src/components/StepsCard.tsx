import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { colors, fonts, shadow } from '@/theme/tokens';

export type Step = { label: string; at: number };

type Props = { progress: SharedValue<number>; steps: readonly Step[]; built: number; slides: number };

function StepRow({ step, next, progress }: { step: Step; next: number; progress: SharedValue<number> }) {
  const tick = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [next - 0.001, next + 0.03], [0, 1], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: p,
      transform: [{ scale: interpolate(p, [0, 0.6, 1], [0.4, 1.15, 1]) }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const activeNow = progress.value >= step.at && progress.value < next ? 1 : 0;
    return { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white, opacity: activeNow };
  });
  const label = useAnimatedStyle(() => ({ fontFamily: fonts.regular, fontSize: 14, color: colors.white, opacity: progress.value >= step.at ? 1 : 0.55 }));

  return (
    <View className="flex-row items-center gap-3">
      <View className="h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white/45">
        <Animated.View style={ring} />
        <Animated.View style={tick}>
          <Check size={12} color={colors.brand} strokeWidth={3.2} />
        </Animated.View>
      </View>
      <Animated.Text style={label}>{step.label}</Animated.Text>
    </View>
  );
}

/** Blue "build steps" card: progress bar plus a checklist that ticks itself off. */
export function StepsCard({ progress, steps, built, slides }: Props) {
  const bar = useAnimatedStyle(() => ({ height: 6, borderRadius: 3, backgroundColor: colors.white, width: `${Math.round(progress.value * 1000) / 10}%` }));
  return (
    <View style={{ borderRadius: 28, boxShadow: shadow.brand }}>
      <LinearGradient
        colors={['#2A40FF', '#5567FF', '#7B88FF']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: 28, padding: 22 }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-jk-semibold text-[17px] text-white">Build steps</Text>
          <Text className="font-jk text-[13px] text-white/75">
            {built} of {slides} slides
          </Text>
        </View>
        <View className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/25">
          <Animated.View style={bar} />
        </View>
        <View className="mt-4 gap-3">
          {steps.map((s, i) => (
            <StepRow key={s.label} step={s} next={steps[i + 1]?.at ?? 1} progress={progress} />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}
