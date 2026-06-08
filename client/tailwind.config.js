/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: { 50: '#F0FDFA', 500: '#0F766E', 700: '#115E59' },
        amber: { 500: '#D97706' },
        warm: { 50: '#FAFAF9', 900: '#1C1917' },
      },
    },
  },
  plugins: [],
};
