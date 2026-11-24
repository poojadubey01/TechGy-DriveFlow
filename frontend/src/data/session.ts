import type { ApiDrive, ApiUser } from '@/api/types';

import { createStore, relativeTime } from './store';

export type User = {
  id?: string;
  name: string;
  email: string;
  company?: string;
  /** How the account was created; Google accounts may have no DriveFlow password. */
  provider?: 'email' | 'google';
  hasPassword?: boolean;
};

export type DriveState = {
  connected: boolean;
  /** Google account the Drive belongs to. */
  account: string | null;
  /** The projects folder DriveFlow reads (one sub-folder per client): its name and Drive id. */
  folder: string | null;
  folderId: string | null;
  /** When it was last synced, as a label ("5 min ago"), and as an ISO time. */
  lastSync: string | null;
  lastSyncAt: string | null;
};

/** 'restoring' while the saved sign-in is checked at launch. */
export type Session = { user: User | null; drive: DriveState; status: 'restoring' | 'ready' };

const DISCONNECTED: DriveState = { connected: false, account: null, folder: null, folderId: null, lastSync: null, lastSyncAt: null };

const store = createStore<Session>({ user: null, drive: DISCONNECTED, status: 'restoring' });

export const getSession = store.get;

export function userFromApi(u: ApiUser): User {
  return { id: u.id, name: u.name, email: u.email, company: u.company, provider: u.provider, hasPassword: u.hasPassword };
}

export function driveFromApi(d: ApiDrive): DriveState {
  if (!d.connected) return DISCONNECTED;
  return {
    connected: true,
    account: d.account,
    folder: d.folder?.name ?? null,
    folderId: d.folder?.id ?? null,
    lastSync: d.lastSync ? relativeTime(d.lastSync) : null,
    lastSyncAt: d.lastSync,
  };
}

export function setUser(user: User) {
  store.set((s) => ({ ...s, user }));
}

/** Local update after the API saved the profile (see services/account). */
export function updateUserLocal(patch: Partial<Pick<User, 'name' | 'company'>>) {
  store.set((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
}

export function setDriveState(drive: DriveState) {
  store.set((s) => ({ ...s, drive }));
}

export function setSessionReady() {
  store.set((s) => (s.status === 'ready' ? s : { ...s, status: 'ready' }));
}

/** Clears the signed-in person from memory (the token is cleared by services/auth). */
export function clearSession() {
  store.set({ user: null, drive: DISCONNECTED, status: 'ready' });
}

export function useSession(): Session {
  return store.use();
}

/** First name for greetings; empty when signed out (callers word around it). */
export function firstName(user: User | null) {
  return user?.name.trim().split(/\s+/)[0] ?? '';
}

export function initials(user: User | null) {
  const parts = (user?.name ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}
