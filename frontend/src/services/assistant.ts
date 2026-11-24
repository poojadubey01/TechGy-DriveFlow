/** The chat assistant (POST /assistant/understand): reads a typed request into deck settings. */
import { api } from '@/api/client';

export type Understanding = {
  /** 'ai' = read by Claude; 'rules' = the server's built-in reader (no AI key set). */
  source: 'ai' | 'rules';
  clientId: string | null;
  deckType: 'Portfolio' | 'Proposal' | 'Moodboard' | null;
  slides: number | null;
  /** "Best of everything" / "Exteriors" / "Interiors" / "Night renders", or the person's own words. */
  photoChoice: string | null;
  template: 'classic' | 'editorial' | 'split' | 'bold' | null;
  reply: string;
};

export function understand(text: string, clientId?: string | null) {
  return api<Understanding>('/assistant/understand', { method: 'POST', body: { text, clientId: clientId ?? null }, timeoutMs: 25_000 });
}
