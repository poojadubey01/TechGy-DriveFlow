import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Fire-and-forget haptics. Never throws: unsupported devices, web and
 * simulators simply skip the vibration.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(run: () => Promise<void>) {
  if (!enabled) return;
  run().catch(() => undefined);
}

export const haptic = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  select: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
