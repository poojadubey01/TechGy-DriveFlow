import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { emailCodes } from '../src/db/schema.js';
import { call, codeFor, makeApp, newUser, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(async () => t.close());

describe('sign-up and email verification', () => {
  const email = 'meera.rao@example.com';
  const password = 'sunlit-garden-7';

  it('rejects a weak password and a bad email with readable messages', async () => {
    const weak = await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Meera', email, password: 'short' } });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('invalid_input');
    expect(weak.body.error.message).toBe('Use 8+ characters including a number.');
    expect(weak.body.error.fields.password).toBeTruthy();

    const badEmail = await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Meera', email: 'meera@', password } });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.message).toBe('Enter a valid email address.');
  });

  it('creates the account and emails a 6-digit code', async () => {
    const res = await call(t.app, 'POST', '/auth/sign-up', { body: { name: ' Meera Rao ', email: ' Meera.Rao@Example.com ', company: 'Rao Homes', password } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'verification_sent', email });
    expect(codeFor(t, email)).toMatch(/^\d{6}$/);
  });

  it('won’t sign in before the email is confirmed', async () => {
    const res = await call(t.app, 'POST', '/auth/sign-in', { body: { email, password } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('email_not_verified');
  });

  it('rejects a wrong code, then accepts the right one and signs in', async () => {
    const code = codeFor(t, email);
    const wrong = code === '123456' ? '654321' : '123456';
    const bad = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('invalid_code');

    const ok = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code } });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTypeOf('string');
    expect(ok.body.user).toMatchObject({ name: 'Meera Rao', email, company: 'Rao Homes', provider: 'email', emailVerified: true, hasPassword: true });

    const reuse = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code } });
    expect(reuse.status).toBe(400);
  });

  it('blocks signing up again with a confirmed email', async () => {
    const res = await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Meera', email, password } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('signs in with the right password only', async () => {
    const bad = await call(t.app, 'POST', '/auth/sign-in', { body: { email, password: 'wrong-pass-1' } });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toEqual({ code: 'invalid_credentials', message: 'Incorrect email or password.' });
    const unknown = await call(t.app, 'POST', '/auth/sign-in', { body: { email: 'nobody@example.com', password } });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('invalid_credentials');

    const ok = await call(t.app, 'POST', '/auth/sign-in', { body: { email: 'MEERA.RAO@example.com', password } });
    expect(ok.status).toBe(200);
    const meRes = await call(t.app, 'GET', '/me', { token: ok.body.token });
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);
  });
});

describe('codes', () => {
  it('locks a code after five wrong tries', async () => {
    const email = 'lock.test@example.com';
    await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Lock', email, password: 'pass-word-99' } });
    const code = codeFor(t, email);
    const wrong = code === '000001' ? '000002' : '000001';
    for (let i = 0; i < 5; i++) await call(t.app, 'POST', '/auth/verify-email', { body: { email, code: wrong } });
    const res = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('code_locked');
  });

  it('expires codes after 15 minutes', async () => {
    const email = 'expire.test@example.com';
    await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Exp', email, password: 'pass-word-99' } });
    await t.app.ctx.db
      .update(emailCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailCodes.email, email));
    const res = await call(t.app, 'POST', '/auth/verify-email', { body: { email, code: codeFor(t, email) } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('code_expired');
  });

  it('limits resends to one every 30 seconds and answers the same for unknown emails', async () => {
    const email = 'resend.test@example.com';
    await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'Re', email, password: 'pass-word-99' } });
    const again = await call(t.app, 'POST', '/auth/resend-code', { body: { email, purpose: 'verify' } });
    expect(again.status).toBe(429);
    const unknown = await call(t.app, 'POST', '/auth/resend-code', { body: { email: 'ghost@example.com', purpose: 'verify' } });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual({ status: 'sent' });
  });
});

describe('passwords', () => {
  it('resets a forgotten password with the emailed code and signs out every device', async () => {
    const u = await newUser(t);
    const forgot = await call(t.app, 'POST', '/auth/forgot-password', { body: { email: u.email } });
    expect(forgot.body).toEqual({ status: 'sent' });
    expect((await call(t.app, 'POST', '/auth/forgot-password', { body: { email: 'ghost@example.com' } })).body).toEqual({ status: 'sent' });

    const code = codeFor(t, u.email);
    const weak = await call(t.app, 'POST', '/auth/reset-password', { body: { email: u.email, code, password: 'nonumbers' } });
    expect(weak.status).toBe(400);
    const ok = await call(t.app, 'POST', '/auth/reset-password', { body: { email: u.email, code, password: 'brand-new-pass-1' } });
    expect(ok.status).toBe(200);

    expect((await call(t.app, 'GET', '/me', { token: u.token })).status).toBe(401);
    expect((await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: u.password } })).status).toBe(401);
    expect((await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: 'brand-new-pass-1' } })).status).toBe(200);
  });

  it('changes the password while signed in and signs out the other devices', async () => {
    const u = await newUser(t);
    const other = (await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: u.password } })).body.token;

    const wrong = await call(t.app, 'POST', '/auth/change-password', { token: u.token, body: { current: 'not-it-123', next: 'fresh-pass-22' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('wrong_password');
    const same = await call(t.app, 'POST', '/auth/change-password', { token: u.token, body: { current: u.password, next: u.password } });
    expect(same.body.error.code).toBe('same_password');

    const ok = await call(t.app, 'POST', '/auth/change-password', { token: u.token, body: { current: u.password, next: 'fresh-pass-22' } });
    expect(ok.status).toBe(200);
    expect((await call(t.app, 'GET', '/me', { token: u.token })).status).toBe(200);
    expect((await call(t.app, 'GET', '/me', { token: other })).status).toBe(401);
  });
});

describe('Google sign-in (development stand-in)', () => {
  it('creates an account for a new Google user', async () => {
    const res = await call(t.app, 'POST', '/auth/google', { body: { idToken: 'dev:rohan.mehta@example.com:Rohan Mehta' } });
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.user).toMatchObject({ name: 'Rohan Mehta', email: 'rohan.mehta@example.com', provider: 'google', hasPassword: false, emailVerified: true });

    const again = await call(t.app, 'POST', '/auth/google', { body: { idToken: 'dev:rohan.mehta@example.com:Rohan Mehta' } });
    expect(again.body.isNew).toBe(false);
    expect(again.body.user.id).toBe(res.body.user.id);
  });

  it('tells Google users to use Google instead of a password', async () => {
    const signIn = await call(t.app, 'POST', '/auth/sign-in', { body: { email: 'rohan.mehta@example.com', password: 'anything-1' } });
    expect(signIn.status).toBe(401);
    expect(signIn.body.error.code).toBe('use_google');
    const signUp = await call(t.app, 'POST', '/auth/sign-up', { body: { name: 'R', email: 'rohan.mehta@example.com', password: 'anything-12' } });
    expect(signUp.status).toBe(409);
    expect(signUp.body.error.code).toBe('use_google');
    const token = (await call(t.app, 'POST', '/auth/google', { body: { idToken: 'dev:rohan.mehta@example.com:Rohan Mehta' } })).body.token;
    const change = await call(t.app, 'POST', '/auth/change-password', { token, body: { current: 'x', next: 'whatever-12' } });
    expect(change.body.error.code).toBe('no_password');
  });

  it('links Google to an existing email account', async () => {
    const u = await newUser(t);
    const res = await call(t.app, 'POST', '/auth/google', { body: { idToken: `dev:${u.email}:Someone Else` } });
    expect(res.body.isNew).toBe(false);
    expect(res.body.user.id).toBe(u.user.id);
    expect(res.body.user.name).toBe(u.user.name);
  });

  it('rejects a token that isn’t valid', async () => {
    const res = await call(t.app, 'POST', '/auth/google', { body: { idToken: 'not-a-real-google-token' } });
    expect(res.status).toBe(401);
  });
});

describe('sessions', () => {
  it('needs a valid token for private routes', async () => {
    expect((await call(t.app, 'GET', '/me')).status).toBe(401);
    expect((await call(t.app, 'GET', '/me', { token: 'made-up-token' })).status).toBe(401);
    const res = await call(t.app, 'GET', '/decks', { token: 'made-up-token' });
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('signs out only this device', async () => {
    const u = await newUser(t);
    const other = (await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: u.password } })).body.token;
    expect((await call(t.app, 'POST', '/auth/sign-out', { token: u.token })).status).toBe(204);
    expect((await call(t.app, 'GET', '/me', { token: u.token })).status).toBe(401);
    expect((await call(t.app, 'GET', '/me', { token: other })).status).toBe(200);
  });
});
