import type Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClaudeAssistant, RulesAssistant } from '../src/services/assistant.js';
import { call, makeApp, newUser, type TestApp, withDrive } from './helpers.js';

const CLIENTS = [
  { id: 'c-highrize', name: 'Highrize Villas', meta: 'Luxury villas' },
  { id: 'c-otherside', name: 'Other Side Villas', meta: 'Gated community' },
  { id: 'c-elysium', name: 'Reliance Elysium', meta: 'Residential towers' },
  { id: 'c-vijetha', name: 'Vijetha Vaibhogam', meta: 'Villa township' },
];
const rules = new RulesAssistant();
const ask = (text: string, taggedClientId: string | null = null) => rules.understand({ text, clients: CLIENTS, taggedClientId });

describe('rule-based reader (no AI key)', () => {
  it('reads a full request', async () => {
    const r = await ask('Make a 10-slide proposal for Highrize with night shots in the bold template');
    expect(r).toMatchObject({ source: 'rules', clientId: 'c-highrize', deckType: 'Proposal', slides: 10, photoChoice: 'Night renders', template: 'bold' });
    expect(r.reply).toBe('Got it: a proposal for Highrize Villas.');
  });

  it('matches a client by a distinctive word and photos by kind', async () => {
    expect(await ask('portfolio for elysium, interiors please')).toMatchObject({ clientId: 'c-elysium', deckType: 'Portfolio', photoChoice: 'Interiors', slides: null, template: null });
    expect(await ask('a moodboard with the pool and garden')).toMatchObject({ clientId: null, deckType: 'Moodboard', photoChoice: 'Exteriors' });
  });

  it('uses the tagged client, and asks when it can’t tell', async () => {
    expect((await ask('a mood board, 15 slides', 'c-vijetha')).clientId).toBe('c-vijetha');
    const vague = await ask('make something for the villas');
    expect(vague.clientId).toBeNull();
    expect(vague.reply).toMatch(/Who is this deck for/);
  });

  it('ignores slide counts out of range', async () => {
    expect((await ask('proposal for highrize, 99 slides')).slides).toBeNull();
  });
});

/** A stand-in for the Anthropic client that returns (or throws) what a test needs. */
function fakeClaude(result: unknown) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: Record<string, unknown>) => {
          calls.push(params);
          if (result instanceof Error) throw result;
          return result;
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe('Claude reader', () => {
  it('sends a structured-output request on the current model and keeps only valid answers', async () => {
    const { client, calls } = fakeClaude({
      stop_reason: 'end_turn',
      parsed_output: { clientId: 'c-elysium', deckType: 'Proposal', slides: 3, photoChoice: 'interiors', template: 'split', reply: 'I’ll make a Reliance Elysium proposal.' },
    });
    const ai = new ClaudeAssistant(client, rules);
    const r = await ai.understand({ text: 'proposal for reliance, interiors, 3 slides, split', clients: CLIENTS });
    expect(r).toEqual({ source: 'ai', clientId: 'c-elysium', deckType: 'Proposal', slides: null, photoChoice: 'Interiors', template: 'split', reply: 'I’ll make a Reliance Elysium proposal.' });
    expect(calls[0]).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] });
    expect((calls[0]!.output_config as { effort: string }).effort).toBe('low');
  });

  it('never accepts a client id that isn’t one of the account’s clients', async () => {
    const { client } = fakeClaude({ stop_reason: 'end_turn', parsed_output: { clientId: 'made-up', deckType: null, slides: 12, photoChoice: null, template: null, reply: 'Sure.' } });
    expect((await new ClaudeAssistant(client, rules).understand({ text: 'x', clients: CLIENTS })).clientId).toBeNull();
  });

  it('falls back to the rules when the call fails or the model declines', async () => {
    const failing = new ClaudeAssistant(fakeClaude(new Error('network down')).client, rules);
    expect(await failing.understand({ text: 'portfolio for highrize', clients: CLIENTS })).toMatchObject({ source: 'rules', clientId: 'c-highrize', deckType: 'Portfolio' });
    const declined = new ClaudeAssistant(fakeClaude({ stop_reason: 'refusal', parsed_output: null }).client, rules);
    expect((await declined.understand({ text: 'portfolio for highrize', clients: CLIENTS })).source).toBe('rules');
  });
});

describe('POST /assistant/understand', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp();
  });
  afterAll(async () => t.close());

  it('reads a request against the person’s own clients', async () => {
    const { token } = await newUser(t);
    const { byName } = await withDrive(t, token);
    const res = await call(t.app, 'POST', '/assistant/understand', { token, body: { text: 'Make an 8 slide portfolio for Vijetha, best of everything' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: 'rules', clientId: byName('Vijetha Vaibhogam').id, deckType: 'Portfolio', slides: 8, photoChoice: 'Best of everything' });
    const tagged = await call(t.app, 'POST', '/assistant/understand', { token, body: { text: 'a proposal', clientId: byName('Other Side Villas').id } });
    expect(tagged.body.clientId).toBe(byName('Other Side Villas').id);
    expect((await call(t.app, 'POST', '/assistant/understand', { body: { text: 'hi' } })).status).toBe(401);
    expect((await call(t.app, 'POST', '/assistant/understand', { token, body: { text: '' } })).status).toBe(400);
  });
});
