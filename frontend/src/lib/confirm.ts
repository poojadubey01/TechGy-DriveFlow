import { Alert, Platform } from 'react-native';

import { errorMessage } from '@/api/client';

/** Asks before a destructive action: a native alert on phones, the browser's confirm on web. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Tells the person something didn't work (an alert on phones, the browser's alert on web). */
export function showError(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** A change shown right away couldn't be saved, and has been put back: tells the person why. */
export function showSaveFailed(e: unknown) {
  showError('Couldn’t save your change', errorMessage(e, 'Check your connection and try again.'));
}
