import { useLocalSearchParams } from 'expo-router';

import { type Deck, useDeckById } from '@/data/app';
import { type Client, getClient } from '@/data/clients';

/**
 * The deck a deck screen is about (route param `deck` = deck id). `deck` is undefined when the
 * id doesn't exist (deleted, or a bad link): screens then show <DeckGone />.
 */
export function useDeckRoute(): { deck: Deck | undefined; client: Client | undefined } {
  const params = useLocalSearchParams<{ deck?: string }>();
  const deck = useDeckById(params.deck);
  return { deck, client: deck ? getClient(deck.clientId) : undefined };
}
