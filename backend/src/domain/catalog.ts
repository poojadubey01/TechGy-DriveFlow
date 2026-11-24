/** Fixed lists the app and the API share. Keep in step with frontend/src/data. */

export const DECK_TYPES = ['Portfolio', 'Proposal', 'Moodboard'] as const;
export type DeckType = (typeof DECK_TYPES)[number];

export const TEMPLATES = [
  { id: 'classic', name: 'Classic', blurb: 'Full photo with a soft blue fade and the title at the bottom' },
  { id: 'editorial', name: 'Editorial', blurb: 'White frame with a magazine-style title under the photo' },
  { id: 'split', name: 'Split', blurb: 'Photo beside a clean text panel with big page numbers' },
  { id: 'bold', name: 'Bold', blurb: 'Photo over a band in your brand colour' },
] as const;
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [string, ...string[]];

export const ACCENTS = [
  { name: 'Deep blue', hex: '#0022FF' },
  { name: 'DriveFlow blue', hex: '#2F45FF' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Forest', hex: '#15803D' },
  { name: 'Coral', hex: '#C2410C' },
  { name: 'Plum', hex: '#7E3AA0' },
] as const;

export const PHOTO_KINDS = ['exterior', 'interior', 'night'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_CHOICES = ['Best of everything', 'Exteriors', 'Interiors', 'Night renders'] as const;

export const SLIDES_MIN = 4;
export const SLIDES_MAX = 40;
export const SLIDE_CHOICES = [8, 12, 15] as const;
/** Fewest photos a deck can be built from. */
export const MIN_DECK_PHOTOS = 3;

export const DECK_TITLE_MAX = 60;
export const SLIDE_TITLE_MAX = 80;
export const BRAND_NAME_MAX = 40;
