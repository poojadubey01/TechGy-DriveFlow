import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * Where the DriveFlow API lives.
 * - Set EXPO_PUBLIC_API_URL (e.g. https://api.driveflow.app) for real builds.
 * - In development it uses the same computer that serves the app (the Metro host), port 4000,
 *   so a phone, the emulator and the browser all reach the API on your PC without setup.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol === 'https:' ? 'https' : 'http'}://${window.location.hostname}:${API_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  // Android emulator: 10.0.2.2 is the computer running it.
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

/** Turns an API path (e.g. a photo's "/photos/…/image?sig=…") into a full URL. */
export function apiUrl(path: string) {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Google OAuth client IDs (Google Cloud Console → Credentials). The Web client ID turns on real
 * Google sign-in and Drive on iOS and Android; the iOS client ID is also needed for iOS builds.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

/**
 * Development only: the email "Continue with Google" signs in as while no Google client ID is set
 * (and on web). The backend's demo seed uses demo@driveflow.local (a workspace with Drive, clients and decks).
 */
export const DEV_GOOGLE_EMAIL = process.env.EXPO_PUBLIC_DEV_GOOGLE_EMAIL || 'demo@driveflow.local';
export const DEV_GOOGLE_NAME = process.env.EXPO_PUBLIC_DEV_GOOGLE_NAME || 'Aisha Khan';
