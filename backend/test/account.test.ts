import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { call, makeApp, newUser, type TestApp, withDrive } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(async () => t.close());

describe('profile, settings and brand kit', () => {
  it('returns everything the app needs on launch', async () => {
    const { token, email } = await newUser(t, { name: 'Aisha Khan', company: 'TechGy Link' });
    const res = await call(t.app, 'GET', '/me', { token });
    expect(res.body).toMatchObject({
      user: { name: 'Aisha Khan', email, company: 'TechGy Link', provider: 'email' },
      drive: { connected: false },
      settings: { defaultSlides: 12, defaultTemplate: 'classic', notifyReady: true, notifyViews: true, notifyPhotos: false },
      brand: { on: true, name: '', accent: '#0022FF', displayName: 'TechGy Link' },
      unreadNotifications: 0,
    });
  });

  it('edits the profile', async () => {
    const { token } = await newUser(t);
    const res = await call(t.app, 'PATCH', '/me', { token, body: { name: '  Aisha K. ', company: '' } });
    expect(res.body.user).toMatchObject({ name: 'Aisha K.' });
    expect(res.body.user.company).toBeUndefined();
    expect((await call(t.app, 'PATCH', '/me', { token, body: { name: '' } })).status).toBe(400);
    // With no company, the brand falls back to the person's name.
    expect((await call(t.app, 'GET', '/me/brand', { token })).body.displayName).toBe('Aisha K.');
  });

  it('saves settings and rejects values the app doesn’t offer', async () => {
    const { token } = await newUser(t);
    const ok = await call(t.app, 'PATCH', '/me/settings', { token, body: { defaultSlides: 8, notifyViews: false } });
    expect(ok.body).toMatchObject({ defaultSlides: 8, notifyViews: false, notifyReady: true });
    const bad = await call(t.app, 'PATCH', '/me/settings', { token, body: { defaultSlides: 10 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('Choose 8, 12, 15 slides.');
    expect((await call(t.app, 'PATCH', '/me/settings', { token, body: { defaultTemplate: 'neon' } })).status).toBe(400);
  });

  it('saves the brand kit', async () => {
    const { token } = await newUser(t);
    const res = await call(t.app, 'PATCH', '/me/brand', { token, body: { on: false, name: 'Rao Realty', accent: '#0f766e' } });
    expect(res.body).toEqual({ on: false, name: 'Rao Realty', accent: '#0F766E', displayName: 'Rao Realty' });
    expect((await call(t.app, 'PATCH', '/me/brand', { token, body: { accent: 'teal' } })).status).toBe(400);
    expect((await call(t.app, 'PATCH', '/me/brand', { token, body: { name: 'x'.repeat(41) } })).status).toBe(400);
  });
});

describe('deleting the account', () => {
  it('needs the account’s email typed exactly, then removes everything', async () => {
    const u = await newUser(t);
    const { byName } = await withDrive(t, u.token);
    const deck = (await call(t.app, 'POST', '/decks', { token: u.token, body: { clientId: byName('Highrize Villas').id, type: 'Portfolio' } })).body;

    const wrong = await call(t.app, 'DELETE', '/me', { token: u.token, body: { email: 'someone@example.com' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('email_mismatch');

    expect((await call(t.app, 'DELETE', '/me', { token: u.token, body: { email: ` ${u.email.toUpperCase()} ` } })).status).toBe(204);
    expect((await call(t.app, 'GET', '/me', { token: u.token })).status).toBe(401);
    expect((await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: u.password } })).status).toBe(401);
    expect((await call(t.app, 'GET', `/public/decks/${deck.share.id}`)).status).toBe(404);
  });
});

describe('support, meta and health', () => {
  it('takes feedback from anyone, needing an email only when signed out', async () => {
    expect((await call(t.app, 'POST', '/support/feedback', { body: { message: 'The PDF export is great, thanks!' } })).body.error.code).toBe('email_required');
    expect((await call(t.app, 'POST', '/support/feedback', { body: { message: 'short', email: 'a@example.com' } })).status).toBe(400);
    expect((await call(t.app, 'POST', '/support/feedback', { body: { message: 'The PDF export is great, thanks!', email: 'a@example.com' } })).status).toBe(201);
    const { token } = await newUser(t);
    expect((await call(t.app, 'POST', '/support/feedback', { token, body: { message: 'Could decks have a map slide?', device: 'Pixel 10 Pro' } })).status).toBe(201);
  });

  it('serves the fixed lists, health and JSON 404s', async () => {
    const meta = (await call(t.app, 'GET', '/meta')).body;
    expect(meta.deckTypes).toEqual(['Portfolio', 'Proposal', 'Moodboard']);
    expect(meta.templates.map((x: { id: string }) => x.id)).toEqual(['classic', 'editorial', 'split', 'bold']);
    expect(meta).toMatchObject({ slidesMin: 4, slidesMax: 40, minDeckPhotos: 3, shareBaseUrl: 'https://driveflow.techgylink.com/p/' });
    expect((await call(t.app, 'GET', '/health')).body).toEqual({ ok: true, database: 'pglite' });
    const missing = await call(t.app, 'GET', '/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('not_found');
  });

  it('turns bad JSON into a 400, not a crash', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/auth/sign-in', headers: { 'content-type': 'application/json' }, payload: '{"email":' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('The request couldn’t be read.');
  });

  it('shows emailed codes in the development outbox', async () => {
    await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Outbox', email: 'outbox@example.com', password: 'pass-word-99' } });
    const box = (await call(t.app, 'GET', '/dev/outbox')).body.emails;
    expect(box[0]).toMatchObject({ to: 'outbox@example.com' });
    expect(box[0].subject).toMatch(/^\d{6} is your DriveFlow code$/);
  });
});

describe('configuration', () => {
  it('refuses unsafe production settings', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DEV_MOCKS must be false|TOKEN_ENCRYPTION_KEY is required/);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DEV_MOCKS: 'false',
        TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        DATABASE_URL: 'postgres://u:p@localhost:5432/driveflow',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test',
        CORS_ORIGINS: 'https://driveflow.techgylink.com',
        GOOGLE_CLIENT_IDS: 'web.apps.googleusercontent.com',
        GOOGLE_OAUTH_CLIENT_ID: 'web.apps.googleusercontent.com',
        GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
      }),
    ).not.toThrow();
  });

  it('requires the Google keys in production', () => {
    const safe = {
      NODE_ENV: 'production',
      DEV_MOCKS: 'false',
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      DATABASE_URL: 'postgres://u:p@localhost:5432/driveflow',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
      CORS_ORIGINS: 'https://driveflow.techgylink.com',
    } as const;
    expect(() => loadConfig(safe)).toThrow(/GOOGLE_CLIENT_IDS is required/);
    expect(() => loadConfig({ ...safe, GOOGLE_CLIENT_IDS: 'web.apps.googleusercontent.com' })).toThrow(/GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET/);
  });

  it('rejects an encryption key of the wrong length', () => {
    expect(() => loadConfig({ NODE_ENV: 'development', TOKEN_ENCRYPTION_KEY: 'c2hvcnQ=' })).toThrow(/32 bytes/);
  });
});
