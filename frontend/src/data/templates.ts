import { useSyncExternalStore } from 'react';

/** Deck templates: how every slide is laid out (app preview, client view and PDF). */
export const templates = [
  { id: 'classic', name: 'Classic', blurb: 'Full photo with a soft blue fade and the title at the bottom' },
  { id: 'editorial', name: 'Editorial', blurb: 'White frame with a magazine-style title under the photo' },
  { id: 'split', name: 'Split', blurb: 'Photo beside a clean text panel with big page numbers' },
  { id: 'bold', name: 'Bold', blurb: 'Photo over a band in your brand colour' },
] as const;

export type TemplateId = (typeof templates)[number]['id'];
export type Template = (typeof templates)[number];

export function isTemplateId(v: unknown): v is TemplateId {
  return templates.some((t) => t.id === v);
}

export function getTemplate(id: string | undefined): Template {
  return templates.find((t) => t.id === id) ?? templates[0];
}

/** Default for new decks + the template chosen for each deck (key: deckKey). In memory for now. */
let state: { fallback: TemplateId; decks: ReadonlyMap<string, TemplateId> } = { fallback: 'classic', decks: new Map() };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());
const snapshot = () => state;

export function setDefaultTemplate(id: TemplateId) {
  state = { ...state, fallback: id };
  emit();
}

export function setDeckTemplate(key: string, id: TemplateId) {
  state = { ...state, decks: new Map(state.decks).set(key, id) };
  emit();
}

export function clearTemplates() {
  state = { fallback: 'classic', decks: new Map() };
  emit();
}

export function useDefaultTemplate(): TemplateId {
  return useSyncExternalStore(subscribe, snapshot, snapshot).fallback;
}

/** The deck's template, or the default when none was picked for it. */
export function useDeckTemplate(key: string): TemplateId {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return s.decks.get(key) ?? s.fallback;
}
