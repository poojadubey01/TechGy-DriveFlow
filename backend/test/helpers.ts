import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';
import { type Config, loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db/client.js';
import { ConsoleEmail } from '../src/services/email.js';
import type { MockDriveSource } from '../src/services/drive/mock.js';

export type TestApp = { app: FastifyInstance; email: ConsoleEmail; mockDrive: MockDriveSource; close: () => Promise<void> };

/** A full app on a fresh in-memory Postgres, with the console outbox and the mock Drive. */
export async function makeApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const config = loadConfig({ NODE_ENV: 'test' }, { PGLITE_DIR: 'memory', RATE_LIMIT: false, DEV_MOCKS: true, ...overrides });
  const database = createDatabase({ pgliteDir: 'memory' });
  await database.migrate();
  const email = new ConsoleEmail();
  const app = await buildApp({ config, database, email });
  await app.ready();
  return {
    app,
    email,
    mockDrive: app.ctx.drive.mock!,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export type Res<T = any> = { status: number; body: T; headers: Record<string, unknown>; raw: Buffer };

export async function call<T = any>(app: FastifyInstance, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, opts: { token?: string | null; body?: unknown; headers?: Record<string, string> } = {}): Promise<Res<T>> {
  const res = await app.inject({
    method,
    url,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const type = String(res.headers['content-type'] ?? '');
  return { status: res.statusCode, body: type.includes('json') && res.body ? res.json() : (res.body as T), headers: res.headers, raw: res.rawPayload };
}

/** The 6-digit code in the newest email to `to`. */
export function codeFor(t: TestApp, to: string) {
  const mail = t.email.latestFor(to);
  const code = mail?.text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error(`No code emailed to ${to}`);
  return code;
}

let counter = 0;

/** Signs up and verifies a new email account; returns its token and details. */
export async function newUser(t: TestApp, opts: { name?: string; company?: string; password?: string } = {}) {
  counter++;
  const email = `agent${counter}-${Date.now().toString(36)}@example.com`;
  const password = opts.password ?? 'walnut-river-42';
  const up = await call(t.app, 'POST', '/auth/sign-up', { body: { name: opts.name ?? 'Aisha Khan', email, company: opts.company ?? 'TechGy Link', password } });
  if (up.status !== 201) throw new Error(`sign-up failed: ${JSON.stringify(up.body)}`);
  const verified = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code: codeFor(t, email) } });
  if (verified.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verified.body)}`);
  return { token: verified.body.token as string, email, password, user: verified.body.user };
}

/** Connects the mock Drive, picks "Projects" and syncs it (4 clients, 7 photos each). */
export async function withDrive(t: TestApp, token: string) {
  await call(t.app, 'POST', '/drive/connect', { token, body: { mock: true } });
  await call(t.app, 'POST', '/drive/folder', { token, body: { folderId: 'mock-projects' } });
  const sync = await call(t.app, 'POST', '/drive/sync', { token });
  if (sync.status !== 200) throw new Error(`sync failed: ${JSON.stringify(sync.body)}`);
  const clients = (await call(t.app, 'GET', '/clients', { token })).body.clients as { id: string; name: string }[];
  const byName = (name: string) => clients.find((c) => c.name === name)!;
  return { clients, byName };
}
