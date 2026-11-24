import type { SlideRow } from '../db/schema.js';
import { MIN_DECK_PHOTOS, type PhotoKind } from './catalog.js';

/** What the deck builder needs to know about a photo. */
export type PhotoInfo = { id: string; kind: string | null };

/** Reads text like "pool and garden", "the kitchen" or a file name as a kind of photo. */
export function kindFromText(text: string): { kind: PhotoKind; label: string } | null {
  const t = text.toLowerCase().replace(/[_\-.]+/g, ' ');
  if (/\b(night|evening|dusk|lit|lights?)\b/.test(t)) return { kind: 'night', label: 'night shots' };
  if (/\b(interiors?|inside|indoors?|living|kitchens?|dining|bed(room)?s?|suites?|lobby|rooms?|bath(room)?s?)\b/.test(t)) return { kind: 'interior', label: 'interiors' };
  if (/\b(exteriors?|outside|outdoors?|fa[cç]ades?|pools?|gardens?|elevations?|front|aerial|views?|buildings?)\b/.test(t)) return { kind: 'exterior', label: 'exterior shots' };
  return null;
}

const CHOICE_KIND: Record<string, { kind: PhotoKind; label: string }> = {
  Exteriors: { kind: 'exterior', label: 'exterior shots' },
  Interiors: { kind: 'interior', label: 'interiors' },
  'Night renders': { kind: 'night', label: 'night renders' },
};

/**
 * The photos to propose for an answer to "which photos?". If there are fewer than MIN_DECK_PHOTOS of
 * that kind, it tops up with the client's other photos and says so in `note`. Same rules as the app.
 */
export function pickPhotos<T extends PhotoInfo>(gallery: readonly T[], choice: string): { photos: T[]; note?: string } {
  if (choice === 'Best of everything') return { photos: [...gallery] };
  const wanted = CHOICE_KIND[choice] ?? kindFromText(choice);
  if (!wanted) return { photos: [...gallery], note: 'I couldn’t match that to a type of photo, so here are all of them.' };
  const match = gallery.filter((p) => p.kind === wanted.kind);
  if (match.length >= MIN_DECK_PHOTOS) return { photos: match };
  const rest = gallery.filter((p) => !match.includes(p)).slice(0, MIN_DECK_PHOTOS + 1 - match.length);
  const found =
    match.length === 0
      ? `I couldn’t find ${wanted.label}`
      : `I found only ${match.length} ${match.length === 1 ? wanted.label.replace(/s$/, '') : wanted.label}`;
  return { photos: [...match, ...rest], note: `${found}, so I added some of your best photos.` };
}

/** Slide titles by what the photo shows. Neutral wording, so they fit villas, towers and townships. */
const KIND_TITLES: Record<PhotoKind, readonly string[]> = {
  exterior: ['Arrival and first impressions', 'Set among green open spaces', 'Architecture that ages well', 'Outdoor spaces to unwind', 'A place to come home to'],
  interior: ['Living spaces that open up', 'Made for long family dinners', 'Calm, light-filled bedrooms', 'A kitchen built for hosting', 'Finishes chosen with care'],
  night: ['Evenings at home', 'Lit up after dark', 'Quiet nights, warm light'],
};

const asKind = (k: string | null): PhotoKind => (k === 'interior' || k === 'night' ? k : 'exterior');

/** Default name for a new deck, e.g. "Residential tower proposal" (or "Highrize Villas proposal"). */
export function coverTitle(client: { name: string; meta: string }, type: string) {
  const base = client.meta.trim() ? client.meta.trim().replace(/s$/, '') : client.name;
  return `${base} ${type.toLowerCase()}`;
}

/**
 * `count` slides cycling through `photos`. The cover gets `cover` (the deck's name); every other
 * slide gets a title that matches what its photo shows.
 */
export function buildSlides(photos: readonly PhotoInfo[], count: number, cover: string): SlideRow[] {
  if (photos.length === 0) return [];
  const used: Record<PhotoKind, number> = { exterior: 0, interior: 0, night: 0 };
  return Array.from({ length: count }, (_, i) => {
    const photo = photos[i % photos.length]!;
    if (i === 0) return { photoId: photo.id, title: cover };
    const kind = asKind(photo.kind);
    const list = KIND_TITLES[kind];
    return { photoId: photo.id, title: list[used[kind]++ % list.length]! };
  });
}

/** "Title", "Title 2", "Title 3"… the first name not already used for this client. */
export function uniqueTitle(wanted: string, taken: ReadonlySet<string>) {
  let title = wanted;
  for (let n = 2; taken.has(title); n++) title = `${wanted} ${n}`;
  return title;
}
