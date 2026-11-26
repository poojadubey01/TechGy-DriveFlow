/**
 * Native Google sign-in on iOS and Android (@react-native-google-signin/google-signin).
 * auth.ts uses it for an ID token (POST /auth/google), drive.ts for a one-time code (POST /drive/connect).
 * Needs a development build (not Expo Go) and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
 */
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes, type User as GoogleUser } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/api/config';

/** Real Google on iOS and Android once the Web client ID is set; otherwise the API's development stand-ins. */
export const googleReady = Platform.OS !== 'web' && GOOGLE_WEB_CLIENT_ID !== '';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const cancelled = () => new ApiError('Google sign-in was cancelled.', 'cancelled', 0);

/** The person closed Google's sheet: screens just stop, without showing an error. */
export function isCancelled(e: unknown) {
  return e instanceof ApiError && e.code === 'cancelled';
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return cancelled();
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new ApiError('Google sign-in needs Google Play services on this device.', 'play_services', 0);
  }
  // Usually setup: on Android, "DEVELOPER_ERROR" means the app's package name or SHA-1 isn't on an Android OAuth client.
  if (__DEV__) console.warn('Google sign-in failed', e);
  return new ApiError('Google sign-in didn’t work. Please try again.', 'google_failed', 0);
}

/** Shows Google's account picker (every time, so another account can be chosen). */
async function pickAccount(options: { scopes?: string[]; offlineAccess?: boolean }): Promise<GoogleUser> {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: options.scopes,
    offlineAccess: options.offlineAccess ?? false,
    // Android: always hand out a code that comes with a refresh token, which the server needs to keep syncing.
    forceCodeForRefreshToken: options.offlineAccess ?? false,
  });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // DriveFlow keeps no Google session of its own (the API issues its own), so always start clean.
    await GoogleSignin.signOut().catch(() => null);
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) throw cancelled();
    return res.data;
  } catch (e) {
    throw toApiError(e);
  } finally {
    // Signing out of the app's Google session doesn't invalidate the token or code we just got.
    await GoogleSignin.signOut().catch(() => null);
  }
}

/** A Google ID token for POST /auth/google. */
export async function googleIdToken(): Promise<string> {
  const user = await pickAccount({});
  if (!user.idToken) throw toApiError(new Error('Google returned no ID token'));
  return user.idToken;
}

/** A one-time code for POST /drive/connect: the server swaps it for lasting, read-only Drive access. */
export async function googleDriveCode(): Promise<string> {
  const user = await pickAccount({ scopes: [DRIVE_SCOPE], offlineAccess: true });
  if (!user.serverAuthCode) throw toApiError(new Error('Google returned no server auth code'));
  return user.serverAuthCode;
}
