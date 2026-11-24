/**
 * `npm run seed`: a demo account with the app's sample workspace, for trying the API (and, later,
 * the app) against real data. Development only. Safe to run again: it rebuilds the demo account.
 *
 *   Demo sign-in:  demo@driveflow.local  /  driveflow-demo-1   (override with DEMO_EMAIL / DEMO_PASSWORD)
 */
import { eq } from 'drizzle-orm';

import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { createDatabase } from './db/client.js';
import { decks, deckVisits, notifications, users } from './db/schema.js';
import { hashPassword, newToken, sha256 } from './lib/crypto.js';
import { createUser } from './services/account.js';

loadEnvFile();
const config = loadConfig();
if (config.NODE_ENV === 'production' || !config.DEV_MOCKS) {
  console.error('The demo seed only runs in development (DEV_MOCKS on).');
  process.exit(1);
}

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? 'demo@driveflow.local').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'driveflow-demo-1';

const database = createDatabase({ url: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
await database.migrate();
const app = await buildApp({ config: { ...config, RATE_LIMIT: false }, database });
const { db } = database;

// Start clean: removing the user removes its decks, clients, visits and notifications too.
await db.delete(users).where(eq(users.email, DEMO_EMAIL));
const user = await createUser(db, {
  email: DEMO_EMAIL,
  name: 'Aisha Khan',
  company: 'TechGy Link',
  passwordHash: await hashPassword(DEMO_PASSWORD),
  provider: 'email',
  verified: true,
});

const signIn = await app.inject({ method: 'POST', url: '/auth/sign-in', payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
const token = signIn.json().token as string;
const call = async (method: 'GET' | 'POST', url: string, payload?: object) => {
  const res = await app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
  if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
  return res.json();
};

await call('POST', '/drive/connect', { mock: true });
await call('POST', '/drive/folder', { folderId: 'mock-projects' });
await call('POST', '/drive/sync');
const { clients } = (await call('GET', '/clients')) as { clients: { id: string; name: string }[] };
const clientId = (name: string) => clients.find((c) => c.name === name)!.id;

/** The app's five sample decks (same names, slide counts and share codes as frontend/src/data/app.ts), oldest first. */
const SAMPLE = [
  { client: 'Highrize Villas', type: 'Proposal', title: 'Phase 2 proposal', slides: 15, shareId: 'c2f8k3qa7nvb', daysAgo: 14 },
  { client: 'Vijetha Vaibhogam', type: 'Portfolio', title: 'Villa township portfolio', slides: 12, shareId: 'p9h4s6ex1lmg', daysAgo: 10 },
  { client: 'Reliance Elysium', type: 'Moodboard', title: 'Interiors moodboard', slides: 8, shareId: 'w5b2y7ju0dkf', daysAgo: 8 },
  { client: 'Other Side Villas', type: 'Proposal', title: 'Gated community proposal', slides: 15, shareId: 'r3v8n1tz6cqe', daysAgo: 1 },
  { client: 'Highrize Villas', type: 'Portfolio', title: 'Luxury villa portfolio', slides: 12, shareId: 'k7q2m9xw4hpa', daysAgo: 0 },
] as const;

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
const made: Record<string, string> = {};
for (const s of SAMPLE) {
  const deck = await call('POST', '/decks', { clientId: clientId(s.client), type: s.type, title: s.title, slides: s.slides });
  await db.update(decks).set({ shareId: s.shareId, createdAt: ago(s.daysAgo), updatedAt: ago(s.daysAgo) }).where(eq(decks.id, deck.id));
  made[s.shareId] = deck.id;
}

/** Sample client visits (like frontend/src/data/activity.ts). */
const VISITS = [
  { shareId: 'k7q2m9xw4hpa', device: 'phone', hoursAgo: 2, perSlide: [40, 22, 18, 30, 12, 9, 8, 6, 4, 3, 1, 1] },
  { shareId: 'k7q2m9xw4hpa', device: 'laptop', hoursAgo: 5, perSlide: [60, 41, 35, 30, 28, 25, 22, 20, 18, 15, 10, 8], downloaded: true },
  { shareId: 'r3v8n1tz6cqe', device: 'phone', hoursAgo: 1, perSlide: [30, 20, 15, 12, 10, 9, 8, 7, 6, 5, 3, 2, 1] },
  { shareId: 'r3v8n1tz6cqe', device: 'tablet', hoursAgo: 20, perSlide: [45, 30, 25, 22, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 4] },
  { shareId: 'r3v8n1tz6cqe', device: 'laptop', hoursAgo: 30, perSlide: [60, 45, 40, 35, 32, 30, 28, 26, 24, 22, 20, 15, 12, 7, 5], downloaded: true },
  { shareId: 'w5b2y7ju0dkf', device: 'tablet', hoursAgo: 8 * 24, perSlide: [20, 15, 14, 13, 12, 10, 8, 6] },
] as const;

for (const v of VISITS) {
  const at = ago(0, v.hoursAgo);
  const seconds = v.perSlide.reduce((a, b) => a + b, 0);
  await db.insert(deckVisits).values({
    deckId: made[v.shareId]!,
    tokenHash: sha256(newToken()),
    device: v.device,
    seconds,
    slideSeconds: [...v.perSlide],
    downloadedAt: 'downloaded' in v && v.downloaded ? at : null,
    startedAt: at,
    lastSeenAt: new Date(at.getTime() + seconds * 1000),
  });
}

await db.insert(notifications).values([
  {
    userId: user.id,
    kind: 'viewed',
    title: 'Other Side Villas opened your proposal',
    body: 'Viewed 3 times · Gated community proposal',
    target: { pathname: '/activity', params: { deck: made.r3v8n1tz6cqe! } },
    dedupeKey: `viewed:${made.r3v8n1tz6cqe}`,
    createdAt: ago(0, 1),
  },
  {
    userId: user.id,
    kind: 'photos',
    title: '12 new photos in Google Drive',
    body: 'Added to Projects / Reliance Elysium',
    target: { pathname: '/client/[id]', params: { id: clientId('Reliance Elysium') } },
    createdAt: ago(0, 4),
  },
  { userId: user.id, kind: 'team', title: 'Rohan joined your workspace', body: 'He can now tag clients and create decks', target: { pathname: '/profile' }, createdAt: ago(1), readAt: ago(1) },
]);

await app.close();
await database.close();
console.log(`Demo workspace ready: ${clients.length} clients, ${SAMPLE.length} decks, ${VISITS.length} client visits.`);
console.log(`Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
