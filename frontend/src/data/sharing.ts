import { api } from '@/api/client';
import type { ApiShare } from '@/api/types';

import { getDeck, patchDeck, useDecks } from './app';

/** A deck's share-link settings: link on/off, PDF download allowed. */
export type ShareState = { active: boolean; allowPdf: boolean };

const DEFAULT: ShareState = { active: true, allowPdf: true };

/** Changes sharing right away and saves it; puts it back if saving fails. */
export function setShare(deckId: string, patch: Partial<ShareState>) {
  const deck = getDeck(deckId);
  if (!deck) return;
  const before = deck.share;
  patchDeck(deckId, { share: { ...before, ...patch } });
  api<ApiShare>(`/decks/${deckId}/share`, { method: 'PATCH', body: patch })
    .then((s) => patchDeck(deckId, { share: { active: s.active, allowPdf: s.allowPdf } }))
    .catch(() => patchDeck(deckId, { share: before }));
}

/** A brand-new link for the deck; the old one stops working. */
export async function newShareLink(deckId: string) {
  const s = await api<ApiShare>(`/decks/${deckId}/share/new-link`, { method: 'POST' });
  patchDeck(deckId, { shareId: s.id, shareUrl: s.url, share: { active: s.active, allowPdf: s.allowPdf } });
  return s;
}

export function useShare(deckId: string): ShareState {
  return useDecks().find((d) => d.id === deckId)?.share ?? DEFAULT;
}
