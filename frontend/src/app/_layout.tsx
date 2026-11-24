import '../../global.css';

// Per-weight imports so only the four weights we use are bundled.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashScreen } from '@/components/CrashScreen';
import { useSession } from '@/data/session';
import { goAfterSignIn, resetTo } from '@/lib/nav';
import { restoreSession } from '@/services/auth';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Any screen that crashes shows a friendly 'Something went wrong' page with Try again. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <CrashScreen {...props} />;
}

/** Screens that need a signed-in user. Welcome, sign-in/up, legal, share links and 404 stay open. */
const SIGNED_IN_ONLY = new Set([
  'home', 'chat', 'creating', 'ready', 'preview', 'edit-deck', 'templates', 'activity', 'photos', 'notifications', 'clients',
  'client', 'decks', 'profile', 'account', 'change-password', 'help', 'brand-kit', 'connect-drive', 'choose-folder', 'syncing',
]);

/**
 * Signed out (sign-out, deleted account, expired session, an old deep link): app screens go back to
 * Welcome. Signed back in at launch: Welcome is skipped.
 */
function AuthGuard() {
  const { user, status } = useSession();
  const segments = useSegments();
  const ready = !!useRootNavigationState()?.key && status === 'ready';
  const first = segments[0] ?? '';
  const launched = useRef(false);
  useEffect(() => {
    if (ready && !user && SIGNED_IN_ONLY.has(first)) resetTo('/');
  }, [first, ready, user]);
  useEffect(() => {
    if (!ready || launched.current) return;
    launched.current = true;
    if (user && first === '') goAfterSignIn();
  }, [first, ready, user]);
  return null;
}

// Check the saved sign-in once, while the splash screen is up.
void restoreSession();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const { status } = useSession();
  const booted = (loaded || !!error) && status === 'ready';

  useEffect(() => {
    if (booted) SplashScreen.hideAsync().catch(() => undefined);
  }, [booted]);

  // Keep the splash up until fonts and the saved sign-in are ready; failed fonts fall back to system fonts.
  if (!booted) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="home" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="chat" />
          <Stack.Screen name="creating" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="ready" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="preview" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="clients" />
          <Stack.Screen name="decks" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="connect-drive" />
          <Stack.Screen name="choose-folder" />
          <Stack.Screen name="syncing" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="legal" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="photos" />
          <Stack.Screen name="edit-deck" />
          <Stack.Screen name="account" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="help" />
          <Stack.Screen name="brand-kit" />
          <Stack.Screen name="templates" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="p/[slug]" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="+not-found" options={{ animation: 'fade' }} />
        </Stack>
        <AuthGuard />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
