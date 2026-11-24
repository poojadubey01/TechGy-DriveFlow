import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'driveflow.session';

/** Keeps the sign-in token between launches: the device keychain on phones, localStorage on web. */
export async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // Not fatal: the person just signs in again next launch.
  }
}

export async function clearToken() {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
