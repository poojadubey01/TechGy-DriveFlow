import { useSyncExternalStore } from 'react';

import type { Deck } from './app';
import { buildSlides, type DeckSlide, getClient } from './clients';

/**
 * Saved edits per deck id (reordered / renamed / removed slides). Ready, Preview, the PDF and the
 * client view all read through `useDeckSlides`, so an edit shows up everywhere. In memory for now.
 */
let edits = new Map<string, DeckSlide[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function saveDeck(id: string, slides: DeckSlide[]) {
  edits = new Map(edits).set(id, slides.map((s) => ({ ...s })));
  emit();
}

export function resetDeck(id: string) {
  if (!edits.has(id)) return;
  const next = new Map(edits);
  next.delete(id);
  edits = next;
  emit();
}

/** Removes every saved edit (sign-out / delete account). */
export function clearDeckEdits() {
  edits = new Map();
  emit();
}

/** The deck as built (no edits): its photos and built slide count, cover = the deck's name. */
export function builtSlides(deck: Deck): DeckSlide[] {
  return buildSlides(deck.photos ?? getClient(deck.clientId).gallery, deck.builtSlides, deck.title);
}

/** What to show: saved edits if any, otherwise the built slides. The cover always carries the deck's name. */
export function useDeckSlides(deck: Deck | undefined): DeckSlide[] {
  const map = useSyncExternalStore(subscribe, () => edits, () => edits);
  if (!deck) return [];
  const slides = map.get(deck.id) ?? builtSlides(deck);
  return slides.map((s, i) => (i === 0 ? { ...s, title: deck.title } : s));
}
