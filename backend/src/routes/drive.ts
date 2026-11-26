import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { type Ctx, me, parse, photoPath, requireAuth } from '../context.js';
import type { Db } from '../db/client.js';
import { clients, decks, driveConnections, photos } from '../db/schema.js';
import { PHOTO_KINDS } from '../domain/catalog.js';
import { pickPhotos } from '../domain/slides.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { DRIVE_SCOPE } from '../services/google.js';
import { syncDrive } from '../services/sync.js';

type DriveRow = typeof driveConnections.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

export async function driveState(db: Db, userId: string) {
  const [c] = await db.select().from(driveConnections).where(eq(driveConnections.userId, userId));
  return publicDrive(c);
}

function publicDrive(c: DriveRow | undefined) {
  if (!c) return { connected: false, account: null, folder: null, lastSync: null, provider: null };
  return {
    connected: true,
    account: c.account,
    folder: c.folderId ? { id: c.folderId, name: c.folderName ?? '' } : null,
    lastSync: c.lastSyncAt?.toISOString() ?? null,
    provider: c.provider as 'google' | 'mock',
  };
}

export const publicPhoto = (ctx: Ctx, p: PhotoRow) => ({
  id: p.id,
  name: p.name,
  kind: p.kind as (typeof PHOTO_KINDS)[number] | null,
  width: p.width,
  height: p.height,
  url: photoPath(ctx, p.id),
});

/** The client's current photos in Drive order. */
export async function clientPhotos(db: Db, clientId: string) {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.clientId, clientId), isNull(photos.removedAt)))
    .orderBy(asc(photos.position));
}

/** Cover = the first exterior shot, else the first photo. */
export function coverOf(list: readonly PhotoRow[]) {
  return list.find((p) => p.kind === 'exterior') ?? list[0] ?? null;
}

/** Streams a photo's bytes from Drive (or the mock). */
export async function sendPhoto(ctx: Ctx, reply: FastifyReply, photo: PhotoRow, cache: string) {
  const [conn] = await ctx.db.select().from(driveConnections).where(eq(driveConnections.userId, photo.userId));
  if (!conn) throw new AppError(409, 'drive_reconnect', 'Google Drive isn’t connected, so this photo can’t be loaded.');
  const file = await ctx.drive.sourceFor(conn).download(photo.driveFileId);
  reply.header('Content-Type', photo.mimeType || file.contentType).header('Cache-Control', cache);
  if (file.length) reply.header('Content-Length', String(file.length));
  return reply.send(file.stream);
}

export async function driveRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config } = ctx;
  app.addHook('onRequest', requireAuth(ctx));

  const connection = async (userId: string) => {
    const [c] = await db.select().from(driveConnections).where(eq(driveConnections.userId, userId));
    if (!c) throw badRequest('drive_not_connected', 'Connect your Google Drive first.');
    return c;
  };

  app.get('/drive', async (req) => driveState(db, me(req).user.id));

  /**
   * Connects Drive. Real: the app sends the authorization code from Google sign-in with the
   * drive.readonly scope (access_type=offline). Development: { "mock": true } uses sample folders.
   */
  app.post('/drive/connect', async (req) => {
    const { user } = me(req);
    const body = parse(
      z.union([
        z.object({ mock: z.literal(true) }),
        z.object({ code: z.string().min(4).max(2048), redirectUri: z.string().url().max(2048).optional(), codeVerifier: z.string().min(16).max(256).optional() }),
      ]),
      req.body,
    );
    let values: { provider: string; account: string; refreshTokenEnc: string | null };
    if ('mock' in body) {
      if (!config.DEV_MOCKS || !ctx.drive.mock) throw badRequest('mock_disabled', 'Sample Drive is only available in development.');
      values = { provider: 'mock', account: user.email, refreshTokenEnc: null };
    } else {
      const tokens = await ctx.drive.oauth.exchangeCode(body);
      if (!tokens.scope.split(' ').includes(DRIVE_SCOPE)) throw badRequest('drive_scope_missing', 'Please allow DriveFlow to see your Google Drive files, then try again.');
      if (!tokens.refreshToken) throw badRequest('drive_offline_missing', 'Google didn’t give DriveFlow lasting access. Please connect again.');
      const about = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      const account = about.ok ? (((await about.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? user.email) : user.email;
      values = { provider: 'google', account: account.toLowerCase(), refreshTokenEnc: ctx.secrets.encrypt(tokens.refreshToken) };
    }
    const [prev] = await db.select().from(driveConnections).where(eq(driveConnections.userId, user.id));
    const sameAccount = prev && prev.account === values.account && prev.provider === values.provider;
    ctx.drive.forget(user.id);
    await db
      .insert(driveConnections)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({
        target: driveConnections.userId,
        // A different Google account means a different Drive: the folder has to be chosen again.
        set: { ...values, connectedAt: new Date(), ...(sameAccount ? {} : { folderId: null, folderName: null, lastSyncAt: null }) },
      });
    return driveState(db, user.id);
  });

  app.delete('/drive', async (req, reply) => {
    const { user } = me(req);
    const [conn] = await db.select().from(driveConnections).where(eq(driveConnections.userId, user.id));
    if (conn?.provider === 'google' && conn.refreshTokenEnc) {
      try {
        await ctx.drive.oauth.revoke(ctx.secrets.decrypt(conn.refreshTokenEnc));
      } catch {
        // best effort
      }
    }
    ctx.drive.forget(user.id);
    await db.delete(driveConnections).where(eq(driveConnections.userId, user.id));
    return reply.code(204).send();
  });

  /** Top-level Drive folders with how many client sub-folders each has (for "Choose your projects folder"). */
  app.get('/drive/folders', async (req) => {
    const { user } = me(req);
    const source = ctx.drive.sourceFor(await connection(user.id));
    const top = (await source.listFolders('root')).slice(0, 50);
    const subCounts = await Promise.all(top.map((f) => source.listFolders(f.id).then((s) => s.length)));
    const best = Math.max(0, ...subCounts);
    return {
      folders: top.map((f, i) => ({
        id: f.id,
        name: f.name,
        clientFolders: subCounts[i] ?? 0,
        updated: f.modifiedTime,
        recommended: best > 0 && (subCounts[i] === best || /project|client/i.test(f.name)) && (subCounts[i] ?? 0) > 0,
      })),
    };
  });

  /** Picks the projects folder (one sub-folder per client). Run POST /drive/sync next. */
  app.post('/drive/folder', async (req) => {
    const { user } = me(req);
    const body = parse(z.object({ folderId: z.string().min(1).max(200) }), req.body);
    const conn = await connection(user.id);
    const folder = (await ctx.drive.sourceFor(conn).listFolders('root')).find((f) => f.id === body.folderId);
    if (!folder) throw notFound('That folder');
    const changed = conn.folderId !== folder.id;
    await db
      .update(driveConnections)
      .set({ folderId: folder.id, folderName: folder.name, ...(changed ? { lastSyncAt: null } : {}) })
      .where(eq(driveConnections.userId, user.id));
    return driveState(db, user.id);
  });

  app.post('/drive/sync', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    const { user } = me(req);
    const conn = await connection(user.id);
    if (!conn.folderId) throw badRequest('drive_folder_missing', 'Choose your projects folder first.');
    const result = await syncDrive(ctx, user.id, ctx.drive.sourceFor(conn), { id: conn.folderId, name: conn.folderName ?? 'Drive' }, !conn.lastSyncAt);
    return { result, drive: await driveState(db, user.id) };
  });

  /* ------------------------------------------------------------- clients */

  const ownClient = async (userId: string, id: string) => {
    const [c] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)));
    if (!c) throw notFound('That client');
    return c;
  };

  app.get('/clients', async (req) => {
    const { user } = me(req);
    const rows = await db
      .select()
      .from(clients)
      .where(and(eq(clients.userId, user.id), isNull(clients.removedAt)))
      .orderBy(asc(clients.name));
    const deckCounts = await db.select({ clientId: decks.clientId, n: count() }).from(decks).where(eq(decks.userId, user.id)).groupBy(decks.clientId);
    const items = await Promise.all(
      rows.map(async (c) => {
        const list = await clientPhotos(db, c.id);
        const cover = coverOf(list);
        return {
          id: c.id,
          name: c.name,
          meta: c.meta,
          photos: list.length,
          decks: deckCounts.find((d) => d.clientId === c.id)?.n ?? 0,
          cover: cover ? publicPhoto(ctx, cover) : null,
        };
      }),
    );
    return { clients: items };
  });

  app.get('/clients/:id', async (req) => {
    const { user } = me(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const c = await ownClient(user.id, id);
    const list = await clientPhotos(db, c.id);
    const cover = coverOf(list);
    return { id: c.id, name: c.name, meta: c.meta, removed: Boolean(c.removedAt), cover: cover ? publicPhoto(ctx, cover) : null, photos: list.map((p) => publicPhoto(ctx, p)) };
  });

  app.patch('/clients/:id', async (req) => {
    const { user } = me(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const body = parse(z.object({ meta: z.string().trim().max(80) }), req.body);
    await ownClient(user.id, id);
    const [c] = await db
      .update(clients)
      .set({ meta: body.meta, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return { id: c!.id, name: c!.name, meta: c!.meta };
  });

  /** The chat's "which photos?" step: proposes photos for an answer like "Interiors" or "the pool". */
  app.post('/clients/:id/pick-photos', async (req) => {
    const { user } = me(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const body = parse(z.object({ choice: z.string().trim().min(1).max(200) }), req.body);
    await ownClient(user.id, id);
    const picked = pickPhotos(await clientPhotos(db, id), body.choice);
    return { photos: picked.photos.map((p) => publicPhoto(ctx, p)), note: picked.note ?? null };
  });

  /* -------------------------------------------------------------- photos */

  const ownPhoto = async (userId: string, id: string) => {
    const [p] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.userId, userId)));
    if (!p) throw notFound('That photo');
    return p;
  };

  /** Fixes what a photo shows (exterior / interior / night); later syncs keep it. */
  app.patch('/photos/:id', async (req) => {
    const { user } = me(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const body = parse(z.object({ kind: z.enum(PHOTO_KINDS).nullable() }), req.body);
    await ownPhoto(user.id, id);
    const [p] = await db
      .update(photos)
      .set({ kind: body.kind, kindManual: body.kind !== null })
      .where(eq(photos.id, id))
      .returning();
    return publicPhoto(ctx, p!);
  });
  // GET /photos/:id/image lives in public.ts: it accepts a signed URL or the sign-in header.
}
