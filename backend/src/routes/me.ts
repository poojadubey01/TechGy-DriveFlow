import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { type Ctx, me, parse, requireAuth } from '../context.js';
import { brandKits, driveConnections, notifications, users, userSettings } from '../db/schema.js';
import { BRAND_NAME_MAX, SLIDE_CHOICES, TEMPLATE_IDS } from '../domain/catalog.js';
import { badRequest } from '../lib/errors.js';
import { getBrand, getSettings, publicBrand, publicSettings, publicUser } from '../services/account.js';
import { driveState } from './drive.js';

export async function meRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  app.addHook('onRequest', requireAuth(ctx));

  const unread = async (userId: string) =>
    (await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))))[0]?.n ?? 0;

  /** Everything the app needs on launch: who you are, Drive, settings, brand kit and the unread badge. */
  app.get('/me', async (req) => {
    const { user } = me(req);
    const [settings, brand, drive, unreadCount] = await Promise.all([getSettings(db, user.id), getBrand(db, user.id), driveState(db, user.id), unread(user.id)]);
    return { user: publicUser(user), drive, settings: publicSettings(settings), brand: publicBrand(brand, user), unreadNotifications: unreadCount };
  });

  app.patch('/me', async (req) => {
    const { user } = me(req);
    const body = parse(
      z.object({
        name: z.string().trim().min(1, 'Enter your name.').max(80).optional(),
        company: z.string().trim().max(80).optional(),
      }),
      req.body,
    );
    const [updated] = await db
      .update(users)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.company !== undefined ? { company: body.company || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();
    return { user: publicUser(updated!) };
  });

  /** Deletes the account and everything in it. The person confirms by typing their email. */
  app.delete('/me', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { user } = me(req);
    const body = parse(z.object({ email: z.string().trim().toLowerCase() }), req.body);
    if (body.email !== user.email) throw badRequest('email_mismatch', 'The email doesn’t match your account.');
    const [conn] = await db.select().from(driveConnections).where(eq(driveConnections.userId, user.id));
    if (conn?.provider === 'google' && conn.refreshTokenEnc) {
      try {
        await ctx.drive.oauth.revoke(ctx.secrets.decrypt(conn.refreshTokenEnc));
      } catch {
        // Revoking is best effort; the account is deleted either way.
      }
    }
    ctx.drive.forget(user.id);
    await db.delete(users).where(eq(users.id, user.id)); // cascades to every table
    return reply.code(204).send();
  });

  app.get('/me/settings', async (req) => publicSettings(await getSettings(db, me(req).user.id)));

  app.patch('/me/settings', async (req) => {
    const { user } = me(req);
    const body = parse(
      z.object({
        defaultSlides: z
          .number()
          .int()
          .refine((n) => (SLIDE_CHOICES as readonly number[]).includes(n), `Choose ${SLIDE_CHOICES.join(', ')} slides.`)
          .optional(),
        defaultTemplate: z.enum(TEMPLATE_IDS).optional(),
        notifyReady: z.boolean().optional(),
        notifyViews: z.boolean().optional(),
        notifyPhotos: z.boolean().optional(),
      }),
      req.body,
    );
    await getSettings(db, user.id);
    const [s] = await db
      .update(userSettings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(userSettings.userId, user.id))
      .returning();
    return publicSettings(s!);
  });

  app.get('/me/brand', async (req) => {
    const { user } = me(req);
    return publicBrand(await getBrand(db, user.id), user);
  });

  app.patch('/me/brand', async (req) => {
    const { user } = me(req);
    const body = parse(
      z.object({
        on: z.boolean().optional(),
        name: z.string().max(BRAND_NAME_MAX).optional(),
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #0022FF.')
          .transform((v) => v.toUpperCase())
          .optional(),
      }),
      req.body,
    );
    await getBrand(db, user.id);
    const [b] = await db
      .update(brandKits)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(brandKits.userId, user.id))
      .returning();
    return publicBrand(b!, user);
  });

  /* ------------------------------------------------------- notifications */

  app.get('/notifications', async (req) => {
    const { user } = me(req);
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }), req.query);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(q.limit);
    return {
      items: rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, target: n.target, read: Boolean(n.readAt), createdAt: n.createdAt.toISOString() })),
      unread: await unread(user.id),
    };
  });

  app.post('/notifications/:id/read', async (req, reply) => {
    const { user } = me(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return reply.code(204).send();
  });

  app.post('/notifications/read-all', async (req, reply) => {
    const { user } = me(req);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return reply.code(204).send();
  });
}
