import { useSyncExternalStore } from 'react';

/** Per-deck share-link settings (in memory for now). Key: deckKey(clientId, type). */
export type ShareState = { active: boolean; allowPdf: boolean };

const DEFAULT: ShareState = { active: true, allowPdf: true };
let shares = new Map<string, ShareState>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setShare(key: string, patch: Partial<ShareState>) {
  shares = new Map(shares).set(key, { ...(shares.get(key) ?? DEFAULT), ...patch });
  listeners.forEach((l) => l());
}

export function clearShares() {
  shares = new Map();
  listeners.forEach((l) => l());
}

export function useShare(key: string): ShareState {
  const map = useSyncExternalStore(subscribe, () => shares, () => shares);
  return map.get(key) ?? DEFAULT;
}
