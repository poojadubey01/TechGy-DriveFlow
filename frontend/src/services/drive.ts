/**
 * Google Drive, backed by the DriveFlow API (backend/src/routes/drive.ts). Screens only use this file.
 *
 * Until Google OAuth keys are set up, connecting uses the API's sample Drive ({ mock: true }): a
 * "Projects" folder with the four sample clients. For real Drive, get an authorization code with
 * the drive.readonly scope (expo-auth-session, offline access) and send it to POST /drive/connect.
 */
import { api } from '@/api/client';
import type { ApiDrive, ApiDriveFolder } from '@/api/types';
import { loadClients } from '@/data/clients';
import { driveFromApi, getSession, setDriveState } from '@/data/session';
import { relativeTime } from '@/data/store';

export type DriveFolder = {
  id: string;
  name: string;
  clientFolders: number;
  updated: string;
  recommended?: boolean;
};

/** Connects the signed-in user's Google Drive. */
export async function connectDrive(): Promise<{ account: string }> {
  const d = await api<ApiDrive>('/drive/connect', { method: 'POST', body: { mock: true } });
  setDriveState(driveFromApi(d));
  return { account: d.account ?? '' };
}

export async function listFolders(): Promise<DriveFolder[]> {
  const { folders } = await api<{ folders: ApiDriveFolder[] }>('/drive/folders');
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    clientFolders: f.clientFolders,
    updated: f.updated ? `Updated ${relativeTime(f.updated).toLowerCase()}` : '',
    recommended: f.recommended || undefined,
  }));
}

/** Picks the projects folder (one sub-folder per client). */
export async function chooseFolder(folderId: string) {
  setDriveState(driveFromApi(await api<ApiDrive>('/drive/folder', { method: 'POST', body: { folderId } })));
}

export type SyncResult = { clients: number; photos: number; newPhotos: number };

/** Reads the folder's clients and photos, then reloads the client list. */
export async function syncDrive(): Promise<SyncResult> {
  const res = await api<{ result: SyncResult; drive: ApiDrive }>('/drive/sync', { method: 'POST', timeoutMs: 120_000 });
  setDriveState(driveFromApi(res.drive));
  await loadClients();
  return res.result;
}

/**
 * Picks up a background sync the server did while the app was away: when the folder was synced
 * since we last looked, the client list is reloaded. Quiet on errors (it runs when Home opens).
 */
export async function refreshDrive() {
  const before = getSession().drive.lastSyncAt;
  const d = await api<ApiDrive>('/drive');
  setDriveState(driveFromApi(d));
  if (d.folder && d.lastSync !== before) await loadClients();
}

export async function disconnectDrive() {
  await api('/drive', { method: 'DELETE' });
  setDriveState(driveFromApi({ connected: false, account: null, folder: null, lastSync: null, provider: null }));
}
