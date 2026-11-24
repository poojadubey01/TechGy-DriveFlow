import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { brandKits, emailCodes, sessions, users, userSettings } from '../db/schema.js';
import { BRAND_NAME_MAX } from '../domain/catalog.js';
import { newCode, newToken, type Secrets, sha256 } from '../lib/crypto.js';
import { badRequest, tooMany } from '../lib/errors.js';

export type UserRow = typeof users.$inferSelect;

export const PASSWORD_RULE = 'Use 8+ characters including a number.';

/** Same rule as the app: 8+ characters including a number. */
export function isStrongEnough(pw: string) {
  return pw.length >= 8 && pw.length <= 128 && /\d/.test(pw);
}

/** What the app sees about a user. */
export function publicUser(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    company: u.company ?? undefined,
    provider: u.provider as 'email' | 'google',
    hasPassword: Boolean(u.passwordHash),
    emailVerified: Boolean(u.emailVerifiedAt),
    createdAt: u.createdAt.toISOString(),
  };
}

/** Brand name used when none is set: the account's company, else the person's name. */
export function brandFallback(u: Pick<UserRow, 'company' | 'name'>) {
  return u.company?.trim() || u.name.trim() || 'Your brand';
}

export async function createUser(
  db: Db,
  input: { email: string; name: string; company?: string | null; passwordHash?: string | null; provider: 'email' | 'google'; googleSub?: string | null; verified: boolean },
): Promise<UserRow> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        company: input.company || null,
        passwordHash: input.passwordHash ?? null,
        provider: input.provider,
        googleSub: input.googleSub ?? null,
        emailVerifiedAt: input.verified ? new Date() : null,
      })
      .returning();
    await tx.insert(userSettings).values({ userId: user!.id });
    await tx.insert(brandKits).values({ userId: user!.id });
    return user!;
  });
}

export async function findUserByEmail(db: Db, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return u;
}

/** Signs a device in: returns the token the app keeps (only its hash is stored). */
export async function startSession(db: Db, userId: string, userAgent: string | undefined, days: number) {
  const token = newToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + days * 86_400_000),
  });
  return token;
}

export async function revokeSessions(db: Db, userId: string, exceptSessionId?: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined));
}

/* ------------------------------------------------------------ email codes */

export type CodePurpose = 'verify' | 'reset';

const CODE_TTL_MS = 15 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;

const codeKey = (email: string, purpose: CodePurpose, code: string) => `${purpose}:${email}:${code}`;

/** Makes a new code (older unused ones stop working). Throws if one was sent in the last 30 seconds. */
export async function issueCode(db: Db, secrets: Secrets, email: string, purpose: CodePurpose): Promise<string> {
  const [latest] = await db
    .select({ createdAt: emailCodes.createdAt })
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose)))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw tooMany('We just sent a code. Please wait 30 seconds before asking for another.');
  }
  const code = newCode();
  await db.transaction(async (tx) => {
    await tx
      .update(emailCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose), isNull(emailCodes.consumedAt)));
    await tx.insert(emailCodes).values({ email, purpose, codeHash: secrets.mac(codeKey(email, purpose, code)), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  });
  return code;
}

/** Checks (and uses up) a code. Five wrong tries and the code stops working. */
export async function useCode(db: Db, secrets: Secrets, email: string, purpose: CodePurpose, code: string): Promise<void> {
  const wrong = badRequest('invalid_code', 'That code isn’t right. Check the email and try again.');
  if (!/^\d{6}$/.test(code)) throw wrong;
  const [row] = await db
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose), isNull(emailCodes.consumedAt), gt(emailCodes.expiresAt, new Date())))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (!row) throw badRequest('code_expired', 'That code has expired. Ask for a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw badRequest('code_locked', 'Too many wrong tries. Ask for a new code.');
  if (!secrets.macEquals(codeKey(email, purpose, code), row.codeHash)) {
    await db
      .update(emailCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailCodes.id, row.id));
    throw wrong;
  }
  await db.update(emailCodes).set({ consumedAt: new Date() }).where(eq(emailCodes.id, row.id));
}

/* ------------------------------------------------------- settings & brand */

export async function getSettings(db: Db, userId: string) {
  const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (s) return s;
  const [created] = await db.insert(userSettings).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0]!;
}

export async function getBrand(db: Db, userId: string) {
  const [b] = await db.select().from(brandKits).where(eq(brandKits.userId, userId));
  if (b) return b;
  const [created] = await db.insert(brandKits).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(brandKits).where(eq(brandKits.userId, userId)))[0]!;
}

export function publicSettings(s: typeof userSettings.$inferSelect) {
  return { defaultSlides: s.defaultSlides, defaultTemplate: s.defaultTemplate, notifyReady: s.notifyReady, notifyViews: s.notifyViews, notifyPhotos: s.notifyPhotos };
}

/** `name` is what the person typed (may be empty); `displayName` is what decks show. */
export function publicBrand(b: typeof brandKits.$inferSelect, user: Pick<UserRow, 'company' | 'name'>) {
  const name = b.name.slice(0, BRAND_NAME_MAX);
  return { on: b.on, name, accent: b.accent, displayName: name.trim() || brandFallback(user) };
}
