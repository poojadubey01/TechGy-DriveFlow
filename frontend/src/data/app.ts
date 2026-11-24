import { useSyncExternalStore } from 'react';

import type { Asset, DeckType } from './clients';

/* ------------------------------------------------------------------ decks */

export type Deck = {
  id: string;
  clientId: string;
  type: DeckType;
  /** The deck's name. It is also the cover slide's title (Ready, Preview, PDF, client view). */
  title: string;
  /** Current slide count (changes when slides are removed in Edit deck). */
  slides: number;
  /** Slide count as built, what "Reset" in Edit deck goes back to. */
  builtSlides: number;
  /** Photos the deck was built from, in order; null = all of the client's photos. */
  photos: readonly Asset[] | null;
  when: string;
  /** Unguessable code in the share link (driveflow.app/p/<shareId>). */
  shareId: string;
  /** Who shared it, shown to the client on the share link. */
  sender?: { name: string; email: string };
};

const seed = (d: Omit<Deck, 'builtSlides' | 'photos'>): Deck => ({ ...d, builtSlides: d.slides, photos: null });

/** Sample decks (swap for the API). Newest first. */
const SEED_DECKS: readonly Deck[] = [
  seed({ id: 'd1', clientId: 'highrize', type: 'Portfolio', title: 'Luxury villa portfolio', slides: 12, when: 'Today', shareId: 'k7q2m9xw4hpa' }),
  seed({ id: 'd2', clientId: 'otherside', type: 'Proposal', title: 'Gated community proposal', slides: 15, when: 'Yesterday', shareId: 'r3v8n1tz6cqe' }),
  seed({ id: 'd3', clientId: 'elysium', type: 'Moodboard', title: 'Interiors moodboard', slides: 8, when: '16 Nov', shareId: 'w5b2y7ju0dkf' }),
  seed({ id: 'd4', clientId: 'vijetha', type: 'Portfolio', title: 'Villa township portfolio', slides: 12, when: '14 Nov', shareId: 'p9h4s6ex1lmg' }),
  seed({ id: 'd5', clientId: 'highrize', type: 'Proposal', title: 'Phase 2 proposal', slides: 15, when: '10 Nov', shareId: 'c2f8k3qa7nvb' }),
];

/** Share links point here. Host the web build on this domain to open them in a browser (see README). */
export const SHARE_BASE_URL = 'https://driveflow.app/p/';

export function shareLink(deck: Deck) {
  return `${SHARE_BASE_URL}${deck.shareId}`;
}

/**
 * Your decks, newest first. Every deck has its own id, so two proposals for the same client are
 * two separate decks. In memory for now: swap for your API.
 */
let deckList: readonly Deck[] = SEED_DECKS;
const deckListeners = new Set<() => void>();
const subscribeDecks = (l: () => void) => {
  deckListeners.add(l);
  return () => deckListeners.delete(l);
};
const setDecks = (next: readonly Deck[]) => {
  deckList = next;
  deckListeners.forEach((l) => l());
};

export function useDecks(): readonly Deck[] {
  return useSyncExternalStore(subscribeDecks, () => deckList, () => deckList);
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The deck for a route param; undefined if it doesn't exist (deleted, or a bad link). */
export function useDeckById(id: string | string[] | undefined): Deck | undefined {
  const key = first(id);
  return useDecks().find((d) => d.id === key);
}

export function useDeckByShareId(shareId: string | string[] | undefined): Deck | undefined {
  const key = first(shareId);
  return useDecks().find((d) => d.shareId === key);
}

/** 12 characters from an unambiguous alphabet. A backend should issue these server-side. */
function newShareId() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

/** Adds a freshly built deck at the top. A repeated name gets a number ("… portfolio 2"). */
export function createDeck(input: { clientId: string; type: DeckType; slides: number; title: string; photos: readonly Asset[] | null; sender?: Deck['sender'] }): Deck {
  const taken = new Set(deckList.filter((d) => d.clientId === input.clientId).map((d) => d.title));
  let title = input.title;
  for (let n = 2; taken.has(title); n++) title = `${input.title} ${n}`;
  const deck: Deck = {
    id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    clientId: input.clientId,
    type: input.type,
    title,
    slides: input.slides,
    builtSlides: input.slides,
    photos: input.photos,
    when: 'Just now',
    shareId: newShareId(),
    sender: input.sender,
  };
  setDecks([deck, ...deckList]);
  return deck;
}

export function renameDeck(id: string, title: string) {
  const clean = title.trim().slice(0, 60);
  if (!clean) return;
  setDecks(deckList.map((d) => (d.id === id ? { ...d, title: clean } : d)));
}

/** Keeps the library's slide count in step with Edit deck. */
export function setDeckSlides(id: string, slides: number) {
  setDecks(deckList.map((d) => (d.id === id ? { ...d, slides } : d)));
}

export function deleteDeck(id: string) {
  setDecks(deckList.filter((d) => d.id !== id));
}

/** Sign-out brings back the sample workspace; deleting the account empties it. */
export function resetDecks(to: 'seed' | 'empty') {
  setDecks(to === 'seed' ? SEED_DECKS : []);
}

/* ---------------------------------------------------------- notifications */

export type NotificationKind = 'ready' | 'viewed' | 'photos' | 'team';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  when: string;
  group: 'Today' | 'Earlier';
  /** Where tapping it goes. */
  target: { pathname: '/ready' | '/clients' | '/profile' | '/client/[id]' | '/activity'; params?: Record<string, string> };
};

export const notifications: readonly AppNotification[] = [
  {
    id: 'n1',
    kind: 'ready',
    title: 'Your deck is ready',
    body: 'Highrize Villas · Luxury villa portfolio, 12 slides',
    when: '2 min ago',
    group: 'Today',
    target: { pathname: '/ready', params: { deck: 'd1' } },
  },
  {
    id: 'n2',
    kind: 'viewed',
    title: 'Other Side Villas opened your proposal',
    body: 'Viewed 3 times · last seen 1 hour ago',
    when: '1 h ago',
    group: 'Today',
    target: { pathname: '/activity', params: { deck: 'd2' } },
  },
  {
    id: 'n3',
    kind: 'photos',
    title: '12 new photos in Google Drive',
    body: 'Added to Projects / Reliance Elysium',
    when: '4 h ago',
    group: 'Today',
    target: { pathname: '/client/[id]', params: { id: 'elysium' } },
  },
  {
    id: 'n4',
    kind: 'team',
    title: 'Rohan joined your workspace',
    body: 'He can now tag clients and create decks',
    when: 'Yesterday',
    group: 'Earlier',
    target: { pathname: '/profile' },
  },
  {
    id: 'n5',
    kind: 'ready',
    title: 'Your deck is ready',
    body: 'Vijetha Vaibhogam · Villa township portfolio, 12 slides',
    when: '14 Nov',
    group: 'Earlier',
    target: { pathname: '/ready', params: { deck: 'd4' } },
  },
] as const;

/** Read state shared by the Home bell and the Notifications page (in memory for now). */
const INITIAL_READ = ['n4', 'n5'];
let read = new Set<string>(INITIAL_READ);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function markRead(id: string) {
  if (read.has(id)) return;
  read = new Set(read).add(id);
  emit();
}

/** Fresh workspace (sign-out / delete account). */
export function resetReadState() {
  read = new Set(INITIAL_READ);
  emit();
}

export function markAllRead() {
  read = new Set(notifications.map((n) => n.id));
  emit();
}

/** The current set of read ids (a new Set each change, so React re-renders). */
export function useReadIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => read, () => read);
}

export function useUnreadCount(): number {
  const ids = useReadIds();
  return notifications.filter((n) => !ids.has(n.id)).length;
}
