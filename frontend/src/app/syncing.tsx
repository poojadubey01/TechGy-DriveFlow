import { router, useLocalSearchParams } from 'expo-router';
import { Check, PartyPopper } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AuthShell } from '@/components/auth/AuthShell';
import { StepDots, SubmitButton } from '@/components/auth/Form';
import { setDrive } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { resetTo } from '@/lib/nav';
import { easing } from '@/theme/motion';
import { colors, fonts, shadow } from '@/theme/tokens';

const SYNC_MS = 4500;

function toNumber(v: string | string[] | undefined, fallback: number) {
  const n = Number.parseInt(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Onboarding 3/3 — sync the chosen folder, then finish. */
export default function Syncing() {
  const params = useLocalSearchParams<{ folder?: string; clients?: string; photos?: string; from?: string }>();
  const folder = typeof params.folder === 'string' && params.folder ? params.folder : 'Projects';
  const clients = toNumber(params.clients, 4);
  const photos = toNumber(params.photos, 320);
  const fromProfile = params.from === 'profile';

  const progress = useSharedValue(0);
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const finish = () => {
      setDrive({ folder, lastSync: 'Just now' });
      haptic.success();
      setDone(true);
    };
    progress.set(
      withTiming(1, { duration: SYNC_MS, easing: easing.inOut }, (ok) => {
        'worklet';
        if (ok) scheduleOnRN(finish);
      }),
    );
    return () => cancelAnimation(progress);
  }, [folder, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setPercent, v);
    },
  );

  const bar = useAnimatedStyle(() => ({ height: 8, borderRadius: 4, backgroundColor: colors.brand, width: `${Math.round(progress.value * 1000) / 10}%` }));

  const steps = [
    { label: `Reading the “${folder}” folder`, at: 0 },
    { label: `Found ${clients} client folders`, at: 30 },
    { label: `Indexing ${photos.toLocaleString('en-IN')} photos`, at: 55 },
    { label: 'Building your client list', at: 85 },
  ];

  const leave = () => {
    if (fromProfile) {
      router.dismissTo('/profile');
      return;
    }
    resetTo('/home');
  };

  if (done) {
    return (
      <AuthShell
        noBack
        eyebrow={fromProfile ? undefined : <StepDots step={3} />}
        title="You're all set"
        subtitle={`${clients} clients and ${photos.toLocaleString('en-IN')} photos from “${folder}” are ready to use.`}
        footer={<SubmitButton label={fromProfile ? 'Done' : 'Start creating'} loadingLabel="" loading={false} onPress={leave} />}
      >
        <View className="items-center">
          <View style={{ width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, boxShadow: shadow.brand }}>
            <PartyPopper size={44} color={colors.white} strokeWidth={1.7} />
          </View>
          <Text className="mt-6 text-center font-jk text-[14px] leading-[21px] text-muted">
            New photos you add to this folder are picked up automatically.
          </Text>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell noBack eyebrow={fromProfile ? undefined : <StepDots step={3} />} title="Syncing your Drive" subtitle="This takes a few seconds. Keep this screen open.">
      <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.card, boxShadow: shadow.card }} accessibilityLabel={`${percent} percent synced`}>
        <View className="flex-row items-baseline">
          <Text style={{ fontFamily: fonts.semibold, fontSize: 52, lineHeight: 58, letterSpacing: -1.5, color: colors.ink, fontVariant: ['tabular-nums'] }}>{percent}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.inkSoft, marginLeft: 4 }}>%</Text>
        </View>
        <View style={{ marginTop: 12, height: 8, borderRadius: 4, backgroundColor: colors.sky, overflow: 'hidden' }}>
          <Animated.View style={bar} />
        </View>
        <View className="mt-5 gap-3.5">
          {steps.map((s, i) => {
            const next = steps[i + 1]?.at ?? 100;
            const isDone = percent >= next;
            const isNow = percent >= s.at && !isDone;
            return (
              <View key={s.label} className="flex-row items-center gap-3">
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isDone ? 0 : 2,
                    borderColor: isNow ? colors.brand : colors.edge,
                    backgroundColor: isDone ? colors.brand : 'transparent',
                  }}
                >
                  {isDone ? <Check size={13} color={colors.white} strokeWidth={3.2} /> : isNow ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
                </View>
                <Text className={`flex-1 text-[14px] ${percent >= s.at ? 'font-jk-semibold text-ink' : 'font-jk text-muted'}`}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </AuthShell>
  );
}
