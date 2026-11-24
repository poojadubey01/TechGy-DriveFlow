import { useSyncExternalStore } from 'react';

export type User = { name: string; email: string; company?: string; /** How they signed in; Google accounts have no DriveFlow password. */ provider?: 'email' | 'google' };

export type DriveState = {
  connected: boolean;
  /** Google account the Drive belongs to. */
  account: string | null;
  /** The projects folder DriveFlow reads (one sub-folder per client). */
  folder: string | null;
  lastSync: string | null;
};

export type Session = { user: User | null; drive: DriveState };

const DISCONNECTED: DriveState = { connected: false, account: null, folder: null, lastSync: null };

/** In-memory session for now (resets when the app restarts). Replace with secure storage + backend. */
let state: Session = { user: null, drive: DISCONNECTED };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setUser(user: User) {
  state = { ...state, user };
  emit();
}

/** Edits the signed-in user's profile (name, company). */
export function updateUser(patch: Partial<Pick<User, 'name' | 'company'>>) {
  if (!state.user) return;
  state = { ...state, user: { ...state.user, ...patch } };
  emit();
}

export function setDrive(patch: Partial<DriveState>) {
  state = { ...state, drive: { ...state.drive, ...patch } };
  emit();
}

export function disconnectDrive() {
  state = { ...state, drive: DISCONNECTED };
  emit();
}

export function signOut() {
  state = { user: null, drive: DISCONNECTED };
  emit();
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** First name for greetings; empty when signed out (callers word around it). */
export function firstName(user: User | null) {
  return user?.name.trim().split(/\s+/)[0] ?? '';
}

export function initials(user: User | null) {
  const parts = (user?.name ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}
