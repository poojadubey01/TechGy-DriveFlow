import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RefreshCw } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, shadow } from '@/theme/tokens';

import { SubmitButton, TextLink } from './auth/Form';

type Props = { error: Error; retry: () => Promise<void> };

/** Times "Try again" was pressed recently (kept across crash-screen remounts). */
const recentRetries: number[] = [];
const retriedTooOften = () => recentRetries.filter((t) => Date.now() - t < 30_000).length >= 2;

function Body({ error, retry }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center px-8">
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <RefreshCw size={38} color={colors.brand} strokeWidth={1.7} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, color: colors.ink, marginTop: 24, textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">DriveFlow hit an unexpected problem. Your decks and Google Drive files are safe.</Text>
        {__DEV__ ? (
          <Text className="mt-4 text-center font-jk text-[12px] text-muted" numberOfLines={4} selectable>
            {error.message}
          </Text>
        ) : null}
      </View>
      <View className="gap-2 px-6">
        {retriedTooOften() ? (
          <SubmitButton label="Go to start" loadingLabel="" loading={false} onPress={() => router.replace('/')} />
        ) : (
          <>
            <SubmitButton
              label="Try again"
              loadingLabel=""
              loading={false}
              onPress={() => {
                recentRetries.push(Date.now());
                void retry();
              }}
            />
            <View className="items-center">
              <TextLink label="Go to start" muted onPress={() => router.replace('/')} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Friendly full-screen fallback when a screen crashes (exported as ErrorBoundary from the root layout). */
export function CrashScreen(props: Props) {
  return (
    <SafeAreaProvider>
      <Body {...props} />
    </SafeAreaProvider>
  );
}
