import { useSyncExternalStore } from 'react';

/** A tiny shared store: components read it with `use()` and re-render when it changes. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  return {
    get,
    subscribe,
    set(next: T | ((prev: T) => T)) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach((l) => l());
    },
    reset() {
      state = initial;
      listeners.forEach((l) => l());
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}

/** "Just now", "5 min ago", "2 h ago", "Yesterday", "14 Nov" (like the app's sample labels). */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const mins = Math.round((now - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(t);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (t >= startOfToday) return `${Math.round(mins / 60)} h ago`;
  if (t >= startOfToday - 86_400_000) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Today", "Yesterday" or "14 Nov" — for deck lists. */
export function dayLabel(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - 86_400_000) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Today, 11:20", "Yesterday, 18:40", "16 Nov, 15:30" — for visits. */
export function visitTime(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const mins = Math.round((now - d.getTime()) / 60_000);
  if (mins < 60) return mins < 1 ? 'Just now' : `${mins} min ago`;
  return `${dayLabel(iso, now)}, ${time}`;
}
