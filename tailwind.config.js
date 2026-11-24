/** @type {import('tailwindcss').Config} */
// Colours and fonts mirror src/theme/tokens.ts — change both together.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is light-only (app.json userInterfaceStyle: "light"). 'class' stops NativeWind
  // from fighting the system theme, which throws "Cannot manually set color scheme" on web.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#F3F4F8',
        card: '#FFFFFF',
        ink: { DEFAULT: '#12152A', soft: '#3A3F55' },
        muted: '#62677C',
        placeholder: '#70768B',
        line: '#E4E7F0',
        brand: {
          DEFAULT: '#2F45FF',
          deep: '#0022FF',
          peri: '#6B79FF',
          lav: '#A9B2FF',
          sky: '#E9ECFF',
          edge: '#D5DAFF',
        },
        success: '#22C55E',
      },
      fontFamily: {
        jk: ['PlusJakartaSans_400Regular'],
        'jk-medium': ['PlusJakartaSans_500Medium'],
        'jk-semibold': ['PlusJakartaSans_600SemiBold'],
        'jk-bold': ['PlusJakartaSans_700Bold'],
      },
    },
  },
  plugins: [],
};
