/**
 * DriveFlow "Light Glow" design tokens.
 * Light canvas, brand blue, soft lavender glows. Black is only used for text.
 * Keep in sync with tailwind.config.js (colours + font families).
 */
export const colors = {
  canvas: '#F3F4F8',
  card: '#FFFFFF',
  ink: '#12152A',
  inkSoft: '#3A3F55',
  /** Secondary text: >= 4.7:1 on white, canvas and sky (WCAG AA). */
  muted: '#62677C',
  /** Placeholder text in white fields (4.5:1 on white). */
  placeholder: '#70768B',
  line: '#E4E7F0',
  brand: '#2F45FF',
  brandDeep: '#0022FF',
  peri: '#6B79FF',
  lav: '#A9B2FF',
  sky: '#E9ECFF',
  edge: '#D5DAFF',
  success: '#22C55E',
  /** Form errors (text + field border). Passes 4.5:1 on white. */
  danger: '#C8283A',
  white: '#FFFFFF',
} as const;

/** Glow blob colours, deepest first. */
export const glow = {
  deep: '#1E36FF',
  mid: '#3A50FF',
  peri: '#7F8CFF',
  haze: '#B9C1FF',
  mist: '#C3CAFF',
} as const;

/** Gradient stops for the stacked client cards, deep blue to lavender. */
export const cardGradients: readonly (readonly [string, string])[] = [
  ['#1F37FF', '#3E54FF'],
  ['#4357FF', '#6170FF'],
  ['#6A78FF', '#8794FF'],
  ['#929EFF', '#B0B9FF'],
] as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;

/** CSS box-shadow strings (supported natively on the New Architecture and on web). */
export const shadow = {
  soft: '0px 6px 18px rgba(28, 40, 120, 0.08)',
  card: '0px 10px 26px rgba(28, 40, 120, 0.10)',
  lift: '0px 22px 46px rgba(28, 40, 120, 0.18)',
  brand: '0px 14px 30px rgba(0, 34, 255, 0.28)',
  brandSoft: '0px 10px 24px rgba(0, 34, 255, 0.22)',
  sheet: '0px -16px 40px rgba(28, 40, 120, 0.12)',
} as const;
