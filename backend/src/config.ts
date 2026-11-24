import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

/** The backend folder (works from src/ with tsx and from dist/ after a build). */
export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'on', 'off', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? fallback : ['true', '1', 'on', 'yes'].includes(v)));

const list = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

function schema(env: NodeJS.ProcessEnv) {
  const nodeEnv = env.NODE_ENV === 'production' || env.NODE_ENV === 'test' ? env.NODE_ENV : 'development';
  const isProd = nodeEnv === 'production';
  return z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default(nodeEnv),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Postgres connection string. Leave empty to use the embedded local database (PGlite). */
    DATABASE_URL: z.string().optional(),
    /** Where the embedded database keeps its files, or "memory" for a throwaway one. */
    PGLITE_DIR: z.string().default(path.join(BACKEND_ROOT, '.data', 'pglite')),
    /** Public address of this API (used in links inside emails and logs). */
    API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
    /** Share links are this + the deck's share code. */
    SHARE_BASE_URL: z.string().url().default('https://driveflow.app/p/'),
    /** Browser origins allowed to call the API (web app, share-link site). Empty = any origin outside production. */
    CORS_ORIGINS: list,
    /** Development stand-ins: mock Google sign-in, mock Drive, /dev routes. Never on in production. */
    DEV_MOCKS: bool(!isProd),
    RATE_LIMIT: bool(true),
    /** Set when running behind a proxy/load balancer, so rate limits see the real client IP. */
    TRUST_PROXY: bool(false),
    SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(60),
    /** Background Drive sync: re-read each connected folder this often (minutes). 0 turns it off. */
    /** Push notifications to phones through Expo's push service. */
    PUSH_ENABLED: bool(true),
    /** Optional Expo access token (if push security is turned on for the Expo project). */
    EXPO_ACCESS_TOKEN: z.string().optional(),
    /** Claude API key for the chat assistant. Without it the chat uses the built-in rule-based reader. */
    ANTHROPIC_API_KEY: z.string().optional(),
    ASSISTANT_MODEL: z.string().default('claude-opus-5-5'),
    SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).max(1440).default(30),
    /** 32 random bytes, base64. Encrypts Google tokens and signs email codes. */
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    EMAIL_FROM: z.string().default('DriveFlow <no-reply@driveflow.app>'),
    RESEND_API_KEY: z.string().optional(),
    /** Where Help-screen feedback is emailed (optional; it is always saved in the database). */
    SUPPORT_EMAIL: z.string().email().optional(),
    /** Google OAuth client IDs whose ID tokens are accepted for sign-in (web, iOS, Android). */
    GOOGLE_CLIENT_IDS: list,
    /** OAuth client used to exchange the Drive authorization code on the server. */
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    /** Photos served by the mock Drive (the app's sample images). */
    SAMPLE_PHOTOS_DIR: z.string().default(path.resolve(BACKEND_ROOT, '..', 'frontend', 'assets', 'images')),
  });
}

export type Config = z.infer<ReturnType<typeof schema>>;

/** A fixed development key, so local data survives restarts. Production must set its own. */
const DEV_KEY = Buffer.from('driveflow-development-only-key!!').toString('base64');

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<Config> = {}): Config {
  const parsed = schema(env).safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const config: Config = { ...parsed.data, ...overrides };
  if (config.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (config.DEV_MOCKS) problems.push('DEV_MOCKS must be false in production');
    if (!config.TOKEN_ENCRYPTION_KEY) problems.push('TOKEN_ENCRYPTION_KEY is required in production');
    if (!config.DATABASE_URL) problems.push('DATABASE_URL is required in production');
    if (config.EMAIL_PROVIDER === 'console') problems.push('EMAIL_PROVIDER=console would only log codes; use resend in production');
    if (config.EMAIL_PROVIDER === 'resend' && !config.RESEND_API_KEY) problems.push('RESEND_API_KEY is required for EMAIL_PROVIDER=resend');
    if (config.CORS_ORIGINS.length === 0) problems.push('CORS_ORIGINS must list the allowed web origins in production');
    if (problems.length) throw new Error(`Unsafe production configuration:\n  ${problems.join('\n  ')}`);
  }
  if (!config.TOKEN_ENCRYPTION_KEY) config.TOKEN_ENCRYPTION_KEY = DEV_KEY;
  if (Buffer.from(config.TOKEN_ENCRYPTION_KEY, 'base64').length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))")');
  }
  return config;
}

/** Reads backend/.env if it exists (Node's built-in loader; real environment variables win). */
export function loadEnvFile() {
  const file = path.join(BACKEND_ROOT, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
