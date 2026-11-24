/**
 * Web version of services/push.ts: browsers don't get DriveFlow push notifications (the in-app
 * list still works), and expo-notifications' native calls don't exist on web, so these do nothing.
 */
export type PushStatus = 'registered' | 'unsupported' | 'no-project' | 'denied';

export function pushSupported() {
  return false;
}

export async function registerForPush(): Promise<PushStatus> {
  return 'unsupported';
}

export async function unregisterPush() {}

export function usePushTaps() {}
