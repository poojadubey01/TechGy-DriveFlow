import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { type Ctx, me, parse, requireAuth } from '../context.js';
import { sessions, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { AppError, badRequest, conflict, forbidden } from '../lib/errors.js';
import {
  createUser,
  findUserByEmail,
  isStrongEnough,
  issueCode,
  PASSWORD_RULE,
  publicUser,
  revokeSessions,
  startSession,
  useCode,
} from '../services/account.js';
import { codeEmail } from '../services/email.js';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address.');
const newPassword = z.string().max(128).refine(isStrongEnough, PASSWORD_RULE);
const code = z.string().trim();

/** Stricter limits on everything that checks a password or sends an email. */
const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, secrets, config } = ctx;

  const sendCode = async (to: string, purpose: 'verify' | 'reset') => {
    const c = await issueCode(db, secrets, to, purpose);
    await ctx.email.send(codeEmail(to, purpose, c));
  };

  const signedIn = async (userId: string, ua: string | undefined) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const token = await startSession(db, userId, ua, config.SESSION_DAYS);
    return { token, user: publicUser(user!) };
  };

  /** Creates the account and emails a 6-digit code. Signing up again before verifying just resends it. */
  app.post('/auth/sign-up', strict, async (req, reply) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(1, 'Enter your name.').max(80),
        email,
        company: z.string().trim().max(80).optional(),
        password: newPassword,
      }),
      req.body,
    );
    const existing = await findUserByEmail(db, body.email);
    if (existing?.emailVerifiedAt || (existing && existing.provider === 'google')) {
      throw conflict(existing.provider === 'google' ? 'use_google' : 'email_taken', existing.provider === 'google' ? 'This email uses Google sign-in. Continue with Google instead.' : 'An account with this email already exists. Sign in instead.');
    }
    const passwordHash = await hashPassword(body.password);
    if (existing) {
      await db
        .update(users)
        .set({ name: body.name, company: body.company || null, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    } else {
      await createUser(db, { email: body.email, name: body.name, company: body.company, passwordHash, provider: 'email', verified: false });
    }
    try {
      await sendCode(body.email, 'verify');
    } catch (e) {
      // A code sent moments ago is still valid; don't fail the sign-up over the cooldown.
      if (!(e instanceof AppError && e.status === 429)) throw e;
    }
    return reply.code(201).send({ status: 'verification_sent', email: body.email });
  });

  app.post('/auth/verify-email', strict, async (req) => {
    const body = parse(z.object({ email, code }), req.body);
    const user = await findUserByEmail(db, body.email);
    if (!user) throw badRequest('invalid_code', 'That code isn’t right. Check the email and try again.');
    await useCode(db, secrets, body.email, 'verify', body.code);
    if (!user.emailVerifiedAt) await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    return signedIn(user.id, req.headers['user-agent']);
  });

  /** Sends a fresh code. Answers the same whether or not the email has an account. */
  app.post('/auth/resend-code', strict, async (req) => {
    const body = parse(z.object({ email, purpose: z.enum(['verify', 'reset']) }), req.body);
    const user = await findUserByEmail(db, body.email);
    const eligible = body.purpose === 'verify' ? user && !user.emailVerifiedAt : Boolean(user);
    if (eligible) await sendCode(body.email, body.purpose);
    return { status: 'sent' };
  });

  app.post('/auth/sign-in', strict, async (req) => {
    const body = parse(z.object({ email, password: z.string().max(128) }), req.body);
    const user = await findUserByEmail(db, body.email);
    if (user && !user.passwordHash) throw new AppError(401, 'use_google', 'This account uses Google sign-in. Continue with Google instead.');
    if (!user || !(await verifyPassword(body.password, user.passwordHash!))) {
      throw new AppError(401, 'invalid_credentials', 'Incorrect email or password.');
    }
    if (!user.emailVerifiedAt) {
      await sendCode(user.email, 'verify').catch(() => undefined);
      throw forbidden('email_not_verified', 'Please confirm your email first. We’ve sent you a new code.');
    }
    return signedIn(user.id, req.headers['user-agent']);
  });

  /** Google sign-in: the app sends the ID token from Google; new people get an account. */
  app.post('/auth/google', strict, async (req) => {
    const body = parse(z.object({ idToken: z.string().min(10).max(4096) }), req.body);
    const id = await ctx.googleAuth.verifyIdToken(body.idToken);
    const [bySub] = await db.select().from(users).where(eq(users.googleSub, id.sub));
    let user = bySub ?? (await findUserByEmail(db, id.email));
    let isNew = false;
    if (user && !user.googleSub) {
      // Same email, verified by Google: link the Google login to the existing account.
      await db.update(users).set({ googleSub: id.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    }
    if (!user) {
      user = await createUser(db, { email: id.email, name: id.name, provider: 'google', googleSub: id.sub, verified: true });
      isNew = true;
    }
    return { ...(await signedIn(user.id, req.headers['user-agent'])), isNew };
  });

  /** Always answers "sent", so it can't be used to find out who has an account. */
  app.post('/auth/forgot-password', strict, async (req) => {
    const body = parse(z.object({ email }), req.body);
    const user = await findUserByEmail(db, body.email);
    if (user) await sendCode(body.email, 'reset').catch((e) => (e instanceof AppError && e.status === 429 ? undefined : Promise.reject(e)));
    return { status: 'sent' };
  });

  /** Sets a new password with the emailed code and signs out every device. */
  app.post('/auth/reset-password', strict, async (req) => {
    const body = parse(z.object({ email, code, password: newPassword }), req.body);
    const user = await findUserByEmail(db, body.email);
    if (!user) throw badRequest('invalid_code', 'That code isn’t right. Check the email and try again.');
    await useCode(db, secrets, body.email, 'reset', body.code);
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.password), emailVerifiedAt: user.emailVerifiedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await revokeSessions(db, user.id);
    return { status: 'password_reset' };
  });

  await app.register(async (authed) => {
    authed.addHook('onRequest', requireAuth(ctx));

    /** Changes the password and signs out the person's other devices. */
    authed.post('/auth/change-password', strict, async (req) => {
      const { user, sessionId } = me(req);
      const body = parse(z.object({ current: z.string().max(128), next: newPassword }), req.body);
      if (!user.passwordHash) throw badRequest('no_password', 'Your account uses Google sign-in, so there’s no DriveFlow password to change.');
      if (!(await verifyPassword(body.current, user.passwordHash))) throw badRequest('wrong_password', 'Your current password is incorrect.');
      if (body.current === body.next) throw badRequest('same_password', 'Choose a new password, not your current one.');
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(body.next), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await revokeSessions(db, user.id, sessionId);
      return { status: 'password_changed' };
    });

    authed.post('/auth/sign-out', async (req, reply) => {
      await db.delete(sessions).where(eq(sessions.id, me(req).sessionId));
      return reply.code(204).send();
    });
  });
}
