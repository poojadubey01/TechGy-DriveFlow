/**
 * Google Drive service — MOCK.
 *
 * Simulates connecting Drive, listing top-level folders and syncing one. To go live, request the
 * Drive scope during Google sign-in (read-only: drive.readonly) and call the Drive v3 API from
 * your backend. The screens only use this API.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type DriveFolder = {
  id: string;
  name: string;
  clientFolders: number;
  photos: number;
  updated: string;
  recommended?: boolean;
};

/** Connects the signed-in user's Google account (the real version uses their OAuth grant). */
export async function connectDrive(email?: string): Promise<{ account: string }> {
  await wait(1200);
  return { account: email || 'aisha@techgylink.com' };
}

export async function listFolders(): Promise<DriveFolder[]> {
  await wait(600);
  return [
    { id: 'projects', name: 'Projects', clientFolders: 4, photos: 320, updated: 'Updated today', recommended: true },
    { id: 'clients-2026', name: 'Clients 2026', clientFolders: 12, photos: 1140, updated: 'Updated 2 days ago' },
    { id: 'marketing', name: 'Marketing', clientFolders: 3, photos: 96, updated: 'Updated last week' },
    { id: 'archive', name: 'Archive 2025', clientFolders: 18, photos: 2210, updated: 'Updated in March' },
  ];
}
