/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          dark: '#1C1C1E',
          text: '#1D1D1F',
          secondary: '#86868B',
          border: '#E5E5EA',
          blue: '#007AFF',
          red: '#FF3B30',
          green: '#34C759',
          orange: '#FF9500',
        },
      },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'sans-serif'] },
    },
  },
  plugins: [],
};
