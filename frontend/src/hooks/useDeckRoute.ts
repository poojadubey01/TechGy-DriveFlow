import { useLocalSearchParams } from 'expo-router';

import { type Deck, deckClient, useDeckById } from '@/data/app';
import { type Client, useClient } from '@/data/clients';

/**
 * The deck a deck screen is about (route param `deck` = deck id). `deck` is undefined when the
 * id doesn't exist (deleted, or a bad link): screens then show <DeckGone />.
 */
export function useDeckRoute(): { deck: Deck | undefined; client: Client | undefined } {
  const params = useLocalSearchParams<{ deck?: string }>();
  const deck = useDeckById(params.deck);
  const client = useClient(deck?.clientId);
  return { deck, client: deck ? deckClient(deck, client) : undefined };
}
