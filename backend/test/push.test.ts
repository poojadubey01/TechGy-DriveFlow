import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, makeApp, newUser, type TestApp, withDrive } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(async () => t.close());

const settle = () => new Promise((r) => setTimeout(r, 60));
const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('push notifications', () => {
  it('registers a phone and pushes new notifications to it, with where to go on tap', async () => {
    const u = await newUser(t);
    const { byName } = await withDrive(t, u.token);
    expect((await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token: 'not-a-token', platform: 'android' } })).status).toBe(400);
    expect((await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token: TOKEN_A, platform: 'android' } })).status).toBe(204);

    const deck = (await call(t.app, 'POST', '/decks', { token: u.token, body: { clientId: byName('Highrize Villas').id, type: 'Portfolio' } })).body;
    await settle();
    const msg = t.push.sent.find((m) => m.to === TOKEN_A);
    expect(msg).toMatchObject({ title: 'Your deck is ready', body: 'Highrize Villas · Luxury villa portfolio, 12 slides' });
    expect(msg?.data?.target).toEqual({ pathname: '/ready', params: { deck: deck.id } });
  });

  it('respects the notification switches in Profile', async () => {
    const u = await newUser(t);
    const { byName } = await withDrive(t, u.token);
    await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token: TOKEN_B, platform: 'ios' } });
    await call(t.app, 'PATCH', '/me/settings', { token: u.token, body: { notifyReady: false } });
    const before = t.push.sent.length;
    await call(t.app, 'POST', '/decks', { token: u.token, body: { clientId: byName('Highrize Villas').id, type: 'Portfolio' } });
    await settle();
    expect(t.push.sent.length).toBe(before);
  });

  it('forgets uninstalled phones and stops pushing after sign-out', async () => {
    const u = await newUser(t);
    const { byName } = await withDrive(t, u.token);
    const gone = 'ExponentPushToken[gonegonegonegonegonegone]';
    await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token: gone, platform: 'android' } });
    t.push.gone.add(gone);
    await call(t.app, 'POST', '/decks', { token: u.token, body: { clientId: byName('Highrize Villas').id, type: 'Portfolio' } });
    await settle();
    const sentToGone = t.push.sent.filter((m) => m.to === gone).length;
    expect(sentToGone).toBe(1);
    await call(t.app, 'POST', '/decks', { token: u.token, body: { clientId: byName('Other Side Villas').id, type: 'Proposal' } });
    await settle();
    expect(t.push.sent.filter((m) => m.to === gone).length).toBe(1);

    // A token tied to a session goes away when that device signs out.
    const live = 'ExponentPushToken[livelivelivelivelivelive]';
    await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token: live, platform: 'android' } });
    await call(t.app, 'POST', '/auth/sign-out', { token: u.token });
    const other = (await call(t.app, 'POST', '/auth/sign-in', { body: { email: u.email, password: u.password } })).body.token;
    await call(t.app, 'POST', '/decks', { token: other, body: { clientId: byName('Reliance Elysium').id, type: 'Moodboard' } });
    await settle();
    expect(t.push.sent.filter((m) => m.to === live)).toHaveLength(0);
  });

  it('removes a phone when asked', async () => {
    const u = await newUser(t);
    const token = 'ExponentPushToken[removeremoveremoveremove]';
    await call(t.app, 'POST', '/me/push-tokens', { token: u.token, body: { token, platform: 'android' } });
    expect((await call(t.app, 'DELETE', '/me/push-tokens', { token: u.token, body: { token } })).status).toBe(204);
  });
});
