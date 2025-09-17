import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ protocolImports: true }), // Polyfills process, global, etc.
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /wss:\/\//, // Match websocket connections
            handler: 'NetworkOnly' // Don't cache websockets
          },
          {
            // Cache Nostr events with network-first strategy
            urlPattern: ({ url }: { url: URL }) => url.protocol === 'https:' && url.pathname.startsWith('/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nostr-events',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60 // 1 day
              }
            }
          }
        ]
      },
      manifest: {
        name: 'FloReelz',
        short_name: 'FloReelz',
        description: 'Decentralized Video Sharing on Nostr',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  optimizeDeps: {
    include: ['webtorrent'], // Force pre-bundling
  },
  resolve: {
    alias: {
      webtorrent: 'webtorrent/dist/webtorrent.min.js',
    },
  },
});
