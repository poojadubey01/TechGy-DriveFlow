import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, glow } from '@/theme/tokens';

import { GlowBackground } from '../glow/GlowBackground';
import type { GlowBlob } from '../glow/types';
import { IconButton } from '../ui/Button';
import { FadeEdges } from '../FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.3, y: -0.08, r: 0.62, color: glow.peri, opacity: 0.7 },
  { x: 0.95, y: 0.05, r: 0.42, color: glow.mist },
];

const logo = require('../../../assets/images/logo-blue.png');

type Props = {
  title: string;
  subtitle?: string;
  /** Shown above the title (e.g. step dots). */
  eyebrow?: ReactNode;
  /** Hide the back button (first step of a flow). */
  noBack?: boolean;
  children: ReactNode;
  /** Pinned at the bottom (main action or footer link). */
  footer?: ReactNode;
};

/** Layout for sign-in, sign-up and onboarding: soft glow, logo, big title, keyboard-aware form. */
export function AuthShell({ title, subtitle, eyebrow, noBack, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      {/* 'padding' on both platforms: with Android edge-to-edge the window no longer resizes for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View className="flex-row items-center justify-between px-5" style={{ paddingTop: insets.top + 10, height: insets.top + 54 }}>
          {noBack ? (
            <View style={{ width: 44 }} />
          ) : (
            <IconButton icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          )}
          <View className="flex-row items-center gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image source={logo} style={{ width: 24, height: 24 }} contentFit="contain" />
            <Text className="font-jk-bold text-[16px] text-ink">DriveFlow</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <FadeEdges start={16} end={20}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {eyebrow ? <View className="mb-4">{eyebrow}</View> : null}
          <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: colors.ink }}>
            {title}
          </Text>
          {subtitle ? <Text className="mt-2 font-jk text-[15px] leading-[22px] text-ink-soft">{subtitle}</Text> : null}
          <View className="mt-7">{children}</View>
        </ScrollView>
        </FadeEdges>

        {footer ? (
          <View className="px-6 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
