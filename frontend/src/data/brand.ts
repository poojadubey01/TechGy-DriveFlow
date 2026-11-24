import { api } from '@/api/client';
import type { ApiBrand } from '@/api/types';

import { useSession } from './session';
import { createStore } from './store';

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

const DEFAULTS: BrandState = { on: true, name: '', accent: ACCENTS[0].hex };
const store = createStore<BrandState>(DEFAULTS);

/** Fills the brand kit from GET /me. */
export function hydrateBrand(b: ApiBrand) {
  store.set({ on: b.on, name: b.name, accent: b.accent.toUpperCase() });
}

let pending: Partial<BrandState> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

/** Changes the brand kit right away; saving waits a moment so typing a name sends one request. */
export function setBrand(patch: Partial<BrandState>) {
  const clean = { ...patch, ...(patch.name !== undefined ? { name: patch.name.slice(0, 40) } : {}) };
  store.set((s) => ({ ...s, ...clean }));
  pending = { ...pending, ...clean };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const body = pending;
    pending = {};
    timer = null;
    api<ApiBrand>('/me/brand', { method: 'PATCH', body }).catch(() => undefined);
  }, 500);
}

export function resetBrand() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = {};
  store.reset();
}

/** Brand name used when none is set: the account's company, else the person's name. */
export function brandFallback(user: { company?: string; name: string } | null) {
  return user?.company?.trim() || user?.name.trim() || 'Your brand';
}

/** The brand applied to decks. With no name set, it uses the company on the account. */
export function useBrand(): { on: boolean; accent: string; name: string; customName: string } {
  const s = store.use();
  const { user } = useSession();
  return { on: s.on, accent: s.accent, customName: s.name, name: s.name.trim() || brandFallback(user) };
}
