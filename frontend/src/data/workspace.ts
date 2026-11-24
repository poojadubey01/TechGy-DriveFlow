import { resetDecks, resetReadState } from './app';
import { resetBrand } from './brand';
import { clearDeckEdits } from './deckEdits';
import { resetSettings } from './settings';
import { clearShares } from './sharing';
import { clearTemplates } from './templates';

/**
 * Clears everything that belongs to the signed-in account, so the next person on this phone
 * never sees it. Sign-out brings back the sample workspace; deleting the account leaves it empty.
 */
export function resetWorkspace(decks: 'seed' | 'empty') {
  resetDecks(decks);
  clearDeckEdits();
  clearShares();
  clearTemplates();
  resetBrand();
  resetSettings();
  resetReadState();
}
