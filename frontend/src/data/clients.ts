import { Asset as ExpoAsset } from 'expo-asset';

import { api } from '@/api/client';
import { apiUrl } from '@/api/config';
import type { ApiClientDetail, ApiClientSummary, ApiPhoto } from '@/api/types';

import { createStore } from './store';

type PhotoKind = 'exterior' | 'interior' | 'night';

/**
 * A photo from Drive (served by the API). It is also a valid expo-image `source`: `{ uri }`.
 * The same photo id always gives the same object, so photos can be compared with ===.
 */
export type Asset = { readonly id: string; readonly uri: string; readonly kind: PhotoKind | null; readonly name?: string };

export type Client = {
  id: string;
  name: string;
  /** Short description ("Luxury villas"). */
  meta: string;
  /** Number of photos in the client's Drive folder. */
  photos: number;
  cover: Asset | null;
  gallery: readonly Asset[];
  decks: number;
};

const registry = new Map<string, Asset>();

/** The app's Asset for an API photo (reused while nothing about it changed). */
export function toAsset(p: Pick<ApiPhoto, 'id' | 'url' | 'kind'> & { name?: string }): Asset {
  const uri = apiUrl(p.url);
  const known = registry.get(p.id);
  if (known && known.uri === uri && known.kind === p.kind) return known;
  const asset: Asset = { id: p.id, uri, kind: p.kind, name: p.name };
  registry.set(p.id, asset);
  return asset;
}

/** A slide's photo when only its id and URL are known (deck slides, client view). */
export function slidePhoto(photoId: string, url: string): Asset {
  const known = registry.get(photoId);
  if (known) return known;
  return toAsset({ id: photoId, url, kind: null });
}

/** A bundled sample photo for previews before any client exists (brand kit, templates). */
export const SAMPLE_PHOTO: Asset = {
  id: 'sample',
  uri: ExpoAsset.fromModule(require('../../assets/images/highrize.jpg')).uri,
  kind: 'exterior',
};

/* ----------------------------------------------------------------- store */

/** Stand-in client for previews when the account has none yet. */
export const SAMPLE_CLIENT = { id: 'sample', name: 'Highrize Villas', meta: 'Luxury villas', photos: 1, cover: SAMPLE_PHOTO, gallery: [SAMPLE_PHOTO], decks: 0 } as const satisfies Client;

type ClientsState = { list: readonly Client[]; status: 'idle' | 'loading' | 'ready' | 'error' };
const store = createStore<ClientsState>({ list: [], status: 'idle' });

function fromApi(s: ApiClientSummary, d?: ApiClientDetail): Client {
  const gallery = (d?.photos ?? []).map(toAsset);
  return { id: s.id, name: s.name, meta: d?.meta ?? s.meta, photos: s.photos, decks: s.decks, cover: s.cover ? toAsset(s.cover) : (gallery[0] ?? null), gallery };
}

let loading: Promise<void> | null = null;

/** Loads every client with its photos (one request for the list, one per client). */
export function loadClients(): Promise<void> {
  if (loading) return loading;
  store.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
  loading = (async () => {
    try {
      const { clients } = await api<{ clients: ApiClientSummary[] }>('/clients');
      const details = await Promise.all(clients.map((c) => api<ApiClientDetail>(`/clients/${c.id}`)));
      store.set({ list: clients.map((c, i) => fromApi(c, details[i])), status: 'ready' });
    } catch (e) {
      store.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
      throw e;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Updates a client's deck count after a deck is made or deleted (no reload needed). */
export function bumpClientDecks(clientId: string, by: number) {
  store.set((s) => ({ ...s, list: s.list.map((c) => (c.id === clientId ? { ...c, decks: Math.max(0, c.decks + by) } : c)) }));
}

export function resetClients() {
  registry.clear();
  store.reset();
}

export function useClients(): readonly Client[] {
  return store.use().list;
}

export function useClientsStatus() {
  return store.use().status;
}

const first = (id: string | string[] | undefined) => (Array.isArray(id) ? id[0] : id);

/** Exact lookup in the loaded clients: undefined when it doesn't match (show "not found"). */
export function findClient(id: string | string[] | undefined): Client | undefined {
  const key = first(id);
  return store.get().list.find((c) => c.id === key);
}

/** A client with photos for previews (brand kit, templates): the first real one, else a sample. */
export function useSampleClient(): Client {
  return useClients().find((c) => c.gallery.length > 0) ?? SAMPLE_CLIENT;
}

/** Same as findClient, and re-renders when the clients load or change. */
export function useClient(id: string | string[] | undefined): Client | undefined {
  const key = first(id);
  return useClients().find((c) => c.id === key);
}

/* ---------------------------------------------------- deck-building rules */

export const deckTypes = ['Portfolio', 'Proposal', 'Moodboard'] as const;
export type DeckType = (typeof deckTypes)[number];

export const photoChoices = ['Best of everything', 'Exteriors', 'Interiors', 'Night renders'] as const;

const CHOICE_KIND: Record<string, { kind: PhotoKind; label: string }> = {
  Exteriors: { kind: 'exterior', label: 'exterior shots' },
  Interiors: { kind: 'interior', label: 'interiors' },
  'Night renders': { kind: 'night', label: 'night renders' },
};

/** Reads a typed answer like "pool and garden" or "the kitchen" as a kind of photo. */
function kindFromText(text: string): { kind: PhotoKind; label: string } | null {
  const t = text.toLowerCase();
  if (/\b(night|evening|dusk|lit|lights?)\b/.test(t)) return { kind: 'night', label: 'night shots' };
  if (/\b(interiors?|inside|indoors?|living|kitchens?|dining|bed(room)?s?|suites?|lobby|rooms?|bath(room)?s?)\b/.test(t)) return { kind: 'interior', label: 'interiors' };
  if (/\b(exteriors?|outside|outdoors?|fa[cç]ades?|pools?|gardens?|elevations?|front|aerial|views?|buildings?)\b/.test(t)) return { kind: 'exterior', label: 'exterior shots' };
  return null;
}

/** Fewest photos a deck can be built from. */
export const MIN_DECK_PHOTOS = 3;

/**
 * The photos the assistant proposes for an answer to "which photos?". If the folder has fewer than
 * MIN_DECK_PHOTOS of that kind, it tops up with the client's best photos and says so in `note`.
 * (Same rules as the API's POST /clients/:id/pick-photos, run here so the chat answers instantly.)
 */
export function pickPhotos(client: Client, choice: string): { photos: Asset[]; note?: string } {
  if (choice === 'Best of everything') return { photos: [...client.gallery] };
  const wanted = CHOICE_KIND[choice] ?? kindFromText(choice);
  if (!wanted) return { photos: [...client.gallery], note: 'I couldn’t match that to a type of photo, so here are all of them.' };
  const match = client.gallery.filter((a) => a.kind === wanted.kind);
  if (match.length >= MIN_DECK_PHOTOS) return { photos: match };
  const rest = client.gallery.filter((a) => !match.includes(a)).slice(0, MIN_DECK_PHOTOS + 1 - match.length);
  const found = match.length === 0 ? `I couldn’t find ${wanted.label}` : `I found only ${match.length} ${match.length === 1 ? wanted.label.replace(/s$/, '') : wanted.label}`;
  return { photos: [...match, ...rest], note: `${found}, so I added some of your best photos.` };
}
export const slideChoices = ['8 slides', '12 slides', '15 slides'] as const;

/** Slide counts a deck can have (typed answers and route params are checked against this). */
export const SLIDES_MIN = 4;
export const SLIDES_MAX = 40;

/** Parses a positive slide count from a route param, clamped to a sane range. */
export function parseSlides(value: string | string[] | undefined, fallback = 12): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= SLIDES_MIN && n <= SLIDES_MAX ? n : fallback;
}

/** A slide count typed in the chat ("10", "10 slides", "make it 10"); null if it isn't a usable number. */
export function typedSlides(text: string): number | null {
  const n = Number.parseInt(text.match(/\d+/)?.[0] ?? '', 10);
  return Number.isFinite(n) && n >= SLIDES_MIN && n <= SLIDES_MAX ? n : null;
}

/** Slide titles by what the photo shows (the API uses the same list when it builds a deck). */
const KIND_TITLES: Record<PhotoKind, readonly string[]> = {
  exterior: ['Arrival and first impressions', 'Set among green open spaces', 'Architecture that ages well', 'Outdoor spaces to unwind', 'A place to come home to'],
  interior: ['Living spaces that open up', 'Made for long family dinners', 'Calm, light-filled bedrooms', 'A kitchen built for hosting', 'Finishes chosen with care'],
  night: ['Evenings at home', 'Lit up after dark', 'Quiet nights, warm light'],
};

export type DeckSlide = { source: Asset; title: string; /** The photo was removed from Drive. */ missing?: boolean };

/** Default name for a new deck, e.g. "Residential tower proposal". */
export function coverTitle(client: Pick<Client, 'name' | 'meta'>, type: string) {
  const base = client.meta.trim() ? client.meta.trim().replace(/s$/, '') : client.name;
  return `${base} ${type.toLowerCase()}`;
}

/**
 * `count` slides cycling through `photos` (for previews; real decks are built by the API). The
 * cover gets `cover`; every other slide gets a title that matches what its photo shows.
 */
export function buildSlides(photos: readonly Asset[], count: number, cover: string): DeckSlide[] {
  if (photos.length === 0) return [];
  const used: Record<PhotoKind, number> = { exterior: 0, interior: 0, night: 0 };
  return Array.from({ length: count }, (_, i) => {
    const source = photos[i % photos.length]!;
    if (i === 0) return { source, title: cover };
    const kind = source.kind ?? 'exterior';
    const list = KIND_TITLES[kind];
    return { source, title: list[used[kind]++ % list.length]! };
  });
}
