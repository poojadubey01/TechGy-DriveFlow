import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import type { Config } from './config.js';
import type { Ctx } from './context.js';
import type { Database } from './db/client.js';
import { Secrets } from './lib/crypto.js';
import { AppError } from './lib/errors.js';
import { assistantRoutes } from './routes/assistant.js';
import { authRoutes } from './routes/auth.js';
import { deckRoutes } from './routes/decks.js';
import { driveRoutes } from './routes/drive.js';
import { meRoutes } from './routes/me.js';
import { publicRoutes } from './routes/public.js';
import { DriveService } from './services/drive/index.js';
import { MockDriveSource } from './services/drive/mock.js';
import { ConsoleEmail, type EmailSender, ResendEmail } from './services/email.js';
import { type GoogleAuth, GoogleOAuth, MockGoogleAuth, RealGoogleAuth } from './services/google.js';
import { ExpoPush, type PushSender } from './services/push.js';
import { type Assistant, createAssistant } from './services/assistant.js';

export type AppDeps = {
  config: Config;
  database: Database;
  /** Overrides for tests. */
  email?: EmailSender;
  googleAuth?: GoogleAuth;
  drive?: DriveService;
  push?: PushSender | null;
  assistant?: Assistant;
};

declare module 'fastify' {
  interface FastifyInstance {
    /** Shared services (database, email, Drive); tests use it to reach the outbox and mock Drive. */
    ctx: Ctx;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, database } = deps;
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.NODE_ENV === 'production' ? 'info' : 'debug', redact: ['req.headers.authorization'] },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
  });

  const secrets = new Secrets(config.TOKEN_ENCRYPTION_KEY!);
  const realGoogle = new RealGoogleAuth(config.GOOGLE_CLIENT_IDS);
  const ctx: Ctx = {
    config,
    database,
    db: database.db,
    secrets,
    email: deps.email ?? (config.EMAIL_PROVIDER === 'resend' ? new ResendEmail(config.RESEND_API_KEY!, config.EMAIL_FROM) : new ConsoleEmail(app.log)),
    googleAuth: deps.googleAuth ?? (config.DEV_MOCKS ? new MockGoogleAuth(config.GOOGLE_CLIENT_IDS.length ? realGoogle : undefined) : realGoogle),
    drive:
      deps.drive ??
      new DriveService(secrets, new GoogleOAuth(config.GOOGLE_OAUTH_CLIENT_ID, config.GOOGLE_OAUTH_CLIENT_SECRET), config.DEV_MOCKS ? new MockDriveSource(config.SAMPLE_PHOTOS_DIR) : null),
    push: deps.push !== undefined ? deps.push : config.PUSH_ENABLED ? new ExpoPush(config.EXPO_ACCESS_TOKEN) : null,
    assistant: deps.assistant ?? createAssistant({ apiKey: config.ANTHROPIC_API_KEY, model: config.ASSISTANT_MODEL, log: app.log }),
  };

  app.decorate('ctx', ctx);
  app.decorateRequest('auth', null);

  await app.register(helmet, {
    // Share-link pages on another origin load photos from here.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : config.NODE_ENV !== 'production',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  if (config.RATE_LIMIT) {
    await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  }

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
      const first = err.issues[0];
      const message = first && !first.message.startsWith('Invalid') && !first.message.startsWith('Too') ? first.message : 'Please check the details and try again.';
      return reply.code(400).send({ error: { code: 'invalid_input', message, fields } });
    }
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return reply.code(429).send({ error: { code: 'too_many_requests', message: 'Too many requests. Please wait a minute and try again.' } });
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: (err as FastifyError).code?.toLowerCase() ?? 'bad_request', message: 'The request couldn’t be read.' } });
    }
    req.log.error({ err }, 'Unhandled error');
    return reply.code(500).send({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint.' } }));

  await app.register(async (r) => publicRoutes(r, ctx));
  await app.register(async (r) => authRoutes(r, ctx));
  await app.register(async (r) => meRoutes(r, ctx));
  await app.register(async (r) => driveRoutes(r, ctx));
  await app.register(async (r) => deckRoutes(r, ctx));
  await app.register(async (r) => assistantRoutes(r, ctx));

  if (config.DEV_MOCKS && ctx.email instanceof ConsoleEmail) {
    const outbox = ctx.email;
    /** Development only: emails the server would have sent (verification and reset codes). */
    app.get('/dev/outbox', async () => ({ emails: outbox.outbox }));
  }

  return app;
}
