import { and, desc, eq, gt } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { notifications, type NotificationTarget, userSettings } from '../db/schema.js';

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

const SETTING: Record<NotificationKind, 'notifyReady' | 'notifyViews' | 'notifyPhotos' | null> = {
  ready: 'notifyReady',
  viewed: 'notifyViews',
  photos: 'notifyPhotos',
  team: null,
};

/** Adds an in-app notification, unless the person turned that kind off in Profile. */
export async function notify(db: Db, userId: string, n: NewNotification): Promise<void> {
  const flag = SETTING[n.kind];
  if (flag) {
    const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    if (s && !s[flag]) return;
  }
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
      return;
    }
  }
  await db.insert(notifications).values({ userId, kind: n.kind, title: n.title, body: n.body, target: n.target, dedupeKey: n.dedupeKey ?? null });
}
