import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlowLine } from '@/components/FlowLine';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { KineticHeadline } from '@/components/KineticHeadline';
import { TextLink } from '@/components/auth/Form';
import { PillButton } from '@/components/ui/Button';
import { errorMessage } from '@/api/client';
import { showError } from '@/lib/confirm';
import { goAfterSignIn } from '@/lib/nav';
import { signInWithGoogle } from '@/services/auth';
import { colors, fonts, glow } from '@/theme/tokens';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.41, y: -0.02, r: 0.66, color: glow.deep, drift: 26 },
  { x: 0.88, y: 0.27, r: 0.46, color: glow.peri, drift: 34, phase: 0.35 },
  { x: 0.08, y: 0.36, r: 0.36, color: glow.haze, drift: 28, phase: 0.7 },
];

const logoWhite = require('../../assets/images/logo-white.png');

/** 01 Welcome — drifting aurora you can drag around, a self-drawing flow line and a kinetic headline. */
export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 720;
  const headline = Math.min(compact ? 56 : 68, Math.round(width * 0.175));
  const [connecting, setConnecting] = useState(false);

  // Google sign-in, then Drive onboarding unless it's already set up.
  const continueWithGoogle = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      await signInWithGoogle();
      goAfterSignIn();
    } catch (e) {
      showError('Google sign-in didn’t work', errorMessage(e));
    } finally {
      setConnecting(false);
    }
  };

  // Touch-reactive light: the main blob leans toward your finger while you drag on the hero.
  const fx = useSharedValue(width / 2);
  const fy = useSharedValue(height * 0.2);
  const active = useSharedValue(0);
  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      fx.set(e.x);
      fy.set(e.y);
      active.set(withTiming(1, { duration: 300 }));
    },
    onUpdate: (e) => {
      'worklet';
      fx.set(e.x);
      fy.set(e.y);
    },
    onFinalize: () => {
      'worklet';
      active.set(withTiming(0, { duration: 900 }));
    },
  });

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="light" />
      <GlowBackground blobs={BLOBS} focus={{ x: fx, y: fy, active }} animated />

      <GestureDetector gesture={pan}>
        <View style={{ paddingTop: insets.top + 14 }}>
          <View className="flex-row items-center justify-between px-6">
            <View className="flex-row items-center gap-2.5">
              <Image source={logoWhite} style={{ width: 30, height: 30 }} contentFit="contain" accessible={false} />
              <Text className="font-jk-bold text-[19px] tracking-[-0.3px] text-white">DriveFlow</Text>
            </View>
            <View className="h-6 justify-center rounded-full bg-white/20 px-2.5">
              <Text className="font-jk-semibold text-[12px] text-white">by TechGy Link</Text>
            </View>
          </View>
          {/* Places the illustration 120 px below the safe area, as in the FigCraft frame. */}
          <View style={{ marginTop: compact ? 44 : 76 }}>
            <FlowLine width={width} />
          </View>
        </View>
      </GestureDetector>

      <View className="flex-1 justify-end px-6" style={{ paddingBottom: insets.bottom + 18 }}>
        <KineticHeadline lines={['Tag.', 'Ask.', 'Create.']} size={headline} lineHeight={Math.round(headline * 1.03)} />
        <Animated.Text
          style={{ marginTop: 20, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}
        >
          Tag a client, answer three quick questions, and get a branded deck from your Drive.
        </Animated.Text>

        <Animated.View style={{ marginTop: compact ? 24 : 40 }}>
          <PillButton
            label={connecting ? 'Connecting…' : 'Continue with Google'}
            disabled={connecting}
            onPress={continueWithGoogle}
            leading={
              <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-white">
                <Text className="font-jk-bold text-[16px] text-brand-deep">G</Text>
              </View>
            }
          />
        </Animated.View>
        <View className="mt-2 flex-row items-center justify-center gap-3">
          <TextLink label="Sign in with email" muted onPress={() => router.push('/sign-in')} />
          <View style={{ width: 1, height: 14, backgroundColor: colors.edge }} />
          <TextLink label="Create account" onPress={() => router.push('/sign-up')} />
        </View>
      </View>
    </View>
  );
}
