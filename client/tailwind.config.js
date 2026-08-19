/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#0a0a0f',
          900: '#111118',
          850: '#16161f',
          800: '#1c1c28',
          700: '#262636',
        },
        accent: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};