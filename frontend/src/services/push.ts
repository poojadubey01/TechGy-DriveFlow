/**
 * Push notifications (deck ready, client opened a deck, new Drive photos) through Expo's push
 * service. The API sends them; this file registers the phone and opens the right screen on tap.
 *
 * Needs a development or store build with an EAS project ID (`npx eas-cli init` adds it to
 * app.json). Expo Go on Android can't receive remote pushes (removed in SDK 53), and the web app
 * doesn't use them; in those cases registering quietly does nothing and in-app notifications
 * still work as before.
 */
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { loadNotifications, markRead } from '@/data/app';
import { useSession } from '@/data/session';

export type PushStatus = 'registered' | 'unsupported' | 'no-project' | 'denied';

let registeredToken: string | null = null;

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Whether this build can receive remote pushes at all. */
export function pushSupported() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && isRunningInExpoGo()) return false;
  if (Platform.OS === 'ios' && !Device.isDevice) return false; // the iOS simulator has no push
  return true;
}

/** Asks for permission (once) and registers this phone with the API. Safe to call on every sign-in. */
export async function registerForPush(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  const id = projectId();
  if (!id) return 'no-project';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'DriveFlow', importance: AndroidImportance.HIGH });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  await api('/me/push-tokens', { method: 'POST', body: { token, platform: Platform.OS } });
  registeredToken = token;
  return 'registered';
}

/** Stops pushes to this phone (called before signing out). */
export async function unregisterPush() {
  const token = registeredToken;
  registeredToken = null;
  if (token) await api('/me/push-tokens', { method: 'DELETE', body: { token } }).catch(() => undefined);
}

// While the app is open: still show the banner, and refresh the in-app list behind it.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      loadNotifications().catch(() => undefined);
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

type PushData = { notificationId?: string; target?: { pathname: string; params?: Record<string, string> } };

/**
 * Opens the screen a tapped push points to (also when the tap started the app), once the person
 * is signed in. Mount once, in the root layout.
 */
export function usePushTaps() {
  const response = Notifications.useLastNotificationResponse();
  const { user, status } = useSession();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || status !== 'ready' || !user) return;
    const key = response.notification.request.identifier;
    if (handled.current === key) return;
    handled.current = key;
    const data = response.notification.request.content.data as PushData | undefined;
    if (data?.notificationId) markRead(data.notificationId);
    if (data?.target?.pathname) router.push({ pathname: data.target.pathname, params: data.target.params ?? {} } as Href);
  }, [response, status, user]);
}
