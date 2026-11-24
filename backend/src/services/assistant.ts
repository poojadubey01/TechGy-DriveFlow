import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { DECK_TYPES, PHOTO_CHOICES, SLIDES_MAX, SLIDES_MIN, TEMPLATE_IDS, TEMPLATES } from '../domain/catalog.js';
import { kindFromText } from '../domain/slides.js';

export type AssistantClient = { id: string; name: string; meta: string };
export type UnderstandInput = { text: string; clients: readonly AssistantClient[]; taggedClientId?: string | null };

/** What the chat understood from a typed request. Null = not said (the chat asks for it). */
export type Understanding = {
  source: 'ai' | 'rules';
  clientId: string | null;
  deckType: (typeof DECK_TYPES)[number] | null;
  slides: number | null;
  /** One of PHOTO_CHOICES, or the person's own words ("pool and garden"). */
  photoChoice: string | null;
  template: (typeof TEMPLATE_IDS)[number] | null;
  /** A short, friendly answer to show in the chat. */
  reply: string;
};

export interface Assistant {
  understand(input: UnderstandInput): Promise<Understanding>;
}

/* ------------------------------------------------------- shared clean-up */

/** Keeps only what's valid for this account: a real client id, a slide count in range, a known choice. */
function clean(raw: Omit<Understanding, 'source'>, input: UnderstandInput, source: Understanding['source']): Understanding {
  const clientId = raw.clientId && input.clients.some((c) => c.id === raw.clientId) ? raw.clientId : null;
  const slides = raw.slides !== null && Number.isInteger(raw.slides) && raw.slides >= SLIDES_MIN && raw.slides <= SLIDES_MAX ? raw.slides : null;
  const choice = raw.photoChoice?.trim().slice(0, 80) || null;
  const known = choice ? PHOTO_CHOICES.find((c) => c.toLowerCase() === choice.toLowerCase()) : undefined;
  return {
    source,
    clientId,
    deckType: raw.deckType,
    slides,
    photoChoice: known ?? choice,
    template: raw.template,
    reply: raw.reply.trim().slice(0, 400) || 'Got it.',
  };
}

/* ----------------------------------------------------- rule-based reader */

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const STOP = new Set(['the', 'villas', 'villa', 'homes', 'group', 'and', 'for', 'of']);

/**
 * Reads a request without an AI model: client names (or an @mention), deck type, a slide count,
 * a photo kind and a template name. Used when no AI key is set, and whenever the AI call fails.
 */
export class RulesAssistant implements Assistant {
  async understand(input: UnderstandInput): Promise<Understanding> {
    const text = input.text;
    const t = text.toLowerCase();
    const tw = new Set(words(text));

    // Client: the full name, else a distinctive word of the name, else the tagged client.
    let clientId: string | null = input.clients.find((c) => t.includes(c.name.toLowerCase()))?.id ?? null;
    if (!clientId) {
      const scored = input.clients
        .map((c) => ({ c, hits: words(c.name).filter((w) => !STOP.has(w) && w.length > 2 && tw.has(w)).length }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      if (scored.length === 1 || (scored[0] && scored[1] && scored[0].hits > scored[1].hits)) clientId = scored[0]!.c.id;
    }
    clientId ??= input.taggedClientId ?? null;

    const deckType = DECK_TYPES.find((d) => new RegExp(`\\b${d.toLowerCase()}s?\\b`).test(t)) ?? (/\bmood ?board\b/.test(t) ? 'Moodboard' : null);
    const n = /\b(\d{1,2})\s*(?:-|\s)?(?:slides?|pages?)\b/.exec(t) ?? /\b(?:slides?|pages?)\s*[:=]?\s*(\d{1,2})\b/.exec(t);
    const slides = n ? Number(n[1]) : null;
    const template = TEMPLATES.find((tp) => new RegExp(`\\b${tp.id}\\b`).test(t))?.id ?? null;

    let photoChoice: string | null = null;
    if (/\b(best|everything|all (?:the )?photos)\b/.test(t)) photoChoice = 'Best of everything';
    else {
      const kind = kindFromText(text)?.kind;
      photoChoice = kind === 'exterior' ? 'Exteriors' : kind === 'interior' ? 'Interiors' : kind === 'night' ? 'Night renders' : null;
    }

    const client = input.clients.find((c) => c.id === clientId);
    const what = `${deckType ? deckType.toLowerCase() : 'deck'}${client ? ` for ${client.name}` : ''}`;
    const reply = client ? `Got it: a ${what}.` : input.clients.length ? 'Who is this deck for? Type @ to tag a client.' : 'Connect Google Drive first, so I can see your clients.';
    return clean({ clientId, deckType, slides, photoChoice, template, reply }, input, 'rules');
  }
}

/* ------------------------------------------------------------- Claude */

const UnderstoodSchema = z.object({
  clientId: z.string().nullable(),
  deckType: z.enum(DECK_TYPES).nullable(),
  slides: z.number().int().nullable(),
  photoChoice: z.string().nullable(),
  template: z.enum(TEMPLATE_IDS as [string, ...string[]]).nullable(),
  reply: z.string(),
});

const SYSTEM = `You read requests that real-estate agents type into DriveFlow, an app that builds branded slide decks from the photos in their Google Drive. Pull out what the agent asked for. Fill a field only when the request says it or clearly implies it; otherwise use null, and the app will ask.

- clientId: the id of the client the deck is for, chosen from the client list. Match names loosely: first word, partial names, small typos, "@" mentions. If a client is already tagged and the request names no other client, use the tagged one. Never make up an id.
- deckType: "Portfolio", "Proposal" or "Moodboard".
- slides: the number of slides, if one is given.
- photoChoice: "Best of everything", "Exteriors", "Interiors" or "Night renders" when the request matches one of those; otherwise the agent's own short words about which photos to use (for example "pool and garden"); otherwise null.
- template: "classic", "editorial", "split" or "bold".
- reply: one or two short, warm sentences to the agent in plain words, saying what you'll make. If you can't tell which client it's for, ask. Never mention ids or field names.`;

/** Asks Claude to read the request (structured JSON output). Falls back to the rules on any problem. */
export class ClaudeAssistant implements Assistant {
  constructor(
    private readonly client: Anthropic,
    private readonly fallback: Assistant,
    private readonly model = 'claude-opus-5-5',
    private readonly log?: { warn: (o: object, m: string) => void },
  ) {}

  async understand(input: UnderstandInput): Promise<Understanding> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 1024,
        // Reading a short request is quick work: low effort keeps it fast and cheap.
        output_config: { effort: 'low', format: betaZodOutputFormat(UnderstoodSchema) },
        // If the model declines, the API retries on a fallback model inside the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              clients: input.clients.map((c) => ({ id: c.id, name: c.name, description: c.meta })),
              taggedClientId: input.taggedClientId ?? null,
              request: input.text,
            }),
          },
        ],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error(`No usable answer (stop_reason: ${response.stop_reason})`);
      const out = response.parsed_output;
      return clean({ ...out, template: out.template as Understanding['template'] }, input, 'ai');
    } catch (err) {
      this.log?.warn({ err: err instanceof Anthropic.APIError ? { status: err.status, message: err.message } : String(err) }, 'Assistant fell back to the rule-based reader');
      return this.fallback.understand(input);
    }
  }
}

/** Claude when a key is configured, else the rule-based reader. */
export function createAssistant(opts: { apiKey?: string; model?: string; log?: { warn: (o: object, m: string) => void } }): Assistant {
  const rules = new RulesAssistant();
  if (!opts.apiKey) return rules;
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 20_000, maxRetries: 1 });
  return new ClaudeAssistant(client, rules, opts.model, opts.log);
}
