/**
 * Motion presets: one place for every spring, duration, easing and stagger.
 * Entering animations respect the OS "Reduce motion" setting by default
 * (Reanimated ReduceMotion.System); looping effects check useReducedMotion().
 */
import { Easing, FadeIn, FadeInDown, FadeInUp, ReduceMotion, ZoomIn } from 'react-native-reanimated';

export const spring = {
  /** Buttons and chips: quick, no wobble. */
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  /** Cards and sheets settling into place. */
  settle: { damping: 20, stiffness: 180, mass: 0.9 },
  /** Playful pop for badges, check marks, labels. */
  pop: { damping: 12, stiffness: 220, mass: 0.7 },
  /** Elastic return after a drag. */
  elastic: { damping: 11, stiffness: 140, mass: 0.8 },
} as const;

export const duration = { fast: 160, base: 260, slow: 420, drift: 20000, breathe: 4200 } as const;

export const easing = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  linear: Easing.linear,
} as const;

/** Delay between items in a staggered list. */
export const stagger = (index: number, step = 70, base = 0) => base + index * step;

/** Ready-made entering animations. */
export const enter = {
  up: (index = 0, base = 0) =>
    FadeInDown.delay(stagger(index, 70, base)).springify().damping(18).stiffness(160).reduceMotion(ReduceMotion.System),
  rise: (index = 0, base = 0) =>
    FadeInUp.delay(stagger(index, 70, base)).springify().damping(18).stiffness(160).reduceMotion(ReduceMotion.System),
  fade: (index = 0, base = 0) =>
    FadeIn.delay(stagger(index, 60, base)).duration(duration.base).reduceMotion(ReduceMotion.System),
  pop: (index = 0, base = 0) =>
    ZoomIn.delay(stagger(index, 60, base)).springify().damping(14).stiffness(220).reduceMotion(ReduceMotion.System),
} as const;
