import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { clients, driveConnections, photos } from '../db/schema.js';
import { kindFromText } from '../domain/slides.js';
import type { DriveSource } from './drive/index.js';
import { notify } from './notify.js';

export type SyncResult = { clients: number; photos: number; newPhotos: number };

/**
 * Reads the chosen Drive folder: every sub-folder becomes a client and its images become that
 * client's photos. Folders or photos that disappeared are marked removed (old decks keep working
 * where they can). Kinds set by hand are kept. Sends a "new photos" notification after the first sync.
 */
export async function syncDrive(db: Db, userId: string, source: DriveSource, folder: { id: string; name: string }, firstSync: boolean): Promise<SyncResult> {
  const subfolders = await source.listFolders(folder.id);
  const images = await Promise.all(subfolders.map((f) => source.listImages(f.id)));

  const result: SyncResult = { clients: subfolders.length, photos: 0, newPhotos: 0 };
  const newByClient: { clientId: string; name: string; count: number }[] = [];

  await db.transaction(async (tx) => {
    const now = new Date();
    const seenFolders = subfolders.map((f) => f.id);
    // Clients whose folder is gone (or that belong to a previously chosen folder) are hidden.
    await tx
      .update(clients)
      .set({ removedAt: now, updatedAt: now })
      .where(and(eq(clients.userId, userId), isNull(clients.removedAt), seenFolders.length ? notInArray(clients.driveFolderId, seenFolders) : undefined));

    for (const [i, sub] of subfolders.entries()) {
      const [existing] = await tx
        .select()
        .from(clients)
        .where(and(eq(clients.userId, userId), eq(clients.driveFolderId, sub.id)));
      let clientId: string;
      if (existing) {
        clientId = existing.id;
        await tx
          .update(clients)
          .set({ name: sub.name, meta: existing.meta || sub.description.slice(0, 80), removedAt: null, updatedAt: now })
          .where(eq(clients.id, existing.id));
      } else {
        const [row] = await tx
          .insert(clients)
          .values({ userId, driveFolderId: sub.id, name: sub.name, meta: sub.description.slice(0, 80) })
          .returning({ id: clients.id });
        clientId = row!.id;
      }

      const files = images[i] ?? [];
      result.photos += files.length;
      const known = await tx.select().from(photos).where(eq(photos.clientId, clientId));
      const byFile = new Map(known.map((p) => [p.driveFileId, p]));
      let added = 0;
      for (const [position, f] of files.entries()) {
        const guess = kindFromText(`${f.description} ${f.name}`)?.kind ?? null;
        const prev = byFile.get(f.id);
        const values = {
          name: f.name,
          mimeType: f.mimeType,
          width: f.width,
          height: f.height,
          position,
          driveModifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : null,
          removedAt: null,
        };
        if (prev) {
          await tx
            .update(photos)
            .set({ ...values, kind: prev.kindManual ? prev.kind : guess })
            .where(eq(photos.id, prev.id));
        } else {
          await tx.insert(photos).values({ ...values, userId, clientId, driveFileId: f.id, kind: guess });
          added++;
        }
      }
      const gone = known.filter((p) => !p.removedAt && !files.some((f) => f.id === p.driveFileId)).map((p) => p.id);
      if (gone.length) await tx.update(photos).set({ removedAt: now }).where(inArray(photos.id, gone));
      if (added) newByClient.push({ clientId, name: sub.name, count: added });
      result.newPhotos += added;
    }

    await tx.update(driveConnections).set({ lastSyncAt: now }).where(eq(driveConnections.userId, userId));
  });

  if (!firstSync && result.newPhotos > 0) {
    const one = newByClient.length === 1 ? newByClient[0]! : null;
    await notify(db, userId, {
      kind: 'photos',
      title: `${result.newPhotos} new ${result.newPhotos === 1 ? 'photo' : 'photos'} in Google Drive`,
      body: one ? `Added to ${folder.name} / ${one.name}` : `Added to ${newByClient.length} clients in ${folder.name}`,
      target: one ? { pathname: '/client/[id]', params: { id: one.clientId } } : { pathname: '/clients' },
    });
  }
  return result;
}
