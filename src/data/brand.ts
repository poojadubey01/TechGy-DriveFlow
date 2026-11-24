import { useSyncExternalStore } from 'react';

import { useSession } from './session';

/** Accent colours offered in the brand kit (all readable as white-on-colour and colour-on-white). */
export const ACCENTS = [
  { name: 'Deep blue', hex: '#0022FF' },
  { name: 'DriveFlow blue', hex: '#2F45FF' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Forest', hex: '#15803D' },
  { name: 'Coral', hex: '#C2410C' },
  { name: 'Plum', hex: '#7E3AA0' },
] as const;

type BrandState = { on: boolean; name: string; accent: string };

/** In memory for now (resets on restart). Replace with your backend once accounts are real. */
let state: BrandState = { on: true, name: '', accent: ACCENTS[0].hex };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setBrand(patch: Partial<BrandState>) {
  state = { ...state, ...patch, name: (patch.name ?? state.name).slice(0, 40) };
  listeners.forEach((l) => l());
}

export function resetBrand() {
  setBrand({ on: true, name: '', accent: ACCENTS[0].hex });
}

/** Brand name used when none is set: the account's company, else the person's name. */
export function brandFallback(user: { company?: string; name: string } | null) {
  return user?.company?.trim() || user?.name.trim() || 'Your brand';
}

/** The brand applied to decks. With no name set, it uses the company on the account. */
export function useBrand(): { on: boolean; accent: string; name: string; customName: string } {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const { user } = useSession();
  return { on: s.on, accent: s.accent, customName: s.name, name: s.name.trim() || brandFallback(user) };
}

