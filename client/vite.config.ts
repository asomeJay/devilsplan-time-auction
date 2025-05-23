import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    server:{
        host: '0.0.0.0',
        port: 5174,
        strictPort: true,
    },
    preview: {
        host: '0.0.0.0',
        port: 5174,
    },
    define: {
        global: 'globalThis',
    },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '시간경매',
        short_name: 'TimeAuction',
        description: '시간을 걸고 하는 경매 게임',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});