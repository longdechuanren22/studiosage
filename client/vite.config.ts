import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'StudioSage',
        short_name: 'StudioSage',
        description: 'AI photography studio manager',
        theme_color: '#0F766E',
        background_color: '#FAFAF9',
        display: 'standalone',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
