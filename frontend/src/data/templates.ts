import { api } from '@/api/client';
import type { ApiDeckDetail } from '@/api/types';
import { showSaveFailed } from '@/lib/confirm';

import { getDeck, patchDeck, upsertDeck, useDecks } from './app';
import { setSettings, useSettings } from './settings';

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

/** Template for new decks (a Profile setting). */
export function setDefaultTemplate(id: TemplateId) {
  setSettings({ defaultTemplate: id });
}

/** Changes a deck's template right away and saves it. */
export function setDeckTemplate(deckId: string, id: TemplateId) {
  const before = getDeck(deckId)?.template;
  patchDeck(deckId, { template: id });
  api<ApiDeckDetail>(`/decks/${deckId}`, { method: 'PATCH', body: { template: id } })
    .then((d) => upsertDeck(d))
    .catch((e) => {
      if (before) patchDeck(deckId, { template: before });
      showSaveFailed(e);
    });
}

export function useDefaultTemplate(): TemplateId {
  return useSettings().defaultTemplate;
}

/** The deck's template, or the default when the deck isn't loaded. */
export function useDeckTemplate(deckId: string): TemplateId {
  const deck = useDecks().find((d) => d.id === deckId);
  const fallback = useDefaultTemplate();
  return deck?.template ?? fallback;
}
