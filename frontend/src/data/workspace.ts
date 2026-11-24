import { api } from '@/api/client';
import type { ApiMe } from '@/api/types';

import { loadDecks, loadNotifications, resetDecks, resetNotifications, setUnreadCount } from './app';
import { hydrateBrand, resetBrand } from './brand';
import { loadClients, resetClients } from './clients';
import { clearDeckEdits } from './deckEdits';
import { driveFromApi, setDriveState, setUser, userFromApi } from './session';
import { hydrateSettings, resetSettings } from './settings';

/**
 * Loads the signed-in account: profile, Drive, settings, brand kit, then clients, decks and
 * notifications. A list that fails to load shows its own error/empty state instead of blocking.
 */
export async function loadWorkspace(me?: ApiMe) {
  const data = me ?? (await api<ApiMe>('/me'));
  setUser(userFromApi(data.user));
  setDriveState(driveFromApi(data.drive));
  hydrateSettings(data.settings);
  hydrateBrand(data.brand);
  setUnreadCount(data.unreadNotifications);
  await Promise.allSettled([data.drive.folder ? loadClients() : Promise.resolve(), loadDecks(), loadNotifications()]);
  return data;
}

/** Refreshes the lists (pull to refresh, coming back to Home). */
export function refreshWorkspace() {
  return Promise.allSettled([loadClients(), loadDecks(), loadNotifications()]);
}

/** Forgets everything that belongs to the signed-in account, so the next person never sees it. */
export function resetWorkspace() {
  resetDecks();
  resetNotifications();
  resetClients();
  clearDeckEdits();
  resetBrand();
  resetSettings();
}
