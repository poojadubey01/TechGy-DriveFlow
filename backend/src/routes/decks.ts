import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { type Ctx, me, parse, photoPath, requireAuth } from '../context.js';
import type { Db } from '../db/client.js';
import { clients, decks, deckVisits, photos, type SlideRow, type users } from '../db/schema.js';
import { DECK_TITLE_MAX, DECK_TYPES, MIN_DECK_PHOTOS, SLIDE_TITLE_MAX, SLIDES_MAX, SLIDES_MIN, TEMPLATE_IDS } from '../domain/catalog.js';
import { buildSlides, coverTitle, uniqueTitle } from '../domain/slides.js';
import { newShareId } from '../lib/crypto.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getSettings } from '../services/account.js';
import { notify } from '../services/notify.js';
import { clientPhotos } from './drive.js';

type DeckRow = typeof decks.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

/** The cover slide always carries the deck's name. */
export const withCoverTitle = (deck: Pick<DeckRow, 'title' | 'slides'>) => deck.slides.map((s, i) => (i === 0 ? { ...s, title: deck.title } : s));

/** Photo ids in `ids` that are gone from Drive (removed or never existed for this user). */
async function missingPhotos(db: Db, userId: string, ids: readonly string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: photos.id, removedAt: photos.removedAt })
    .from(photos)
    .where(and(eq(photos.userId, userId), inArray(photos.id, [...new Set(ids)])));
  const ok = new Set(rows.filter((r) => !r.removedAt).map((r) => r.id));
  return new Set(ids.filter((id) => !ok.has(id)));
}

const edited = (d: DeckRow) => JSON.stringify(d.slides) !== JSON.stringify(d.builtSlides);

export function deckSummary(ctx: Ctx, d: DeckRow, client: Pick<ClientRow, 'id' | 'name'>, opens: number) {
  const coverId = d.slides[0]?.photoId ?? null;
  return {
    id: d.id,
    client: { id: client.id, name: client.name },
    type: d.type,
    title: d.title,
    template: d.template,
    slides: d.slides.length,
    builtSlides: d.builtSlides.length,
    edited: edited(d),
    cover: coverId ? { photoId: coverId, url: photoPath(ctx, coverId) } : null,
    share: { id: d.shareId, url: `${ctx.config.SHARE_BASE_URL}${d.shareId}`, active: d.shareActive, allowPdf: d.shareAllowPdf },
    opens,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

async function deckDetail(ctx: Ctx, d: DeckRow, client: ClientRow, user: typeof users.$inferSelect) {
  const [opens] = await ctx.db.select({ n: count() }).from(deckVisits).where(eq(deckVisits.deckId, d.id));
  const slides = withCoverTitle(d);
  const missing = await missingPhotos(ctx.db, user.id, slides.map((s) => s.photoId));
  return {
    ...deckSummary(ctx, d, client, opens?.n ?? 0),
    client: { id: client.id, name: client.name, meta: client.meta },
    sourcePhotoIds: d.sourcePhotoIds,
    sender: { name: user.name, email: user.email, company: user.company ?? undefined },
    slideList: slides.map((s) => ({ photoId: s.photoId, title: s.title, url: photoPath(ctx, s.photoId), missing: missing.has(s.photoId) })),
  };
}

export async function deckRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  app.addHook('onRequest', requireAuth(ctx));

  const ownDeck = async (userId: string, id: string) => {
    const [row] = await db
      .select({ deck: decks, client: clients })
      .from(decks)
      .innerJoin(clients, eq(clients.id, decks.clientId))
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
    if (!row) throw notFound('That deck');
    return row;
  };
  const idParam = (params: unknown) => parse(z.object({ id: z.uuid() }), params).id;

  /** Your decks, newest first (optionally for one client). */
  app.get('/decks', async (req) => {
    const { user } = me(req);
    const q = parse(z.object({ clientId: z.uuid().optional() }), req.query);
    const rows = await db
      .select({ deck: decks, client: clients })
      .from(decks)
      .innerJoin(clients, eq(clients.id, decks.clientId))
      .where(and(eq(decks.userId, user.id), q.clientId ? eq(decks.clientId, q.clientId) : undefined))
      .orderBy(desc(decks.createdAt));
    const ids = rows.map((r) => r.deck.id);
    const opens = ids.length ? await db.select({ deckId: deckVisits.deckId, n: count() }).from(deckVisits).where(inArray(deckVisits.deckId, ids)).groupBy(deckVisits.deckId) : [];
    return { decks: rows.map((r) => deckSummary(ctx, r.deck, r.client, opens.find((o) => o.deckId === r.deck.id)?.n ?? 0)) };
  });

  /**
   * Builds a deck: `slides` pages cycling through the chosen photos (or all of the client's photos),
   * cover titled with the deck's name and the other slides titled by what each photo shows.
   */
  app.post('/decks', async (req, reply) => {
    const { user } = me(req);
    const settings = await getSettings(db, user.id);
    const body = parse(
      z.object({
        clientId: z.uuid(),
        type: z.enum(DECK_TYPES),
        slides: z.number().int().min(SLIDES_MIN).max(SLIDES_MAX).optional(),
        title: z.string().trim().min(1).max(DECK_TITLE_MAX).optional(),
        photoIds: z.array(z.uuid()).min(1).max(200).optional(),
        template: z.enum(TEMPLATE_IDS).optional(),
      }),
      req.body,
    );
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, body.clientId), eq(clients.userId, user.id)));
    if (!client) throw notFound('That client');
    const gallery = await clientPhotos(db, client.id);

    let chosen = gallery;
    if (body.photoIds) {
      const byId = new Map(gallery.map((p) => [p.id, p]));
      const unique = [...new Set(body.photoIds)];
      if (unique.some((id) => !byId.has(id))) throw badRequest('invalid_photos', 'Some of those photos aren’t in this client’s folder any more.');
      chosen = unique.map((id) => byId.get(id)!);
      if (chosen.length < Math.min(MIN_DECK_PHOTOS, gallery.length)) throw badRequest('too_few_photos', `Pick at least ${MIN_DECK_PHOTOS} photos.`);
    }
    if (chosen.length === 0) throw badRequest('no_photos', 'This client’s folder has no photos yet. Add some in Google Drive and sync.');

    const taken = new Set((await db.select({ title: decks.title }).from(decks).where(and(eq(decks.userId, user.id), eq(decks.clientId, client.id)))).map((r) => r.title));
    const title = uniqueTitle((body.title ?? coverTitle(client, body.type)).slice(0, DECK_TITLE_MAX), taken);
    const slides = buildSlides(chosen, body.slides ?? settings.defaultSlides, title);

    let deck: DeckRow | undefined;
    for (let attempt = 0; !deck && attempt < 5; attempt++) {
      const rows = await db
        .insert(decks)
        .values({
          userId: user.id,
          clientId: client.id,
          type: body.type,
          title,
          template: body.template ?? settings.defaultTemplate,
          builtSlides: slides,
          slides,
          sourcePhotoIds: body.photoIds ? chosen.map((p) => p.id) : null,
          shareId: newShareId(),
        })
        .onConflictDoNothing({ target: decks.shareId })
        .returning();
      deck = rows[0];
    }
    if (!deck) throw new Error('Could not create a unique share link');

    await notify(ctx, user.id, {
      kind: 'ready',
      title: 'Your deck is ready',
      body: `${client.name} · ${deck.title}, ${slides.length} slides`,
      target: { pathname: '/ready', params: { deck: deck.id } },
    });
    return reply.code(201).send(await deckDetail(ctx, deck, client, user));
  });

  app.get('/decks/:id', async (req) => {
    const { user } = me(req);
    const { deck, client } = await ownDeck(user.id, idParam(req.params));
    return deckDetail(ctx, deck, client, user);
  });

  /** Renames the deck (the cover follows) and/or changes its template. */
  app.patch('/decks/:id', async (req) => {
    const { user } = me(req);
    const id = idParam(req.params);
    const body = parse(z.object({ title: z.string().trim().min(1, 'Give the deck a name.').max(DECK_TITLE_MAX).optional(), template: z.enum(TEMPLATE_IDS).optional() }), req.body);
    const { client } = await ownDeck(user.id, id);
    const [deck] = await db
      .update(decks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(decks.id, id))
      .returning();
    return deckDetail(ctx, deck!, client, user);
  });

  /** Saves Edit deck: the full slide list in order (reordered, renamed or removed slides). */
  app.put('/decks/:id/slides', async (req) => {
    const { user } = me(req);
    const id = idParam(req.params);
    const body = parse(
      z.object({
        slides: z
          .array(z.object({ photoId: z.uuid(), title: z.string().trim().min(1, 'Every slide needs a title.').max(SLIDE_TITLE_MAX) }))
          .min(1, 'A deck needs at least one slide.')
          .max(SLIDES_MAX),
      }),
      req.body,
    );
    const { client, deck: current } = await ownDeck(user.id, id);
    const allowed = new Set([...current.builtSlides, ...current.slides].map((s) => s.photoId));
    const own = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.clientId, client.id), inArray(photos.id, [...new Set(body.slides.map((s) => s.photoId))])));
    own.forEach((p) => allowed.add(p.id));
    if (body.slides.some((s) => !allowed.has(s.photoId))) throw badRequest('invalid_photos', 'Slides can only use this client’s photos.');
    const slides: SlideRow[] = body.slides.map((s, i) => ({ photoId: s.photoId, title: i === 0 ? current.title : s.title }));
    const [deck] = await db
      .update(decks)
      .set({ slides, updatedAt: new Date() })
      .where(eq(decks.id, id))
      .returning();
    return deckDetail(ctx, deck!, client, user);
  });

  /** "Reset" in Edit deck: back to the slides as built. */
  app.post('/decks/:id/reset', async (req) => {
    const { user } = me(req);
    const id = idParam(req.params);
    const { client, deck: current } = await ownDeck(user.id, id);
    const [deck] = await db
      .update(decks)
      .set({ slides: current.builtSlides, updatedAt: new Date() })
      .where(eq(decks.id, id))
      .returning();
    return deckDetail(ctx, deck!, client, user);
  });

  app.delete('/decks/:id', async (req, reply) => {
    const { user } = me(req);
    const id = idParam(req.params);
    await ownDeck(user.id, id);
    await db.delete(decks).where(eq(decks.id, id));
    return reply.code(204).send();
  });

  /* ------------------------------------------------------------- sharing */

  const shareView = (d: DeckRow) => ({ id: d.shareId, url: `${ctx.config.SHARE_BASE_URL}${d.shareId}`, active: d.shareActive, allowPdf: d.shareAllowPdf });

  app.get('/decks/:id/share', async (req) => shareView((await ownDeck(me(req).user.id, idParam(req.params))).deck));

  /** Stop / restart sharing, allow or block the PDF download on the client's page. */
  app.patch('/decks/:id/share', async (req) => {
    const { user } = me(req);
    const id = idParam(req.params);
    const body = parse(z.object({ active: z.boolean().optional(), allowPdf: z.boolean().optional() }), req.body);
    await ownDeck(user.id, id);
    const [deck] = await db
      .update(decks)
      .set({ ...(body.active !== undefined ? { shareActive: body.active } : {}), ...(body.allowPdf !== undefined ? { shareAllowPdf: body.allowPdf } : {}), updatedAt: new Date() })
      .where(eq(decks.id, id))
      .returning();
    return shareView(deck!);
  });

  /** A brand-new link; the old one stops working at once. */
  app.post('/decks/:id/share/new-link', async (req) => {
    const { user } = me(req);
    const id = idParam(req.params);
    await ownDeck(user.id, id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await db
        .update(decks)
        .set({ shareId: newShareId(), shareActive: true, updatedAt: new Date() })
        .where(eq(decks.id, id))
        .returning()
        .catch((e: unknown) => {
          // 23505 = unique violation (drizzle may wrap the driver error in `cause`).
          const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
          if (code === '23505') return [];
          throw e;
        });
      if (rows[0]) return shareView(rows[0]);
    }
    throw new Error('Could not create a unique share link');
  });

  /* ------------------------------------------------------------ activity */

  /** Client views of the share link: visits (newest first), time per slide and PDF downloads. */
  app.get('/decks/:id/activity', async (req) => {
    const { user } = me(req);
    const { deck } = await ownDeck(user.id, idParam(req.params));
    const visits = await db.select().from(deckVisits).where(eq(deckVisits.deckId, deck.id)).orderBy(desc(deckVisits.startedAt));
    const perSlide = Array.from({ length: deck.slides.length }, (_, i) => visits.reduce((sum, v) => sum + (v.slideSeconds[i] ?? 0), 0));
    return {
      opens: visits.length,
      totalSeconds: visits.reduce((s, v) => s + v.seconds, 0),
      downloads: visits.filter((v) => v.downloadedAt).length,
      perSlide,
      visits: visits.map((v) => ({
        id: v.id,
        startedAt: v.startedAt.toISOString(),
        lastSeenAt: v.lastSeenAt.toISOString(),
        device: v.device,
        seconds: v.seconds,
        downloaded: Boolean(v.downloadedAt),
      })),
    };
  });
}
