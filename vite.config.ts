import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ protocolImports: true }), // Polyfills process, global, etc.
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
