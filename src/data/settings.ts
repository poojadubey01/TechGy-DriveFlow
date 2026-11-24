import { useSyncExternalStore } from 'react';

/** App settings from Profile (in memory for now; persist with the account once it's real). */
export type Settings = {
  /** Slide count the chat recommends first. */
  defaultSlides: 8 | 12 | 15;
  notifyReady: boolean;
  notifyViews: boolean;
  notifyPhotos: boolean;
};

const DEFAULTS: Settings = { defaultSlides: 12, notifyReady: true, notifyViews: true, notifyPhotos: false };

let state: Settings = DEFAULTS;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetSettings() {
  setSettings(DEFAULTS);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
