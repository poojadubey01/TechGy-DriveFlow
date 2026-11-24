import { useEffect, useState } from 'react';

import { api, errorMessage } from '@/api/client';
import type { ApiActivity } from '@/api/types';

import { visitTime } from './store';

export type Device = 'phone' | 'laptop' | 'tablet';
export type Visit = { id: string; when: string; device: Device; seconds: number; downloaded?: boolean };

export type DeckActivity = {
  visits: readonly Visit[];
  totalSeconds: number;
  /** Seconds spent on each slide, summed over all visits. */
  perSlide: number[];
  downloads: number;
};

const EMPTY: DeckActivity = { visits: [], totalSeconds: 0, perSlide: [], downloads: 0 };

function fromApi(a: ApiActivity): DeckActivity {
  return {
    visits: a.visits.map((v) => ({ id: v.id, when: visitTime(v.startedAt), device: v.device, seconds: v.seconds, downloaded: v.downloaded || undefined })),
    totalSeconds: a.totalSeconds,
    perSlide: a.perSlide,
    downloads: a.downloads,
  };
}

/** Client views of a deck's share link (loaded from the API; `reload` refreshes it). */
export function useDeckActivity(deckId: string | undefined) {
  const [version, setVersion] = useState(0);
  const key = `${deckId ?? ''}:${version}`;
  const [state, setState] = useState<{ key: string; data: DeckActivity; error: string | null }>({ key: '', data: EMPTY, error: null });
  useEffect(() => {
    if (!deckId) return;
    let alive = true;
    api<ApiActivity>(`/decks/${deckId}/activity`)
      .then((a) => alive && setState({ key, data: fromApi(a), error: null }))
      .catch((e) => alive && setState((s) => ({ key, data: s.data, error: errorMessage(e, 'Could not load the activity.') })));
    return () => {
      alive = false;
    };
  }, [deckId, key]);
  return { data: state.data, error: state.key === key ? state.error : null, loading: state.key !== key, reload: () => setVersion((v) => v + 1) };
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
