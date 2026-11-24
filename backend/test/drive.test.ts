import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
    expect(h.cover.url).toBe(`/photos/${h.cover.id}/image`);
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

  it('serves the photo bytes to the owner only', async () => {
    const photo = (await call(t.app, 'GET', `/clients/${highrize}`, { token })).body.photos[0];
    const img = await call(t.app, 'GET', photo.url, { token });
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect(img.raw.subarray(0, 2).toString('hex')).toBe('ffd8'); // JPEG magic bytes

    const stranger = (await newUser(t)).token;
    expect((await call(t.app, 'GET', photo.url, { token: stranger })).status).toBe(404);
    expect((await call(t.app, 'GET', `/clients/${highrize}`, { token: stranger })).status).toBe(404);
    expect((await call(t.app, 'GET', photo.url)).status).toBe(401);
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
