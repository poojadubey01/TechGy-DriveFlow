import { api } from '@/api/client';
import type { ApiDeckDetail, ApiDeckSummary, ApiNotification } from '@/api/types';

import { type Asset, bumpClientDecks, type Client, type DeckType, findClient, slidePhoto } from './clients';
import { createStore, dayLabel, relativeTime } from './store';

/* ------------------------------------------------------------------ decks */

export type DeckTemplate = ApiDeckSummary['template'];

export type Deck = {
  id: string;
  clientId: string;
  clientName: string;
  type: DeckType;
  /** The deck's name. It is also the cover slide's title (Ready, Preview, PDF, client view). */
  title: string;
  template: DeckTemplate;
  /** Current slide count (changes when slides are removed in Edit deck). */
  slides: number;
  /** Slide count as built, what "Reset" in Edit deck goes back to. */
  builtSlides: number;
  edited: boolean;
  cover: Asset | null;
  /** "Today", "Yesterday", "14 Nov". */
  when: string;
  createdAt: string;
  /** Unguessable code in the share link (driveflow.techgylink.com/p/<shareId>). */
  shareId: string;
  shareUrl: string;
  share: { active: boolean; allowPdf: boolean };
  /** How many times the client opened the share link. */
  opens: number;
  /** Who shared it (from the deck's detail). */
  sender?: { name: string; email: string };
};

export function deckFromApi(d: ApiDeckSummary | ApiDeckDetail): Deck {
  return {
    id: d.id,
    clientId: d.client.id,
    clientName: d.client.name,
    type: d.type,
    title: d.title,
    template: d.template,
    slides: d.slides,
    builtSlides: d.builtSlides,
    edited: d.edited,
    cover: d.cover ? slidePhoto(d.cover.photoId, d.cover.url) : null,
    when: dayLabel(d.createdAt),
    createdAt: d.createdAt,
    shareId: d.share.id,
    shareUrl: d.share.url,
    share: { active: d.share.active, allowPdf: d.share.allowPdf },
    opens: d.opens,
    sender: 'sender' in d ? { name: d.sender.name, email: d.sender.email } : undefined,
  };
}

type DecksState = { list: readonly Deck[]; status: 'idle' | 'loading' | 'ready' | 'error' };
const decks = createStore<DecksState>({ list: [], status: 'idle' });

export function shareLink(deck: Pick<Deck, 'shareUrl'>) {
  return deck.shareUrl;
}

export async function loadDecks(): Promise<void> {
  decks.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
  try {
    const res = await api<{ decks: ApiDeckSummary[] }>('/decks');
    decks.set({ list: res.decks.map(deckFromApi), status: 'ready' });
  } catch (e) {
    decks.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
    throw e;
  }
}

/** Puts a deck from the API into the list (keeps the sender if the summary has none). */
export function upsertDeck(fromServer: ApiDeckSummary | ApiDeckDetail, atTop = false) {
  const next = deckFromApi(fromServer);
  decks.set((s) => {
    const i = s.list.findIndex((d) => d.id === next.id);
    if (i < 0) return { ...s, list: atTop ? [next, ...s.list] : [...s.list, next] };
    const merged = { ...next, sender: next.sender ?? s.list[i]!.sender };
    return { ...s, list: s.list.map((d, j) => (j === i ? merged : d)) };
  });
  return next;
}

/** Changes a deck in the list right away (the API call follows). */
export function patchDeck(id: string, patch: Partial<Deck>) {
  decks.set((s) => ({ ...s, list: s.list.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

export function getDeck(id: string) {
  return decks.get().list.find((d) => d.id === id);
}

/** The deck's client, or a stand-in built from the deck (clients still loading, or folder removed from Drive). */
export function deckClient(deck: Deck, client?: Client): Client {
  return client ?? findClient(deck.clientId) ?? { id: deck.clientId, name: deck.clientName, meta: '', photos: 0, cover: deck.cover, gallery: [], decks: 0 };
}

export function useDecks(): readonly Deck[] {
  return decks.use().list;
}

export function useDecksStatus() {
  return decks.use().status;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The deck for a route param; undefined if it doesn't exist (deleted, or a bad link). */
export function useDeckById(id: string | string[] | undefined): Deck | undefined {
  const key = first(id);
  return useDecks().find((d) => d.id === key);
}

export type NewDeck = { clientId: string; type: DeckType; slides: number; title?: string; photoIds?: string[]; template?: DeckTemplate };

/** Builds a deck on the server (slides, titles, share link) and adds it at the top. */
export async function createDeck(input: NewDeck): Promise<ApiDeckDetail> {
  const detail = await api<ApiDeckDetail>('/decks', { method: 'POST', body: input });
  upsertDeck(detail, true);
  bumpClientDecks(detail.client.id, 1);
  return detail;
}

export async function renameDeck(id: string, title: string): Promise<ApiDeckDetail | undefined> {
  const clean = title.trim().slice(0, 60);
  const before = getDeck(id);
  if (!clean || !before) return undefined;
  patchDeck(id, { title: clean });
  try {
    const detail = await api<ApiDeckDetail>(`/decks/${id}`, { method: 'PATCH', body: { title: clean } });
    upsertDeck(detail);
    return detail;
  } catch (e) {
    patchDeck(id, { title: before.title });
    throw e;
  }
}

export async function deleteDeck(id: string): Promise<void> {
  const before = decks.get().list;
  const deck = getDeck(id);
  decks.set((s) => ({ ...s, list: s.list.filter((d) => d.id !== id) }));
  try {
    await api(`/decks/${id}`, { method: 'DELETE' });
    if (deck) bumpClientDecks(deck.clientId, -1);
  } catch (e) {
    decks.set((s) => ({ ...s, list: before }));
    throw e;
  }
}

export function resetDecks() {
  decks.reset();
}

/* ---------------------------------------------------------- notifications */

export type NotificationKind = ApiNotification['kind'];

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  when: string;
  group: 'Today' | 'Earlier';
  read: boolean;
  /** Where tapping it goes. */
  target: ApiNotification['target'];
};

type NotesState = { items: readonly AppNotification[]; unread: number; status: 'idle' | 'loading' | 'ready' | 'error' };
const notes = createStore<NotesState>({ items: [], unread: 0, status: 'idle' });

function noteFromApi(n: ApiNotification): AppNotification {
  const t = new Date(n.createdAt);
  const now = new Date();
  const today = t.toDateString() === now.toDateString();
  return { id: n.id, kind: n.kind, title: n.title, body: n.body, when: relativeTime(n.createdAt), group: today ? 'Today' : 'Earlier', read: n.read, target: n.target };
}

export async function loadNotifications(): Promise<void> {
  notes.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
  try {
    const res = await api<{ items: ApiNotification[]; unread: number }>('/notifications');
    notes.set({ items: res.items.map(noteFromApi), unread: res.unread, status: 'ready' });
  } catch (e) {
    notes.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
    throw e;
  }
}

/** The unread badge from GET /me, before the list itself is loaded. */
export function setUnreadCount(n: number) {
  notes.set((s) => ({ ...s, unread: n }));
}

export function markRead(id: string) {
  const n = notes.get().items.find((x) => x.id === id);
  if (!n || n.read) return;
  notes.set((s) => ({ ...s, unread: Math.max(0, s.unread - 1), items: s.items.map((x) => (x.id === id ? { ...x, read: true } : x)) }));
  api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
}

export function markAllRead() {
  notes.set((s) => ({ ...s, unread: 0, items: s.items.map((x) => ({ ...x, read: true })) }));
  api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
}

export function resetNotifications() {
  notes.reset();
}

export function useNotifications() {
  return notes.use();
}

export function useUnreadCount(): number {
  return notes.use().unread;
}
