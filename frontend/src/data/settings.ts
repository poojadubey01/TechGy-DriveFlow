import { api } from '@/api/client';
import type { ApiSettings } from '@/api/types';
import { showSaveFailed } from '@/lib/confirm';

import { createStore } from './store';

/** App settings from Profile, saved with the account. */
export type Settings = {
  /** Slide count the chat recommends first. */
  defaultSlides: 8 | 12 | 15;
  /** Template for new decks. */
  defaultTemplate: ApiSettings['defaultTemplate'];
  notifyReady: boolean;
  notifyViews: boolean;
  notifyPhotos: boolean;
};

const DEFAULTS: Settings = { defaultSlides: 12, defaultTemplate: 'classic', notifyReady: true, notifyViews: true, notifyPhotos: false };

const store = createStore<Settings>(DEFAULTS);

export const getSettings = store.get;

/** Fills the settings from GET /me. */
export function hydrateSettings(s: ApiSettings) {
  store.set({ ...s });
}

/** Changes settings right away and saves them; puts them back if saving fails. */
export function setSettings(patch: Partial<Settings>) {
  const before = store.get();
  store.set({ ...before, ...patch });
  api<ApiSettings>('/me/settings', { method: 'PATCH', body: patch })
    .then((saved) => store.set({ ...saved }))
    .catch((e) => {
      store.set(before);
      showSaveFailed(e);
    });
}

export function resetSettings() {
  store.reset();
}

export function useSettings(): Settings {
  return store.use();
}
