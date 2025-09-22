import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // Set to 4 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /wss:\/\//,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.protocol === 'https:' && url.pathname.startsWith('/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nostr-events',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60
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
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
          strategies: 'injectManifest', // Use this strategy
          srcDir: 'public',             // Directory where your custom SW is
          filename: 'sw.js'             // The name of your service worker file
        }),
  ],
  optimizeDeps: {
    include: [
      'webtorrent',
      'bittorrent-dht',
      'torrent-discovery'
    ],
  },
  resolve: {
    alias: {
      'bittorrent-dht': path.resolve(__dirname, 'src/shims/bittorrent-dht.ts'),
    },
  },
  ssr: {
    noExternal: [
      'webtorrent',
      'bittorrent-dht',
      'torrent-discovery'
    ],
  },
});
