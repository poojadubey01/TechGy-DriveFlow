/**
 * Client activity on shared decks — SAMPLE DATA.
 *
 * Real numbers need your backend: record a visit (time, device, seconds per slide, PDF download)
 * when the client view (/p/[slug]) is opened from a share link, and return it here per deck.
 */

export type Device = 'phone' | 'laptop' | 'tablet';
export type Visit = { when: string; device: Device; seconds: number; downloaded?: boolean };

/** Visits per deck id, newest first. Decks not listed haven't been opened yet. */
const VISITS: Record<string, readonly Visit[]> = {
  d1: [
    { when: 'Today, 11:20', device: 'phone', seconds: 154 },
    { when: 'Today, 09:05', device: 'laptop', seconds: 312, downloaded: true },
  ],
  d2: [
    { when: '1 h ago', device: 'phone', seconds: 128 },
    { when: 'Yesterday, 18:40', device: 'tablet', seconds: 246 },
    { when: 'Yesterday, 10:12', device: 'laptop', seconds: 401, downloaded: true },
  ],
  d3: [{ when: '16 Nov, 15:30', device: 'tablet', seconds: 98 }],
};

/** Small deterministic pseudo-random sequence, so a deck always shows the same split. */
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export type DeckActivity = {
  visits: readonly Visit[];
  totalSeconds: number;
  /** Seconds spent on each slide, summed over all visits. */
  perSlide: number[];
  downloads: number;
};

export function deckActivity(key: string, slideCount: number): DeckActivity {
  const visits = VISITS[key] ?? [];
  const totalSeconds = visits.reduce((s, v) => s + v.seconds, 0);
  const rand = seeded(key);
  // The cover and a couple of favourite slides get more attention, like real viewing.
  const weights = Array.from({ length: slideCount }, (_, i) => (i === 0 ? 1.6 : 0.5 + rand() * (rand() > 0.75 ? 2.2 : 1)));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / sum) * totalSeconds);
  const perSlide = exact.map(Math.floor);
  let left = totalSeconds - perSlide.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((p, q) => q.r - p.r)
    .forEach(({ i }) => {
      if (left > 0) {
        perSlide[i]! += 1;
        left -= 1;
      }
    });
  return { visits, totalSeconds, perSlide, downloads: visits.filter((v) => v.downloaded).length };
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
