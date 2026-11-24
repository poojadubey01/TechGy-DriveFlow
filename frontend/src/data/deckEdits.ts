import { useEffect } from 'react';

import { api } from '@/api/client';
import type { ApiDeckDetail } from '@/api/types';

import { type Deck, upsertDeck } from './app';
import { type DeckSlide, slidePhoto } from './clients';
import { createStore } from './store';

/**
 * Each deck's slides as the API has them (after edits). Ready, Preview, the PDF and Edit deck all
 * read through `useDeckSlides`, so a saved edit shows up everywhere.
 */
const store = createStore<ReadonlyMap<string, DeckSlide[]>>(new Map());
const inFlight = new Map<string, Promise<void>>();

function slidesFromDetail(d: ApiDeckDetail): DeckSlide[] {
  return d.slideList.map((s) => ({ source: slidePhoto(s.photoId, s.url), title: s.title, missing: s.missing || undefined }));
}

/** Stores a deck detail from the API: its slides here, its summary in the deck list. */
export function rememberDetail(d: ApiDeckDetail) {
  store.set((m) => new Map(m).set(d.id, slidesFromDetail(d)));
  upsertDeck(d);
}

export function loadDeckSlides(id: string): Promise<void> {
  const running = inFlight.get(id);
  if (running) return running;
  const p = api<ApiDeckDetail>(`/decks/${id}`)
    .then(rememberDetail)
    .finally(() => inFlight.delete(id));
  inFlight.set(id, p);
  return p;
}

/** Saves Edit deck (order, titles, removed slides). The cover always keeps the deck's name. */
export async function saveDeck(id: string, slides: DeckSlide[]) {
  const detail = await api<ApiDeckDetail>(`/decks/${id}/slides`, {
    method: 'PUT',
    body: { slides: slides.map((s) => ({ photoId: s.source.id, title: s.title.trim() || 'Untitled' })) },
  });
  rememberDetail(detail);
}

/** "Reset" in Edit deck: back to the slides as built. */
export async function resetDeck(id: string) {
  rememberDetail(await api<ApiDeckDetail>(`/decks/${id}/reset`, { method: 'POST' }));
}

/** Forgets every deck's slides (sign-out / delete account). */
export function clearDeckEdits() {
  inFlight.clear();
  store.reset();
}

/** The deck's slides (loads them the first time). Empty while loading. The cover carries the deck's name. */
export function useDeckSlides(deck: Deck | undefined): DeckSlide[] {
  const map = store.use();
  const id = deck?.id;
  const have = id ? map.has(id) : true;
  useEffect(() => {
    if (id && !have) loadDeckSlides(id).catch(() => undefined);
  }, [id, have]);
  if (!deck) return [];
  const slides = map.get(deck.id) ?? [];
  return slides.map((s, i) => (i === 0 ? { ...s, title: deck.title } : s));
}

/** True once the deck's slides have loaded. */
export function useDeckSlidesLoaded(deck: Deck | undefined): boolean {
  const map = store.use();
  return deck ? map.has(deck.id) : false;
}
