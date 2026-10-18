/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f3f1ff', 100: '#e9e5ff', 200: '#d6cfff', 300: '#b9acff', 400: '#9884fb',
          500: '#7a5cf5', 600: '#6a3fe8', 700: '#5a30cc', 800: '#4a2aa5', 900: '#3a2480', 950: '#1f1347',
        },
        accent: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
          500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a',
        },
        slate: {
          50: '#f7f6fb', 100: '#efedf6', 200: '#e1def0', 300: '#c8c4dc', 400: '#9994b3',
          500: '#6f6a8a', 600: '#55506f', 700: '#403c57', 800: '#2a2740', 900: '#1a182c', 950: '#0f0e1c',
        },
      },
    },
  },
  plugins: [],
};
