import type { SharedValue } from 'react-native-reanimated';

/** One soft light blob. Positions and radius are fractions of the canvas size. */
export type GlowBlob = {
  /** Centre X as a fraction of width (may be < 0 or > 1 to bleed off-screen). */
  x: number;
  /** Centre Y as a fraction of height. */
  y: number;
  /** Radius as a fraction of width. */
  r: number;
  color: string;
  opacity?: number;
  /** Drift amplitude in px (default 24). */
  drift?: number;
  /** Phase offset 0..1 so blobs don't move in sync. */
  phase?: number;
};

/** Optional touch focus: the first blob eases toward (x, y) while `active` is 1. */
export type GlowFocus = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  active: SharedValue<number>;
};

export type GlowBackgroundProps = {
  blobs: readonly GlowBlob[];
  /** One full drift cycle in ms. */
  period?: number;
  focus?: GlowFocus;
  /** Drift and breathe. Off by default so most screens stay calm. */
  animated?: boolean;
};
