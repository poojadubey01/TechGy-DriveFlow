import { and, eq, gt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { Config } from './config.js';
import type { Database, Db } from './db/client.js';
import { sessions, users } from './db/schema.js';
import type { Secrets } from './lib/crypto.js';
import { sha256 } from './lib/crypto.js';
import { unauthorized } from './lib/errors.js';
import type { UserRow } from './services/account.js';
import type { DriveService } from './services/drive/index.js';
import type { EmailSender } from './services/email.js';
import type { GoogleAuth } from './services/google.js';

/** Everything route handlers need, built once per app. */
export type Ctx = {
  config: Config;
  database: Database;
  db: Db;
  secrets: Secrets;
  email: EmailSender;
  googleAuth: GoogleAuth;
  drive: DriveService;
};

export type Auth = { user: UserRow; sessionId: string };

declare module 'fastify' {
  interface FastifyRequest {
    auth: Auth | null;
  }
}

/** Validates input with zod; a failure becomes a 400 with the field messages (see the error handler). */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data ?? {});
}

/** Reads "Authorization: Bearer <token>" and loads the session + user, or returns null. */
export async function loadAuth(ctx: Ctx, req: FastifyRequest): Promise<Auth | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token || token.length > 200) return null;
  const [row] = await ctx.db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  // Keep "last used" roughly current without a write on every request.
  if (Date.now() - row.session.lastUsedAt.getTime() > 60 * 60_000) {
    await ctx.db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, row.session.id));
  }
  return { user: row.user, sessionId: row.session.id };
}

/** onRequest hook for routes that need a signed-in user. */
export function requireAuth(ctx: Ctx) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const auth = await loadAuth(ctx, req);
    if (!auth) throw unauthorized();
    req.auth = auth;
  };
}

/** The signed-in user (only inside routes protected by requireAuth). */
export function me(req: FastifyRequest): Auth {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** Path the app turns into a full URL (base URL + path) to load a photo with its auth header. */
export const photoPath = (photoId: string) => `/photos/${photoId}/image`;
export const publicPhotoPath = (shareId: string, photoId: string) => `/public/decks/${shareId}/photos/${photoId}`;
