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
        description: 'AI 摄影助手 — 帮你打理客户消息、发票和杂务 / Your photography studio assistant',
        theme_color: '#0F766E',
        background_color: '#FAFAF9',
        display: 'standalone',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  base: '/sage/',
  server: { proxy: { '/api': 'http://localhost:3001' } },
  build: {
    rollupOptions: {
      external: ['@tauri-apps/api/core'],
    },
  },
});
