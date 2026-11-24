import { useEffect } from 'react';
import {
  cancelAnimation,
  type SharedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { easing } from '@/theme/motion';

/**
 * A 0 → 1 clock that loops forever on the UI thread.
 * Stays at `rest` when the user has "Reduce motion" turned on.
 * `reverse` makes it ping-pong (breathing); otherwise it wraps (drifting).
 */
export function useLoop(durationMs: number, { reverse = false, rest = 0.5, enabled = true } = {}): SharedValue<number> {
  const reduce = useReducedMotion() || !enabled;
  const t = useSharedValue(reduce ? rest : 0);

  useEffect(() => {
    if (reduce) {
      t.set(rest);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: durationMs, easing: reverse ? easing.inOut : easing.linear }), -1, reverse));
    return () => cancelAnimation(t);
  }, [durationMs, reverse, reduce, rest, t]);

  return t;
}
