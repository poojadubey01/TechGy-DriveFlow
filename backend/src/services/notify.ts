import { and, desc, eq, gt } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { notifications, type NotificationTarget, userSettings } from '../db/schema.js';
import { type PushSender, pushToUser } from './push.js';

export type NotificationKind = 'ready' | 'viewed' | 'photos' | 'team';

export type NewNotification = {
  kind: NotificationKind;
  title: string;
  body: string;
  target: NotificationTarget;
  /** Same key within `windowMs` updates the existing notification instead of adding another. */
  dedupeKey?: string;
  windowMs?: number;
};

/** What notify() needs: the database, and the push sender when push notifications are on. */
export type NotifyDeps = { db: Db; push?: PushSender | null; log?: { warn: (o: object, m: string) => void } };

const SETTING: Record<NotificationKind, 'notifyReady' | 'notifyViews' | 'notifyPhotos' | null> = {
  ready: 'notifyReady',
  viewed: 'notifyViews',
  photos: 'notifyPhotos',
  team: null,
};

/**
 * Adds an in-app notification and pushes it to the person's phones, unless they turned that kind
 * off in Profile. The push is sent in the background, so a slow push service never slows a request.
 */
export async function notify(deps: NotifyDeps, userId: string, n: NewNotification): Promise<void> {
  const { db } = deps;
  const flag = SETTING[n.kind];
  if (flag) {
    const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    if (s && !s[flag]) return;
  }
  let id: string | undefined;
  if (n.dedupeKey) {
    const since = new Date(Date.now() - (n.windowMs ?? 60 * 60 * 1000));
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.dedupeKey, n.dedupeKey), gt(notifications.createdAt, since)))
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    if (existing) {
      await db
        .update(notifications)
        .set({ title: n.title, body: n.body, target: n.target, createdAt: new Date(), readAt: null })
        .where(eq(notifications.id, existing.id));
      id = existing.id;
    }
  }
  if (!id) {
    const [row] = await db
      .insert(notifications)
      .values({ userId, kind: n.kind, title: n.title, body: n.body, target: n.target, dedupeKey: n.dedupeKey ?? null })
      .returning({ id: notifications.id });
    id = row!.id;
  }
  if (deps.push) {
    void pushToUser(db, deps.push, userId, { title: n.title, body: n.body, data: { notificationId: id, target: n.target } }, deps.log);
  }
}
