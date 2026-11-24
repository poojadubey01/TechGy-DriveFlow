/** A bundled image (the number Metro returns from require()). */
export type Asset = number;

export type Client = {
  id: string;
  name: string;
  meta: string;
  photos: number;
  cover: Asset;
  gallery: readonly Asset[];
};

export const clients: readonly Client[] = [
  {
    id: 'highrize',
    name: 'Highrize Villas',
    meta: 'Luxury villas',
    photos: 86,
    cover: require('../../assets/images/highrize.jpg'),
    gallery: [
      require('../../assets/images/highrize.jpg'),
      require('../../assets/images/highrize-living.jpg'),
      require('../../assets/images/highrize-dining.jpg'),
      require('../../assets/images/highrize-suite.jpg'),
      require('../../assets/images/highrize-kitchen.jpg'),
      require('../../assets/images/villas-night.jpg'),
      require('../../assets/images/vijetha-pool.jpg'),
    ],
  },
  {
    id: 'otherside',
    name: 'Other Side Villas',
    meta: 'Gated community',
    photos: 64,
    cover: require('../../assets/images/otherside.jpg'),
    gallery: [
      require('../../assets/images/otherside.jpg'),
      require('../../assets/images/otherside-night.jpg'),
      require('../../assets/images/villas-night.jpg'),
      require('../../assets/images/highrize-living.jpg'),
      require('../../assets/images/highrize-dining.jpg'),
      require('../../assets/images/vijetha-pool.jpg'),
      require('../../assets/images/highrize-suite.jpg'),
    ],
  },
  {
    id: 'elysium',
    name: 'Reliance Elysium',
    meta: 'Residential towers',
    photos: 112,
    cover: require('../../assets/images/elysium.jpg'),
    gallery: [
      require('../../assets/images/elysium.jpg'),
      require('../../assets/images/elysium-lobby.jpg'),
      require('../../assets/images/highrize-kitchen.jpg'),
      require('../../assets/images/highrize-living.jpg'),
      require('../../assets/images/highrize-suite.jpg'),
      require('../../assets/images/vijetha-pool.jpg'),
      require('../../assets/images/highrize-dining.jpg'),
    ],
  },
  {
    id: 'vijetha',
    name: 'Vijetha Vaibhogam',
    meta: 'Villa township',
    photos: 58,
    cover: require('../../assets/images/vijetha.jpg'),
    gallery: [
      require('../../assets/images/vijetha.jpg'),
      require('../../assets/images/vijetha-pool.jpg'),
      require('../../assets/images/villas-night.jpg'),
      require('../../assets/images/otherside.jpg'),
      require('../../assets/images/highrize-living.jpg'),
      require('../../assets/images/highrize-suite.jpg'),
      require('../../assets/images/highrize-dining.jpg'),
    ],
  },
] as const;

export const DEFAULT_CLIENT_ID = 'highrize';

/** Exact lookup: undefined when the id doesn't match a client (show "not found"). */
export function findClient(id: string | string[] | undefined): Client | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return clients.find((c) => c.id === key);
}

/** Looks up a client by id; falls back to the default so a bad deep link never crashes a screen. */
export function getClient(id: string | string[] | undefined): Client {
  const key = Array.isArray(id) ? id[0] : id;
  return clients.find((c) => c.id === key) ?? clients[0]!;
}

export const deckTypes = ['Portfolio', 'Proposal', 'Moodboard'] as const;
export type DeckType = (typeof deckTypes)[number];

export const photoChoices = ['Best of everything', 'Exteriors', 'Interiors', 'Night renders'] as const;

type PhotoKind = 'exterior' | 'interior' | 'night';

/** What each sample photo shows (Drive photos would come with labels from your backend / AI tagging). */
const KIND = new Map<Asset, PhotoKind>([
  [require('../../assets/images/highrize.jpg'), 'exterior'],
  [require('../../assets/images/otherside.jpg'), 'exterior'],
  [require('../../assets/images/elysium.jpg'), 'exterior'],
  [require('../../assets/images/vijetha.jpg'), 'exterior'],
  [require('../../assets/images/vijetha-pool.jpg'), 'exterior'],
  [require('../../assets/images/highrize-living.jpg'), 'interior'],
  [require('../../assets/images/highrize-dining.jpg'), 'interior'],
  [require('../../assets/images/highrize-suite.jpg'), 'interior'],
  [require('../../assets/images/highrize-kitchen.jpg'), 'interior'],
  [require('../../assets/images/elysium-lobby.jpg'), 'interior'],
  [require('../../assets/images/villas-night.jpg'), 'night'],
  [require('../../assets/images/otherside-night.jpg'), 'night'],
]);

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
 */
export function pickPhotos(client: Client, choice: string): { photos: Asset[]; note?: string } {
  if (choice === 'Best of everything') return { photos: [...client.gallery] };
  const wanted = CHOICE_KIND[choice] ?? kindFromText(choice);
  if (!wanted) return { photos: [...client.gallery], note: 'I couldn’t match that to a type of photo, so here are all of them.' };
  const match = client.gallery.filter((a) => KIND.get(a) === wanted.kind);
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

/** Slide titles by what the photo shows. Neutral wording, so they fit villas, towers and townships. */
const KIND_TITLES: Record<PhotoKind, readonly string[]> = {
  exterior: ['Arrival and first impressions', 'Set among green open spaces', 'Architecture that ages well', 'Outdoor spaces to unwind', 'A place to come home to'],
  interior: ['Living spaces that open up', 'Made for long family dinners', 'Calm, light-filled bedrooms', 'A kitchen built for hosting', 'Finishes chosen with care'],
  night: ['Evenings at home', 'Lit up after dark', 'Quiet nights, warm light'],
};

export type DeckSlide = { source: Asset; title: string };

/** Default name for a new deck, e.g. "Residential tower proposal". */
export function coverTitle(client: Client, type: string) {
  return `${client.meta.replace(/s$/, '')} ${type.toLowerCase()}`;
}

/**
 * `count` slides cycling through `photos`. The cover gets `cover` (the deck's name); every other
 * slide gets a title that matches what its photo shows.
 */
export function buildSlides(photos: readonly Asset[], count: number, cover: string): DeckSlide[] {
  if (photos.length === 0) return [];
  const used: Record<PhotoKind, number> = { exterior: 0, interior: 0, night: 0 };
  return Array.from({ length: count }, (_, i) => {
    const source = photos[i % photos.length]!;
    if (i === 0) return { source, title: cover };
    const kind = KIND.get(source) ?? 'exterior';
    const list = KIND_TITLES[kind];
    return { source, title: list[used[kind]++ % list.length]! };
  });
}
