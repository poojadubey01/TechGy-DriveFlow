import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { type Ctx, loadAuth, parse, publicPhotoPath } from '../context.js';
import { brandKits, clients, decks, deckVisits, feedback, photos, users } from '../db/schema.js';
import { ACCENTS, DECK_TYPES, MIN_DECK_PHOTOS, PHOTO_CHOICES, SLIDE_CHOICES, SLIDES_MAX, SLIDES_MIN, TEMPLATES } from '../domain/catalog.js';
import { isShareId, newToken, sha256 } from '../lib/crypto.js';
import { deviceFromUserAgent } from '../lib/device.js';
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { brandFallback } from '../services/account.js';
import { notify } from '../services/notify.js';
import { photoSize } from '../services/photoSizes.js';
import { photoQuery, sendPhoto } from './drive.js';
import { withCoverTitle } from './decks.js';

/** No sign-in: the client's view of a share link, its photos and visit tracking. Plus meta, health and feedback. */
export async function publicRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  const limited = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };

  /** The deck behind a share code, if sharing is on. */
  const sharedDeck = async (shareId: string) => {
    if (!isShareId(shareId)) throw notFound('That link');
    const [row] = await db
      .select({ deck: decks, client: clients, owner: users })
      .from(decks)
      .innerJoin(clients, eq(clients.id, decks.clientId))
      .innerJoin(users, eq(users.id, decks.userId))
      .where(eq(decks.shareId, shareId));
    if (!row) throw notFound('That link');
    if (!row.deck.shareActive) throw new AppError(410, 'link_stopped', 'This link is no longer active. Ask the sender for a new one.');
    return row;
  };
  const shareParam = (params: unknown) => parse(z.object({ shareId: z.string().max(20) }), params).shareId;

  app.get('/public/decks/:shareId', limited, async (req) => {
    const shareId = shareParam(req.params);
    const { deck, client, owner } = await sharedDeck(shareId);
    const [brand] = await db.select().from(brandKits).where(eq(brandKits.userId, owner.id));
    const ids = [...new Set(deck.slides.map((s) => s.photoId))];
    const live = ids.length
      ? await db
          .select({ id: photos.id })
          .from(photos)
          .where(and(eq(photos.userId, owner.id), inArray(photos.id, ids), isNull(photos.removedAt)))
      : [];
    const ok = new Set(live.map((p) => p.id));
    return {
      title: deck.title,
      type: deck.type,
      template: deck.template,
      allowPdf: deck.shareAllowPdf,
      client: { name: client.name, meta: client.meta },
      sender: { name: owner.name, email: owner.email, company: owner.company ?? undefined },
      brand: brand ? { on: brand.on, name: brand.name.trim() || brandFallback(owner), accent: brand.accent } : { on: false, name: brandFallback(owner), accent: '#0022FF' },
      slides: withCoverTitle(deck).map((s) => ({ title: s.title, url: publicPhotoPath(deck.shareId, s.photoId), missing: !ok.has(s.photoId) })),
    };
  });

  app.get('/public/decks/:shareId/photos/:photoId', limited, async (req, reply) => {
    const { shareId, photoId } = parse(z.object({ shareId: z.string().max(20), photoId: z.uuid() }), req.params);
    const { deck } = await sharedDeck(shareId);
    // Only photos that are actually on this deck's slides can be fetched through its link.
    if (!deck.slides.some((s) => s.photoId === photoId)) throw notFound('That photo');
    const [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, deck.userId)));
    if (!photo) throw notFound('That photo');
    const { w } = parse(photoQuery, req.query);
    return sendPhoto(ctx, reply, photo, 'private, max-age=600', photoSize(w));
  });

  /**
   * A photo's bytes, for the signed URLs the API hands out (`?exp=&sig=`), or for a signed-in owner
   * without a signature. A signature only opens the one photo it was made for, until it expires.
   */
  app.get('/photos/:id/image', limited, async (req, reply) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const q = parse(photoQuery.extend({ exp: z.coerce.number().int().optional(), sig: z.string().max(100).optional() }), req.query);
    const signed = q.exp !== undefined && q.sig !== undefined && q.exp > Date.now() / 1000 && ctx.secrets.macEquals(`photo:${id}:${q.exp}`, q.sig);
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    if (!signed) {
      const auth = await loadAuth(ctx, req);
      if (!auth) throw unauthorized('This photo link has expired. Reload the page.');
      if (!photo || photo.userId !== auth.user.id) throw notFound('That photo');
    }
    if (!photo) throw notFound('That photo');
    return sendPhoto(ctx, reply, photo, 'private, max-age=86400', photoSize(q.w));
  });

  /** The client opened the link: starts a visit and tells the owner. Returns a token for progress reports. */
  app.post('/public/decks/:shareId/visits', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const shareId = shareParam(req.params);
    const body = parse(z.object({ device: z.enum(['phone', 'laptop', 'tablet']).optional() }), req.body);
    const { deck, client } = await sharedDeck(shareId);
    // The owner previewing their own link doesn't count as a client view.
    const viewer = await loadAuth(ctx, req).catch(() => null);
    if (viewer?.user.id === deck.userId) return reply.code(200).send({ visitId: null, token: null, counted: false });

    const token = newToken(24);
    const ua = req.headers['user-agent'];
    const [visit] = await db
      .insert(deckVisits)
      .values({ deckId: deck.id, tokenHash: sha256(token), device: body.device ?? deviceFromUserAgent(ua), userAgent: ua?.slice(0, 300) ?? null })
      .returning({ id: deckVisits.id });
    const [total] = await db.select({ n: count() }).from(deckVisits).where(eq(deckVisits.deckId, deck.id));
    const n = total?.n ?? 1;
    await notify(ctx, deck.userId, {
      kind: 'viewed',
      title: `${client.name} opened your ${deck.type.toLowerCase()}`,
      body: `Viewed ${n} ${n === 1 ? 'time' : 'times'} · ${deck.title}`,
      target: { pathname: '/activity', params: { deck: deck.id } },
      dedupeKey: `viewed:${deck.id}`,
      windowMs: 30 * 60_000,
    });
    return reply.code(201).send({ visitId: visit!.id, token, counted: true });
  });

  const visitFor = async (visitId: string, token: string) => {
    const [row] = await db
      .select({ visit: deckVisits, deck: decks })
      .from(deckVisits)
      .innerJoin(decks, eq(decks.id, deckVisits.deckId))
      .where(eq(deckVisits.id, visitId));
    if (!row || row.visit.tokenHash !== sha256(token)) throw notFound('That visit');
    if (!row.deck.shareActive) throw new AppError(410, 'link_stopped', 'This link is no longer active.');
    return row;
  };

  /** Time spent on slides, sent every few seconds by the client's page. Capped so it can't be inflated. */
  app.post('/public/visits/:visitId/progress', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { visitId } = parse(z.object({ visitId: z.uuid() }), req.params);
    const body = parse(
      z.object({
        token: z.string().min(10).max(100),
        entries: z
          .array(z.object({ slide: z.number().int().min(0).max(SLIDES_MAX - 1), seconds: z.number().int().min(1).max(60) }))
          .min(1)
          .max(20),
      }),
      req.body,
    );
    const total = body.entries.reduce((s, e) => s + e.seconds, 0);
    if (total > 120) throw badRequest('too_much_time', 'Report progress at least every two minutes.');
    const { visit, deck } = await visitFor(visitId, body.token);
    const perSlide = [...visit.slideSeconds];
    for (const e of body.entries) {
      if (e.slide >= deck.slides.length) continue;
      while (perSlide.length <= e.slide) perSlide.push(0);
      perSlide[e.slide]! += e.seconds;
    }
    await db
      .update(deckVisits)
      .set({ slideSeconds: perSlide, seconds: perSlide.reduce((a, b) => a + b, 0), lastSeenAt: new Date() })
      .where(eq(deckVisits.id, visit.id));
    return reply.code(204).send();
  });

  app.post('/public/visits/:visitId/download', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { visitId } = parse(z.object({ visitId: z.uuid() }), req.params);
    const body = parse(z.object({ token: z.string().min(10).max(100) }), req.body);
    const { visit, deck } = await visitFor(visitId, body.token);
    if (!deck.shareAllowPdf) throw forbidden('pdf_not_allowed', 'The sender turned off PDF downloads for this deck.');
    await db.update(deckVisits).set({ downloadedAt: new Date(), lastSeenAt: new Date() }).where(eq(deckVisits.id, visit.id));
    return reply.code(204).send();
  });

  /* ------------------------------------------------------ meta & support */

  app.get('/health', async () => ({ ok: true, database: ctx.database.kind }));

  /** Fixed lists (deck types, templates, accents, limits) so the app and API stay in step. */
  app.get('/meta', async () => ({
    deckTypes: DECK_TYPES,
    templates: TEMPLATES,
    accents: ACCENTS,
    photoChoices: PHOTO_CHOICES,
    slideChoices: SLIDE_CHOICES,
    slidesMin: SLIDES_MIN,
    slidesMax: SLIDES_MAX,
    minDeckPhotos: MIN_DECK_PHOTOS,
    shareBaseUrl: ctx.config.SHARE_BASE_URL,
    devMocks: ctx.config.DEV_MOCKS,
    syncIntervalMinutes: ctx.config.SYNC_INTERVAL_MINUTES,
    assistant: ctx.config.ANTHROPIC_API_KEY ? 'ai' : 'rules',
  }));

  /** Help-screen feedback. Signed-in people don't need to give an email. */
  app.post('/support/feedback', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const auth = await loadAuth(ctx, req).catch(() => null);
    const body = parse(
      z.object({
        message: z.string().trim().min(10, 'Tell us a little more (10+ characters).').max(4000),
        email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),
        device: z.string().trim().max(200).optional(),
      }),
      req.body,
    );
    const email = auth?.user.email ?? body.email;
    if (!email) throw badRequest('email_required', 'Enter your email so we can reply.');
    await db.insert(feedback).values({ userId: auth?.user.id ?? null, email, message: body.message, device: body.device ?? null });
    if (ctx.config.SUPPORT_EMAIL) {
      await ctx.email
        .send({ to: ctx.config.SUPPORT_EMAIL, subject: `DriveFlow feedback from ${email}`, text: `${body.message}\n\nFrom: ${email}\nDevice: ${body.device ?? 'unknown'}` })
        .catch((e) => req.log.warn({ err: e }, 'Could not email feedback (it is saved)'));
    }
    return reply.code(201).send({ status: 'received' });
  });
}
