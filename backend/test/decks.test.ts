import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, makeApp, newUser, type TestApp, withDrive } from './helpers.js';

let t: TestApp;
let token: string;
let clients: Awaited<ReturnType<typeof withDrive>>;

beforeAll(async () => {
  t = await makeApp();
  token = (await newUser(t, { company: 'TechGy Link' })).token;
  clients = await withDrive(t, token);
});
afterAll(async () => t.close());

const create = (body: Record<string, unknown>, as = token) => call(t.app, 'POST', '/decks', { token: as, body });

describe('building decks', () => {
  it('builds a deck from all the client’s photos with the default slide count and name', async () => {
    const res = await create({ clientId: clients.byName('Highrize Villas').id, type: 'Portfolio' });
    expect(res.status).toBe(201);
    const d = res.body;
    expect(d).toMatchObject({ title: 'Luxury villa portfolio', type: 'Portfolio', template: 'classic', slides: 12, builtSlides: 12, edited: false, opens: 0 });
    expect(d.client).toMatchObject({ name: 'Highrize Villas', meta: 'Luxury villas' });
    expect(d.share.id).toMatch(/^[a-z2-9]{12}$/);
    expect(d.share.url).toBe(`https://driveflow.techgylink.com/p/${d.share.id}`);
    expect(d.share).toMatchObject({ active: true, allowPdf: true });
    expect(d.slideList).toHaveLength(12);
    expect(d.slideList[0].title).toBe('Luxury villa portfolio');
    expect(d.slideList[1].title).toBe('Living spaces that open up');
    expect(d.slideList[5].title).toBe('Evenings at home');
    // 7 photos, 12 slides: the 8th slide reuses the first photo.
    expect(d.slideList[7].photoId).toBe(d.slideList[0].photoId);
    expect(d.sender).toMatchObject({ name: 'Aisha Khan', company: 'TechGy Link' });
  });

  it('numbers a repeated name and uses the requested count, photos and template', async () => {
    const detail = (await call(t.app, 'GET', `/clients/${clients.byName('Highrize Villas').id}`, { token })).body;
    const three = detail.photos.slice(1, 4).map((p: { id: string }) => p.id);
    const res = await create({ clientId: clients.byName('Highrize Villas').id, type: 'Portfolio', slides: 8, photoIds: three, template: 'bold' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Luxury villa portfolio 2', slides: 8, template: 'bold', sourcePhotoIds: three });
    expect(new Set(res.body.slideList.map((s: { photoId: string }) => s.photoId))).toEqual(new Set(three));
  });

  it('checks the request', async () => {
    const id = clients.byName('Highrize Villas').id;
    expect((await create({ clientId: id, type: 'Brochure' })).status).toBe(400);
    expect((await create({ clientId: id, type: 'Portfolio', slides: 3 })).status).toBe(400);
    expect((await create({ clientId: id, type: 'Portfolio', slides: 41 })).status).toBe(400);
    expect((await create({ clientId: id, type: 'Portfolio', template: 'neon' })).status).toBe(400);

    const detail = (await call(t.app, 'GET', `/clients/${id}`, { token })).body;
    const two = await create({ clientId: id, type: 'Portfolio', photoIds: detail.photos.slice(0, 2).map((p: { id: string }) => p.id) });
    expect(two.status).toBe(400);
    expect(two.body.error.code).toBe('too_few_photos');

    const otherClient = (await call(t.app, 'GET', `/clients/${clients.byName('Reliance Elysium').id}`, { token })).body.photos[0].id;
    const mixed = await create({ clientId: id, type: 'Portfolio', photoIds: [...detail.photos.slice(0, 3).map((p: { id: string }) => p.id), otherClient] });
    expect(mixed.body.error.code).toBe('invalid_photos');

    const stranger = (await newUser(t)).token;
    expect((await create({ clientId: id, type: 'Portfolio' }, stranger)).status).toBe(404);
  });

  it('follows the default slide count and template from settings', async () => {
    await call(t.app, 'PATCH', '/me/settings', { token, body: { defaultSlides: 15, defaultTemplate: 'editorial' } });
    const res = await create({ clientId: clients.byName('Vijetha Vaibhogam').id, type: 'Proposal' });
    expect(res.body).toMatchObject({ title: 'Villa township proposal', slides: 15, template: 'editorial' });
    await call(t.app, 'PATCH', '/me/settings', { token, body: { defaultSlides: 12, defaultTemplate: 'classic' } });
  });

  it('adds a “deck is ready” notification unless it’s turned off', async () => {
    const before = (await call(t.app, 'GET', '/notifications', { token })).body;
    const ready = before.items.filter((n: { kind: string }) => n.kind === 'ready');
    expect(ready.length).toBeGreaterThanOrEqual(3);
    expect(ready[0]).toMatchObject({ title: 'Your deck is ready', body: 'Vijetha Vaibhogam · Villa township proposal, 15 slides', read: false });
    expect(ready[0].target).toMatchObject({ pathname: '/ready' });

    await call(t.app, 'PATCH', '/me/settings', { token, body: { notifyReady: false } });
    await create({ clientId: clients.byName('Other Side Villas').id, type: 'Moodboard' });
    const after = (await call(t.app, 'GET', '/notifications', { token })).body.items.filter((n: { kind: string }) => n.kind === 'ready');
    expect(after).toHaveLength(ready.length);
    await call(t.app, 'PATCH', '/me/settings', { token, body: { notifyReady: true } });
  });
});

describe('managing a deck', () => {
  let id: string;
  beforeAll(async () => {
    id = (await create({ clientId: clients.byName('Reliance Elysium').id, type: 'Proposal' })).body.id;
  });

  it('lists decks newest first and filters by client', async () => {
    const all = (await call(t.app, 'GET', '/decks', { token })).body.decks;
    expect(all[0].id).toBe(id);
    expect(all[0].client.name).toBe('Reliance Elysium');
    const one = (await call(t.app, 'GET', `/decks?clientId=${clients.byName('Highrize Villas').id}`, { token })).body.decks;
    expect(one.map((d: { title: string }) => d.title)).toEqual(['Luxury villa portfolio 2', 'Luxury villa portfolio']);
  });

  it('renames the deck (the cover follows) and changes the template', async () => {
    const res = await call(t.app, 'PATCH', `/decks/${id}`, { token, body: { title: '  Tower B launch  ', template: 'split' } });
    expect(res.body).toMatchObject({ title: 'Tower B launch', template: 'split' });
    expect(res.body.slideList[0].title).toBe('Tower B launch');
    expect((await call(t.app, 'PATCH', `/decks/${id}`, { token, body: { title: '   ' } })).status).toBe(400);
  });

  it('saves edits (reorder, rename, remove) and resets back to the built slides', async () => {
    const d = (await call(t.app, 'GET', `/decks/${id}`, { token })).body;
    const edited = [d.slideList[0], d.slideList[3], { ...d.slideList[2], title: 'The lobby at dusk' }].map((s: { photoId: string; title: string }) => ({ photoId: s.photoId, title: s.title }));
    edited[0]!.title = 'Trying to rename the cover';
    const saved = await call(t.app, 'PUT', `/decks/${id}/slides`, { token, body: { slides: edited } });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ slides: 3, builtSlides: 12, edited: true });
    expect(saved.body.slideList.map((s: { title: string }) => s.title)).toEqual(['Tower B launch', d.slideList[3].title, 'The lobby at dusk']);

    const otherPhoto = (await call(t.app, 'GET', `/clients/${clients.byName('Highrize Villas').id}`, { token })).body.photos[0].id;
    const bad = await call(t.app, 'PUT', `/decks/${id}/slides`, { token, body: { slides: [{ photoId: otherPhoto, title: 'Nope' }] } });
    expect(bad.body.error.code).toBe('invalid_photos');
    expect((await call(t.app, 'PUT', `/decks/${id}/slides`, { token, body: { slides: [] } })).status).toBe(400);

    const reset = await call(t.app, 'POST', `/decks/${id}/reset`, { token });
    expect(reset.body).toMatchObject({ slides: 12, edited: false });
    expect(reset.body.slideList[0].title).toBe('Tower B launch');
  });

  it('keeps other people out', async () => {
    const stranger = (await newUser(t)).token;
    expect((await call(t.app, 'GET', `/decks/${id}`, { token: stranger })).status).toBe(404);
    expect((await call(t.app, 'PATCH', `/decks/${id}`, { token: stranger, body: { title: 'Mine now' } })).status).toBe(404);
    expect((await call(t.app, 'DELETE', `/decks/${id}`, { token: stranger })).status).toBe(404);
    expect((await call(t.app, 'GET', '/decks', { token: stranger })).body.decks).toEqual([]);
  });

  it('deletes a deck', async () => {
    const temp = (await create({ clientId: clients.byName('Reliance Elysium').id, type: 'Moodboard' })).body.id;
    expect((await call(t.app, 'DELETE', `/decks/${temp}`, { token })).status).toBe(204);
    expect((await call(t.app, 'GET', `/decks/${temp}`, { token })).status).toBe(404);
  });
});

describe('share links and the client view', () => {
  let deck: any;
  beforeAll(async () => {
    deck = (await create({ clientId: clients.byName('Other Side Villas').id, type: 'Proposal', slides: 8 })).body;
  });

  it('shows the deck on its link without signing in, with the brand and the sender', async () => {
    const res = await call(t.app, 'GET', `/public/decks/${deck.share.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Gated community proposal',
      type: 'Proposal',
      allowPdf: true,
      client: { name: 'Other Side Villas' },
      sender: { name: 'Aisha Khan', company: 'TechGy Link' },
      brand: { on: true, name: 'TechGy Link', accent: '#0022FF' },
    });
    expect(res.body.slides).toHaveLength(8);
    expect(res.body.slides[0].url).toMatch(new RegExp(`^/public/decks/${deck.share.id}/photos/`));
  });

  it('serves only the deck’s own photos through the link', async () => {
    const slide = (await call(t.app, 'GET', `/public/decks/${deck.share.id}`)).body.slides[0];
    const img = await call(t.app, 'GET', slide.url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');

    const notOnDeck = (await call(t.app, 'GET', `/clients/${clients.byName('Highrize Villas').id}`, { token })).body.photos[0].id;
    expect((await call(t.app, 'GET', `/public/decks/${deck.share.id}/photos/${notOnDeck}`)).status).toBe(404);
    expect((await call(t.app, 'GET', '/public/decks/notarealcode')).status).toBe(404);
    expect((await call(t.app, 'GET', '/public/decks/zzzzzzzzzzzz')).status).toBe(404);
  });

  it('records visits, time per slide and downloads, and tells the owner', async () => {
    const ua = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' };
    const v1 = await call(t.app, 'POST', `/public/decks/${deck.share.id}/visits`, { headers: ua, body: {} });
    expect(v1.status).toBe(201);
    expect(v1.body.token).toBeTypeOf('string');

    const progress = (body: unknown, visitId = v1.body.visitId) => call(t.app, 'POST', `/public/visits/${visitId}/progress`, { body });
    expect((await progress({ token: v1.body.token, entries: [{ slide: 0, seconds: 30 }, { slide: 1, seconds: 12 }] })).status).toBe(204);
    // Slide 20 doesn't exist on this 8-slide deck, so its seconds are ignored.
    expect((await progress({ token: v1.body.token, entries: [{ slide: 1, seconds: 8 }, { slide: 20, seconds: 5 }] })).status).toBe(204);
    expect((await progress({ token: 'wrong-token-123', entries: [{ slide: 0, seconds: 5 }] })).status).toBe(404);
    expect((await progress({ token: v1.body.token, entries: [{ slide: 0, seconds: 61 }] })).status).toBe(400);
    expect((await progress({ token: v1.body.token, entries: [{ slide: 0, seconds: 60 }, { slide: 1, seconds: 60 }, { slide: 2, seconds: 60 }] })).status).toBe(400);
    expect((await call(t.app, 'POST', `/public/visits/${v1.body.visitId}/download`, { body: { token: v1.body.token } })).status).toBe(204);

    const v2 = await call(t.app, 'POST', `/public/decks/${deck.share.id}/visits`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, body: {} });
    await progress({ token: v2.body.token, entries: [{ slide: 2, seconds: 20 }] }, v2.body.visitId);

    const activity = (await call(t.app, 'GET', `/decks/${deck.id}/activity`, { token })).body;
    expect(activity).toMatchObject({ opens: 2, totalSeconds: 70, downloads: 1 });
    expect(activity.perSlide).toEqual([30, 20, 20, 0, 0, 0, 0, 0]);
    expect(activity.visits.map((v: { device: string }) => v.device)).toEqual(['laptop', 'phone']);
    expect(activity.visits[1]).toMatchObject({ seconds: 50, downloaded: true });

    // Two visits within half an hour make one notification, updated.
    const viewed = (await call(t.app, 'GET', '/notifications', { token })).body.items.filter((n: { kind: string }) => n.kind === 'viewed');
    expect(viewed).toHaveLength(1);
    expect(viewed[0]).toMatchObject({ title: 'Other Side Villas opened your proposal', body: 'Viewed 2 times · Gated community proposal' });
    expect(viewed[0].target).toEqual({ pathname: '/activity', params: { deck: deck.id } });

    const list = (await call(t.app, 'GET', '/decks', { token })).body.decks.find((d: { id: string }) => d.id === deck.id);
    expect(list.opens).toBe(2);
  });

  it('doesn’t count the owner opening their own link', async () => {
    const res = await call(t.app, 'POST', `/public/decks/${deck.share.id}/visits`, { token, body: {} });
    expect(res.body).toEqual({ visitId: null, token: null, counted: false });
  });

  it('blocks the PDF download when it’s turned off', async () => {
    const share = await call(t.app, 'PATCH', `/decks/${deck.id}/share`, { token, body: { allowPdf: false } });
    expect(share.body).toMatchObject({ active: true, allowPdf: false });
    expect((await call(t.app, 'GET', `/public/decks/${deck.share.id}`)).body.allowPdf).toBe(false);
    const v = (await call(t.app, 'POST', `/public/decks/${deck.share.id}/visits`, { body: {} })).body;
    const res = await call(t.app, 'POST', `/public/visits/${v.visitId}/download`, { body: { token: v.token } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('pdf_not_allowed');
  });

  it('stops sharing, restarts it, and makes a new link that replaces the old one', async () => {
    await call(t.app, 'PATCH', `/decks/${deck.id}/share`, { token, body: { active: false } });
    const stopped = await call(t.app, 'GET', `/public/decks/${deck.share.id}`);
    expect(stopped.status).toBe(410);
    expect(stopped.body.error.code).toBe('link_stopped');
    expect((await call(t.app, 'POST', `/public/decks/${deck.share.id}/visits`, { body: {} })).status).toBe(410);

    await call(t.app, 'PATCH', `/decks/${deck.id}/share`, { token, body: { active: true } });
    expect((await call(t.app, 'GET', `/public/decks/${deck.share.id}`)).status).toBe(200);

    const fresh = await call(t.app, 'POST', `/decks/${deck.id}/share/new-link`, { token });
    expect(fresh.body.id).not.toBe(deck.share.id);
    expect((await call(t.app, 'GET', `/public/decks/${deck.share.id}`)).status).toBe(404);
    expect((await call(t.app, 'GET', `/public/decks/${fresh.body.id}`)).status).toBe(200);
  });

  it('marks notifications read one by one or all at once', async () => {
    const list = (await call(t.app, 'GET', '/notifications', { token })).body;
    expect(list.unread).toBeGreaterThan(1);
    expect((await call(t.app, 'POST', `/notifications/${list.items[0].id}/read`, { token })).status).toBe(204);
    expect((await call(t.app, 'GET', '/notifications', { token })).body.unread).toBe(list.unread - 1);
    await call(t.app, 'POST', '/notifications/read-all', { token });
    const after = (await call(t.app, 'GET', '/notifications', { token })).body;
    expect(after.unread).toBe(0);
    expect(after.items.every((n: { read: boolean }) => n.read)).toBe(true);
    expect((await call(t.app, 'GET', '/me', { token })).body.unreadNotifications).toBe(0);
  });
});
