/**
 * Accounts, backed by the DriveFlow API (backend/src/routes/auth.ts). Screens only use this file.
 *
 * Google sign-in: on iOS and Android with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set, Google's account picker
 * gives an ID token for POST /auth/google (services/google.ts). Otherwise (and on web) "Continue with
 * Google" uses the API's development stand-in and signs in as DEV_GOOGLE_EMAIL (the `npm run seed` demo).
 */
import { api, ApiError, setToken, setUnauthorizedHandler } from '@/api/client';
import { DEV_GOOGLE_EMAIL, DEV_GOOGLE_NAME } from '@/api/config';
import { clearToken, loadToken, saveToken } from '@/api/tokenStore';
import type { ApiMe, ApiSignedIn } from '@/api/types';
import { clearSession, getSession, setSessionReady, type User } from '@/data/session';
import { loadWorkspace, resetWorkspace } from '@/data/workspace';
import { googleIdToken, googleReady } from '@/services/google';
import { unregisterPush } from '@/services/push';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

/** 0 = empty, 1 = weak, 2 = okay, 3 = strong. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/\d/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  // A password that would be rejected never shows better than "Weak".
  if (!isStrongEnough(pw)) return 1;
  return Math.max(2, score) as 2 | 3;
}

export function isStrongEnough(pw: string) {
  return pw.length >= 8 && /\d/.test(pw);
}

/** Every API error carries a message that can be shown as is. */
export { ApiError as AuthError } from '@/api/client';
/** True when the person closed Google's sheet: stop quietly. */
export { isCancelled } from '@/services/google';

/** Keeps the token, loads the account's workspace and returns the user. */
async function signedIn(res: ApiSignedIn): Promise<User> {
  setToken(res.token);
  await saveToken(res.token);
  await loadWorkspace();
  return getSession().user!;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  return signedIn(await api<ApiSignedIn>('/auth/sign-in', { method: 'POST', body: { email: email.trim(), password } }));
}

/** Creates the account and emails a 6-digit code; verifyEmail() then signs in. */
export async function signUpWithEmail(input: { name: string; email: string; company: string; password: string }): Promise<{ email: string }> {
  return api<{ status: string; email: string }>('/auth/sign-up', {
    method: 'POST',
    body: { name: input.name.trim(), email: input.email.trim(), company: input.company.trim() || undefined, password: input.password },
  });
}

export async function signInWithGoogle(): Promise<User> {
  const idToken = googleReady ? await googleIdToken() : `dev:${DEV_GOOGLE_EMAIL}:${DEV_GOOGLE_NAME}`;
  return signedIn(await api<ApiSignedIn>('/auth/google', { method: 'POST', body: { idToken } }));
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
}

/** Confirms the 6-digit code sent after sign-up, and signs in. */
export async function verifyEmail(email: string, code: string): Promise<User> {
  return signedIn(await api<ApiSignedIn>('/auth/verify-email', { method: 'POST', body: { email: email.trim(), code } }));
}

/** Sends a fresh 6-digit code (sign-up verification or password reset). */
export async function resendCode(email: string, purpose: 'verify' | 'reset' = 'verify'): Promise<void> {
  await api('/auth/resend-code', { method: 'POST', body: { email: email.trim(), purpose } });
}

/** Sets a new password using the reset code from the email (signs out every device). */
export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await api('/auth/reset-password', { method: 'POST', body: { email: email.trim(), code, password } });
}

/** Changes the password while signed in (other devices are signed out). */
export async function changePassword(current: string, next: string): Promise<void> {
  await api('/auth/change-password', { method: 'POST', body: { current, next } });
}

/** Forgets the sign-in on this device and clears the workspace from memory. */
async function endLocalSession() {
  setToken(null);
  await clearToken();
  resetWorkspace();
  clearSession();
}

/** Permanently deletes the account. The user confirms by typing their email. */
export async function deleteAccount(email: string, typed: string): Promise<void> {
  if (typed.trim().toLowerCase() !== email.trim().toLowerCase()) throw new ApiError('The email doesn’t match your account.', 'email_mismatch', 400);
  await api('/me', { method: 'DELETE', body: { email: typed.trim() } });
  await endLocalSession();
}

export async function signOut(): Promise<void> {
  await unregisterPush();
  await api('/auth/sign-out', { method: 'POST' }).catch(() => undefined);
  await endLocalSession();
}

// A request answered 401 (expired, or signed out elsewhere after a password reset): sign out here too.
setUnauthorizedHandler(() => {
  void endLocalSession();
});

/** At launch: signs back in with the saved token, if it still works. */
export async function restoreSession(): Promise<void> {
  const saved = await loadToken();
  if (!saved) return setSessionReady();
  setToken(saved);
  try {
    // Don't hold the splash screen for long if the API can't be reached.
    await loadWorkspace(await api<ApiMe>('/me', { timeoutMs: 6000 }));
  } catch (e) {
    // A rejected token is gone for good; if the API was just unreachable, keep it for next launch.
    if (e instanceof ApiError && e.status === 401) await endLocalSession();
    else setToken(null);
  } finally {
    setSessionReady();
  }
}
