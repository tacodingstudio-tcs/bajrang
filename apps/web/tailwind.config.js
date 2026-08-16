/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colours — matches the public website's maroon/gold palette
        primary: {
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
