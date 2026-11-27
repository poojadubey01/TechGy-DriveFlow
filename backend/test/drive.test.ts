import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { call, makeApp, newUser, type TestApp, withDrive } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(async () => t.close());

describe('connecting Google Drive', () => {
  it('walks through connect → choose folder → sync', async () => {
    const { token, email } = await newUser(t);
    expect((await call(t.app, 'GET', '/drive', { token })).body).toEqual({ connected: false, account: null, folder: null, lastSync: null, provider: null });

    const early = await call(t.app, 'GET', '/drive/folders', { token });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('drive_not_connected');

    const connected = await call(t.app, 'POST', '/drive/connect', { token, body: { mock: true } });
    expect(connected.body).toMatchObject({ connected: true, account: email, folder: null, provider: 'mock' });

    const folders = await call(t.app, 'GET', '/drive/folders', { token });
    expect(folders.status).toBe(200);
    const projects = folders.body.folders.find((f: { name: string }) => f.name === 'Projects');
    expect(projects).toMatchObject({ id: 'mock-projects', clientFolders: 4, recommended: true });
    expect(folders.body.folders.find((f: { name: string }) => f.name === 'Marketing').recommended).toBe(false);

    expect((await call(t.app, 'POST', '/drive/sync', { token })).body.error.code).toBe('drive_folder_missing');
    expect((await call(t.app, 'POST', '/drive/folder', { token, body: { folderId: 'nope' } })).status).toBe(404);
    const chosen = await call(t.app, 'POST', '/drive/folder', { token, body: { folderId: 'mock-projects' } });
    expect(chosen.body.folder).toEqual({ id: 'mock-projects', name: 'Projects' });

    const sync = await call(t.app, 'POST', '/drive/sync', { token });
    expect(sync.status).toBe(200);
    expect(sync.body.result).toEqual({ clients: 4, photos: 28, newPhotos: 28 });
    expect(sync.body.drive.lastSync).toBeTruthy();

    // The first import isn't "new photos" news.
    const notes = await call(t.app, 'GET', '/notifications', { token });
    expect(notes.body.items.filter((n: { kind: string }) => n.kind === 'photos')).toHaveLength(0);
  });

  it('refuses the mock Drive when development stand-ins are off', async () => {
    const prod = await makeApp({ DEV_MOCKS: false });
    try {
      // With mocks off there is no dev Google or sample Drive, but email sign-up still works.
      const { token } = await newUser(prod);
      const res = await call(prod.app, 'POST', '/drive/connect', { token, body: { mock: true } });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('mock_disabled');
      const google = await call(prod.app, 'POST', '/auth/google', { body: { idToken: 'dev:x@example.com:X' } });
      expect(google.status).toBe(400);
      expect(google.body.error.code).toBe('google_not_configured');
    } finally {
      await prod.close();
    }
  });

  it('connects real Drive with the app’s server auth code (no redirect URI)', async () => {
    const real = await makeApp({ GOOGLE_OAUTH_CLIENT_ID: 'web.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret' });
    const sent: URLSearchParams[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: { body?: URLSearchParams }) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        sent.push(new URLSearchParams(init?.body));
        return Response.json({ access_token: 'at', expires_in: 3600, refresh_token: 'rt', scope: 'openid https://www.googleapis.com/auth/drive.readonly' });
      }
      if (url.startsWith('https://www.googleapis.com/drive/v3/about')) return Response.json({ user: { emailAddress: 'Agent@Gmail.com' } });
      throw new Error(`Unexpected fetch ${url}`);
    });
    try {
      const { token } = await newUser(real);
      const res = await call(real.app, 'POST', '/drive/connect', { token, body: { code: '4/server-auth-code' } });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ connected: true, account: 'agent@gmail.com', provider: 'google', folder: null });
      expect(Object.fromEntries(sent[0]!)).toEqual({
        client_id: 'web.apps.googleusercontent.com',
        client_secret: 'secret',
        grant_type: 'authorization_code',
        code: '4/server-auth-code',
        redirect_uri: '',
      });
    } finally {
      vi.unstubAllGlobals();
      await real.close();
    }
  });

  it('disconnects Drive', async () => {
    const { token } = await newUser(t);
    await withDrive(t, token);
    expect((await call(t.app, 'DELETE', '/drive', { token })).status).toBe(204);
    expect((await call(t.app, 'GET', '/drive', { token })).body.connected).toBe(false);
  });
});

describe('clients and photos', () => {
  let token: string;
  let highrize: string;

  beforeAll(async () => {
    token = (await newUser(t)).token;
    highrize = (await withDrive(t, token)).byName('Highrize Villas').id;
  });

  it('lists clients from the Drive sub-folders with counts and an exterior cover', async () => {
    const res = await call(t.app, 'GET', '/clients', { token });
    expect(res.body.clients.map((c: { name: string }) => c.name)).toEqual(['Highrize Villas', 'Other Side Villas', 'Reliance Elysium', 'Vijetha Vaibhogam']);
    const h = res.body.clients[0];
    expect(h).toMatchObject({ name: 'Highrize Villas', meta: 'Luxury villas', photos: 7, decks: 0 });
    expect(h.cover).toMatchObject({ name: 'highrize.jpg', kind: 'exterior' });
    expect(h.cover.url).toMatch(new RegExp(`^/photos/${h.cover.id}/image\\?exp=\\d+&sig=[\\w-]+$`));
  });

  it('labels photos by what they show', async () => {
    const res = await call(t.app, 'GET', `/clients/${highrize}`, { token });
    const kinds = Object.fromEntries(res.body.photos.map((p: { name: string; kind: string }) => [p.name, p.kind]));
    expect(kinds).toEqual({
      'highrize.jpg': 'exterior',
      'highrize-living.jpg': 'interior',
      'highrize-dining.jpg': 'interior',
      'highrize-suite.jpg': 'interior',
      'highrize-kitchen.jpg': 'interior',
      'villas-night.jpg': 'night',
      'vijetha-pool.jpg': 'exterior',
    });
  });

  it('proposes photos for the chat’s “which photos?” answers', async () => {
    const interiors = await call(t.app, 'POST', `/clients/${highrize}/pick-photos`, { token, body: { choice: 'Interiors' } });
    expect(interiors.body.photos).toHaveLength(4);
    expect(interiors.body.note).toBeNull();

    const night = await call(t.app, 'POST', `/clients/${highrize}/pick-photos`, { token, body: { choice: 'evening shots' } });
    expect(night.body.photos[0].name).toBe('villas-night.jpg');
    expect(night.body.photos).toHaveLength(4);
    expect(night.body.note).toBe('I found only 1 night shot, so I added some of your best photos.');

    const vague = await call(t.app, 'POST', `/clients/${highrize}/pick-photos`, { token, body: { choice: 'something nice' } });
    expect(vague.body.photos).toHaveLength(7);
    expect(vague.body.note).toMatch(/couldn’t match/);
  });

  it('serves photo bytes through its signed URL, or to the owner with no signature', async () => {
    const [photo, other] = (await call(t.app, 'GET', `/clients/${highrize}`, { token })).body.photos;
    // The signed URL works on its own (image views, <img> tags, the PDF).
    const img = await call(t.app, 'GET', photo.url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect(img.raw.subarray(0, 2).toString('hex')).toBe('ffd8'); // JPEG magic bytes

    const bare = `/photos/${photo.id}/image`;
    const stranger = (await newUser(t)).token;
    expect((await call(t.app, 'GET', bare, { token })).status).toBe(200);
    expect((await call(t.app, 'GET', bare, { token: stranger })).status).toBe(404);
    expect((await call(t.app, 'GET', bare)).status).toBe(401);
    expect((await call(t.app, 'GET', `/clients/${highrize}`, { token: stranger })).status).toBe(404);

    // A signature only opens its own photo, can't be edited and expires.
    const query = photo.url.split('?')[1];
    expect((await call(t.app, 'GET', `/photos/${other.id}/image?${query}`)).status).toBe(401);
    expect((await call(t.app, 'GET', photo.url.replace(/sig=./, 'sig=x'))).status).toBe(401);
    const past = Math.floor(Date.now() / 1000) - 60;
    expect((await call(t.app, 'GET', photo.url.replace(/exp=\d+/, `exp=${past}`))).status).toBe(401);
  });

  it('serves photos resized, made once and reused', async () => {
    const [photo] = (await call(t.app, 'GET', `/clients/${highrize}`, { token })).body.photos;
    // The sync already prepared every size in the background: no Drive download from here on.
    await t.app.ctx.photoSizes.settled();
    const download = vi.spyOn(t.mockDrive, 'download');
    // The sample photos are 1400 px wide: the default size (1600) never enlarges them.
    const full = await call(t.app, 'GET', photo.url);
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toBe('image/jpeg');
    expect((await sharp(full.raw).metadata()).width).toBe(1400);
    // ?w= picks the next size up; the thumbnail is a fraction of the bytes.
    const thumb = await call(t.app, 'GET', `${photo.url}&w=300`);
    expect(thumb.status).toBe(200);
    const meta = await sharp(thumb.raw).metadata();
    expect(meta.width).toBe(320);
    expect(meta.format).toBe('jpeg');
    expect(thumb.raw.length).toBeLessThan(full.raw.length / 4);
    // Asking again is served from the same files.
    expect((await call(t.app, 'GET', `${photo.url}&w=300`)).raw.equals(thumb.raw)).toBe(true);
    expect((await call(t.app, 'GET', photo.url)).raw.equals(full.raw)).toBe(true);
    expect(download).not.toHaveBeenCalled();
    expect((await call(t.app, 'GET', `${photo.url}&w=abc`)).status).toBe(400);
    download.mockRestore();
  });

  it('keeps a kind fixed by hand across syncs', async () => {
    const photo = (await call(t.app, 'GET', `/clients/${highrize}`, { token })).body.photos.find((p: { name: string }) => p.name === 'vijetha-pool.jpg');
    const fixed = await call(t.app, 'PATCH', `/photos/${photo.id}`, { token, body: { kind: 'night' } });
    expect(fixed.body.kind).toBe('night');
    expect((await call(t.app, 'PATCH', `/photos/${photo.id}`, { token, body: { kind: 'garage' } })).status).toBe(400);
    await call(t.app, 'POST', '/drive/sync', { token });
    const after = (await call(t.app, 'GET', `/clients/${highrize}`, { token })).body.photos.find((p: { name: string }) => p.name === 'vijetha-pool.jpg');
    expect(after.kind).toBe('night');
  });

  it('edits a client’s description', async () => {
    const res = await call(t.app, 'PATCH', `/clients/${highrize}`, { token, body: { meta: 'Sea-facing villas' } });
    expect(res.body.meta).toBe('Sea-facing villas');
  });

  it('picks up new and deleted Drive photos, with a notification when turned on', async () => {
    await call(t.app, 'PATCH', '/me/settings', { token, body: { notifyPhotos: true } });
    const added = t.mockDrive.addImage('mock-elysium', 'elysium-terrace-view.jpg');
    const sync = await call(t.app, 'POST', '/drive/sync', { token });
    expect(sync.body.result.newPhotos).toBe(1);

    const notes = (await call(t.app, 'GET', '/notifications', { token })).body.items;
    const photosNote = notes.find((n: { kind: string }) => n.kind === 'photos');
    expect(photosNote).toMatchObject({ title: '1 new photo in Google Drive', body: 'Added to Projects / Reliance Elysium', read: false });
    expect(photosNote.target.pathname).toBe('/client/[id]');

    const elysium = (await call(t.app, 'GET', '/clients', { token })).body.clients.find((c: { name: string }) => c.name === 'Reliance Elysium');
    expect(elysium.photos).toBe(8);

    t.mockDrive.removeImage(added);
    await call(t.app, 'POST', '/drive/sync', { token });
    const after = (await call(t.app, 'GET', '/clients', { token })).body.clients.find((c: { name: string }) => c.name === 'Reliance Elysium');
    expect(after.photos).toBe(7);
  });
});

describe('background sync', () => {
  it('re-syncs folders that are due, picks up new photos and notifies', async () => {
    const { syncDue } = await import('../src/services/autosync.js');
    const { driveConnections } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const u = await newUser(t);
    await withDrive(t, u.token);
    await call(t.app, 'PATCH', '/me/settings', { token: u.token, body: { notifyPhotos: true } });

    // Just synced: nothing is due yet.
    const fresh = await syncDue(t.app.ctx, 30);
    expect(fresh.synced).toBe(0);

    // An hour later, with a new photo in Drive, the background sync picks it up.
    const hourAgo = new Date(Date.now() - 60 * 60_000);
    await t.app.ctx.db.update(driveConnections).set({ lastSyncAt: hourAgo }).where(eq(driveConnections.userId, u.user.id));
    const added = t.mockDrive.addImage('mock-vijetha', 'vijetha-garden-view.jpg');
    const due = await syncDue(t.app.ctx, 30);
    expect(due.synced).toBeGreaterThanOrEqual(1);
    const note = (await call(t.app, 'GET', '/notifications', { token: u.token })).body.items.find((n: { kind: string }) => n.kind === 'photos');
    expect(note).toMatchObject({ title: '1 new photo in Google Drive', body: 'Added to Projects / Vijetha Vaibhogam' });
    expect((await call(t.app, 'GET', '/drive', { token: u.token })).body.lastSync).not.toBe(hourAgo.toISOString());
    t.mockDrive.removeImage(added);
  });
});
