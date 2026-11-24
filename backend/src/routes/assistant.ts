import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { type Ctx, me, parse, requireAuth } from '../context.js';
import { clients } from '../db/schema.js';

export async function assistantRoutes(app: FastifyInstance, ctx: Ctx) {
  app.addHook('onRequest', requireAuth(ctx));

  /**
   * The chat's first message: reads a request like "a 10-slide proposal for Highrize with night
   * shots in the bold template" and returns what it understood, so the chat can skip the questions
   * already answered. Uses Claude when ANTHROPIC_API_KEY is set, the rule-based reader otherwise.
   */
  app.post('/assistant/understand', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { user } = me(req);
    const body = parse(z.object({ text: z.string().trim().min(1).max(500), clientId: z.uuid().nullable().optional() }), req.body);
    const list = await ctx.db
      .select({ id: clients.id, name: clients.name, meta: clients.meta })
      .from(clients)
      .where(and(eq(clients.userId, user.id), isNull(clients.removedAt)));
    const tagged = body.clientId && list.some((c) => c.id === body.clientId) ? body.clientId : null;
    return ctx.assistant.understand({ text: body.text, clients: list, taggedClientId: tagged });
  });
}
