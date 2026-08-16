/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Heritage-luxury palette (Taj Hotels reference) — deep maroon,
        // replacing the earlier green/marigold folk scheme.
        maroon: {
          50:  '#fbf1f1',
          100: '#f1dcdd',
          200: '#dfb3b6',
          300: '#c68488',
          400: '#a85459',
          500: '#8c363c',
          600: '#722931',
          700: '#5a1f26',
          800: '#45181d',
          900: '#331215',
        },
        // Muted antique brass/gold — restrained, not bright marigold.
        gold: {
          50:  '#fbf8ef',
          100: '#f2e8cc',
          200: '#e3ce97',
          300: '#d1ac65',
          400: '#c19643',
          500: '#a97f34',
          600: '#8c6829',
          700: '#6f5121',
        },
        ivory: {
          50:  '#fefdfb',
          100: '#f7f3ec',
        },
        ink: {
          900: '#1a1412',
          800: '#2e2320',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        gu: ['"Noto Sans Gujarati"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
