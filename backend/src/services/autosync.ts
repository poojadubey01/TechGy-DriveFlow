import { and, asc, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';

import type { Ctx } from '../context.js';
import { driveConnections } from '../db/schema.js';
import { syncDrive } from './sync.js';

/**
 * Background Drive sync: every connected Drive whose folder hasn't been synced for `intervalMin`
 * minutes is synced again, so new photos show up (and "new photos" notifications go out) without
 * anyone opening the app. Runs a few at a time; one failing Drive never stops the others.
 */
export async function syncDue(ctx: Ctx, intervalMin: number, opts: { limit?: number; log?: Pick<FastifyBaseLogger, 'warn' | 'info'> } = {}) {
  const cutoff = new Date(Date.now() - intervalMin * 60_000);
  const due = await ctx.db
    .select()
    .from(driveConnections)
    .where(and(isNotNull(driveConnections.folderId), or(isNull(driveConnections.lastSyncAt), lt(driveConnections.lastSyncAt, cutoff))))
    .orderBy(asc(driveConnections.lastSyncAt))
    .limit(opts.limit ?? 25);
  let synced = 0;
  for (const conn of due) {
    try {
      await syncDrive(ctx, conn.userId, ctx.drive.sourceFor(conn), { id: conn.folderId!, name: conn.folderName ?? 'Drive' }, !conn.lastSyncAt);
      synced++;
    } catch (err) {
      opts.log?.warn({ err, userId: conn.userId }, 'Background Drive sync failed');
    }
  }
  return { checked: due.length, synced };
}

/** Starts the background sync loop (checks once a minute). Returns a function that stops it. */
export function startAutoSync(ctx: Ctx, intervalMin: number, log: Pick<FastifyBaseLogger, 'warn' | 'info'>) {
  if (intervalMin <= 0) return () => undefined;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await syncDue(ctx, intervalMin, { log });
      if (r.synced) log.info(`Background Drive sync: ${r.synced} of ${r.checked} folders synced`);
    } catch (err) {
      log.warn({ err }, 'Background Drive sync round failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
