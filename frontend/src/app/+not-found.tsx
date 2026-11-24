import { router, useCanGoBack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Compass } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SubmitButton, TextLink } from '@/components/auth/Form';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { useSession } from '@/data/session';
import { resetTo } from '@/lib/nav';
import { colors, fonts, glow, shadow } from '@/theme/tokens';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.3, y: -0.08, r: 0.62, color: glow.peri, opacity: 0.7 },
  { x: 0.95, y: 0.05, r: 0.42, color: glow.mist },
];

/** Page not found — for old links and bad deep links. */
export default function NotFound() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const canGoBack = useCanGoBack();
  const goHome = () => resetTo(user ? '/home' : '/');

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="flex-1 items-center justify-center px-8">
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Compass size={42} color={colors.brand} strokeWidth={1.6} />
        </View>
        <Text className="mt-6 font-jk-semibold text-[13px] uppercase tracking-[1.2px] text-brand-deep">Error 404</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, marginTop: 6, textAlign: 'center' }}>
          This page wandered off
        </Text>
        <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">The link may be old, or the page has moved. Your decks and photos are safe.</Text>
      </View>
      <View className="gap-2 px-6">
        <SubmitButton label={user ? 'Go to home' : 'Go to start'} loadingLabel="" loading={false} onPress={goHome} />
        {canGoBack ? (
          <View className="items-center">
            <TextLink label="Go back" muted onPress={() => router.back()} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
