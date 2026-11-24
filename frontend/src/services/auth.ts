/**
 * Auth service — MOCK.
 *
 * Every function here waits a moment and succeeds (codes: any 6 digits except 000000), so the whole flow can be
 * designed and tested. To go live, replace the bodies with your backend calls and real Google
 * sign-in (expo-auth-session with your Google OAuth client IDs). The screens only use this API.
 */
import type { User } from '@/data/session';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? '';
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p[0]!.toUpperCase() + p.slice(1))
      .join(' ') || 'DriveFlow user'
  );
}

export class AuthError extends Error {}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  await wait(900);
  if (!isEmail(email) || password.length < 8) throw new AuthError('Incorrect email or password.');
  const e = email.trim().toLowerCase();
  return { name: nameFromEmail(e), email: e, provider: 'email' };
}

export async function signUpWithEmail(input: { name: string; email: string; company: string; password: string }): Promise<User> {
  await wait(1100);
  if (!isEmail(input.email) || !isStrongEnough(input.password)) throw new AuthError('Please check your details and try again.');
  return { name: input.name.trim(), email: input.email.trim().toLowerCase(), company: input.company.trim() || undefined, provider: 'email' };
}

export async function signInWithGoogle(): Promise<User> {
  await wait(1000);
  return { name: 'Aisha Khan', email: 'aisha@techgylink.com', company: 'TechGy Link', provider: 'google' };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await wait(900);
  if (!isEmail(email)) throw new AuthError('Enter a valid email address.');
}

const CODE_RE = /^\d{6}$/;

/** Mock rule: any 6 digits work except 000000 (so the error state can be tested). */
function checkCode(code: string) {
  if (!CODE_RE.test(code) || code === '000000') throw new AuthError('That code isn’t right. Check the email and try again.');
}

/** Confirms the 6-digit code sent after sign-up. */
export async function verifyEmail(email: string, code: string): Promise<void> {
  await wait(900);
  if (!isEmail(email)) throw new AuthError('Enter a valid email address.');
  checkCode(code);
}

/** Sends a fresh 6-digit code (sign-up verification or password reset). */
export async function resendCode(email: string): Promise<void> {
  await wait(700);
  if (!isEmail(email)) throw new AuthError('Enter a valid email address.');
}

/** Sets a new password using the reset code from the email. */
export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await wait(1000);
  checkCode(code);
  if (!isStrongEnough(password)) throw new AuthError('Use 8+ characters including a number.');
  if (!isEmail(email)) throw new AuthError('Enter a valid email address.');
}

/** Changes the password while signed in. Mock rule: the current password must be 8+ characters. */
export async function changePassword(current: string, next: string): Promise<void> {
  await wait(1000);
  if (current.length < 8) throw new AuthError('Your current password is incorrect.');
  if (!isStrongEnough(next)) throw new AuthError('Use 8+ characters including a number.');
  if (next === current) throw new AuthError('Choose a new password, not your current one.');
}

/** Permanently deletes the account. The user confirms by typing their email. */
export async function deleteAccount(email: string, typed: string): Promise<void> {
  await wait(1200);
  if (typed.trim().toLowerCase() !== email.trim().toLowerCase()) throw new AuthError('The email doesn’t match your account.');
}
