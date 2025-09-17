# FloReelz

FloReelz is a decentralized video-sharing application implemented in React and TypeScript. It integrates Nostr for metadata and interaction events, WebTorrent for peer-to-peer video seeding and streaming, and Storacha (IPFS-based) for persistent storage fallback. The application supports video uploads limited to 100MB MP4 files, a vertical swipeable feed for browsing, and basic interactions like likes and reports, all without reliance on centralized servers.

## Architecture Overview

The application follows a client-side architecture:

- **Nostr Layer**: Handles event publishing and subscription. Video metadata is published as custom Nostr events (kind 1063, following NIP-52 for video notes). Likes are NIP-25 reactions on video events. Profiles use NIP-05 and NIP-19 for display names and bech32 encoding.
- **WebTorrent Layer**: Generates magnet URIs for uploaded videos and streams them via browser-based torrents. Includes DHT support via `bittorrent-dht` shim for peer discovery.
- **IPFS/Storacha Layer**: Uploads videos to IPFS via Storacha client, requiring email-based magic-link authentication. CIDs serve as fallback URLs if WebTorrent peers are unavailable.
- **Frontend Rendering**: React components manage state with hooks. Swiper provides vertical scrolling for the feed. Service Worker (via Workbox) caches assets, Nostr events (NetworkFirst, 24h expiration), and video blobs (IDB persistence).
- **Data Flow**: On upload: File → SHA-256 hash → WebTorrent seed → IPFS pin → Nostr publish. On playback: Magnet URI → WebTorrent stream (15s timeout) → IPFS fallback → Blob URL for `<video>` element.

Error handling includes toasts for failures and retry mechanisms in the video player.

## Features

- **Video Upload**: Select MP4 file, compute SHA-256 hash, extract thumbnail at 1s seek (320px width, WebP format), seed via WebTorrent, pin to IPFS, publish Nostr event with magnet URI, CID, title, summary, hash, and thumbnail.
- **Video Feed**: Subscribes to Nostr kind 1063 events, limits to 50 recent videos, renders in Swiper with virtual indexing for performance. Displays title, summary, author (resolved via NIP-19 npub or profile name).
- **Video Playback**: Streams via WebTorrent to `<video>` element (loop, inline, muted by default). Mutes via click or button. Falls back to IPFS after 15s timeout. Caches blobs in IndexedDB via Service Worker.
- **Interactions**: Like/unlike via NIP-25 reaction events; reports publish kind 1984 events with reason (spam, NSFW, etc.).
- **Profiles**: Fetches NIP-05 metadata; supports follow/unfollow (kind 3 contacts), zaps (NIP-57, hardcoded 100 sats), and stats (followers, likes). Own profile editable via NIP-05 update.
- **Authentication**: Storacha email login for IPFS; Nostr via browser extension (NIP-07).
- **PWA Caching**: Precaches assets; runtime caches Nostr events and video blobs with expiration.
- **Moderation**: Report modal with predefined reasons, publishes to Nostr for relay moderation.

## Tech Stack

- **Core Framework**: React 19 (with hooks for state/effects), TypeScript 5.8 (strict mode, bundler resolution).
- **Build Tool**: Vite 5.0 (ES modules, React plugin, Node polyfills for Buffer/process).
- **Decentralized Protocols**:
  - Nostr: `nostr-tools` 2.16 for event signing/subscription/relays (default: wss://relay.damus.io).
  - WebTorrent: `webtorrent` 2.8 with `bittorrent-dht` 10.0 and `bittorrent-tracker` 11.2; shim for DHT in `src/shims/bittorrent-dht.ts`.
  - Storacha: `@storacha/client` 1.7 for IPFS upload/auth (magic links).
- **UI Components**: Swiper 12.0 (Mousewheel/Virtual modules for vertical feed), React Hot Toast 2.6 for notifications.
- **Utilities**: `@noble/hashes` 2.0 for SHA-256; `idb` 8.0 for IndexedDB video caching.
- **PWA/Service Worker**: `vite-plugin-pwa` 0.20 with Workbox 7.1 (precaching, NetworkFirst for events, NetworkOnly for WSS, custom video handler with IDB).
- **Development**: ESLint 9.33 (with React hooks/refresh plugins), tsconfig with ES2023 target.

Dependencies are listed in `package.json`; no external APIs beyond relays/trackers.

## Prerequisites

- Node.js 18+ (for ES2022+ features).
- npm 9+ (for package management).
- Nostr extension (e.g., Alby) supporting NIP-07 for signing.
- Email address for Storacha authentication.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/ciphernom/floreelz.git
   cd floreelz
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. (Optional) Configure Nostr relays in `src/core/nostr.ts` (array of WSS URLs).

## Running the Application

- Start development server:
  ```
  npm run dev
  ```
  Access at `http://localhost:5173`. Hot-reload enabled.

- Build for production:
  ```
  npm run build
  ```
  Outputs to `dist/` with minified assets and SW registration.

- Preview production build:
  ```
  npm run preview
  ```
  Serves `dist/` locally.

- Lint codebase:
  ```
  npm run lint
  ```
  Enforces strict rules (no unused vars, etc.).

## Usage

### Uploading Videos

1. Open upload modal via "+" button.
2. Input title (required) and summary.
3. Select MP4 file (<100MB).
4. If unauthenticated, modal prompts Storacha login (email → magic link → page reload).
5. On submit: Computes hash/thumbnail → Seeds magnet URI → Uploads to IPFS → Publishes Nostr event:
   ```json
   {
     "kind": 1063,
     "tags": [["title", "Example Video"], ["summary", "Description"], ["magnet", "magnet:?xt=urn:btih:..."], ["cid", "Qm..."], ["hash", "sha256-..."], ["thumbnail", "data:image/webp;base64,..."]],
     "content": "",
     "created_at": <timestamp>
   }
   ```
6. Toast feedback; keep tab open for seeding.

### Browsing and Playback

- Feed subscribes to kind 1063 events on load.
- Active slide auto-plays (muted; toggle via click).
- Fallback logic in `VideoPlayer.tsx`:
  ```tsx
  await Promise.race([
    webTorrentClient.stream(magnetURI, videoElement, hash),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
  ]).catch(async (err) => {
    if (cid) {
      const ipfsUrl = await ipfsClient.getFileUrl(cid);
      videoElement.src = ipfsUrl;
    }
  });
  ```
- Blobs cached in SW: `registerRoute` for video destinations → fetch → cache.put + IDB store.

### Profiles and Interactions

- Tap author → Loads profile via NIP-05 fetch.
- Follow: Publishes kind 3 event with `["p", pubkey]`.
- Like: NIP-25 reaction `["+", eventId, pubkey]`.
- Zap: NIP-57 with LUD-16 address (100 sats default).

## Project Structure

```
floreelz/
├── public/
│   └── sw.js              # Custom Service Worker extensions (video caching)
├── src/
│   ├── components/        # UI components
│   │   ├── InteractionBar.tsx  # Like/report buttons, modals
│   │   ├── LoginModal.tsx     # Storacha auth
│   │   ├── ProfileView.tsx    # Profile tabs (videos/liked/private)
│   │   ├── SkeletonLoader.tsx # Loading placeholders
│   │   ├── UploadModal.tsx    # Upload form + thumbnail extraction
│   │   ├── VideoFeed.tsx      # Swiper feed + author resolution
│   │   └── VideoPlayer.tsx    # Streaming logic + mute/retry
│   ├── core/              # Protocol clients
│   │   ├── ipfs.ts        # Storacha client (auth/upload/getUrl)
│   │   ├── nostr.ts       # Event pub/sub (videos, likes, follows, reports)
│   │   └── webtorrent.ts  # Seed/stream functions
│   ├── shims/             # Polyfills
│   │   └── bittorrent-dht.ts  # DHT shim for Vite
│   ├── types.ts           # Shared types (VideoData, UserProfile)
│   ├── App.tsx            # Root component + modals
│   ├── main.tsx           # ReactDOM render
│   └── index.css          # Global styles (modal-overlay, etc.)
├── vite.config.ts         # Plugins (React, polyfills, PWA)
├── tsconfig.app.json      # App TS config (ES2022, JSX)
├── tsconfig.node.json     # Node TS config (Vite)
└── package.json           # Scripts/deps
```

## Configuration

- **Nostr Relays**: Edit `src/core/nostr.ts`:
  ```ts
  const relays = ['wss://relay.damus.io', 'wss://nostr-pub.wellorder.net'];
  ```
- **Vite/PWA**: `vite.config.ts`:
  - `VitePWA`: Auto-update registration, manifest (name: 'FloReelz', theme: '#000000').
  - Workbox: Glob patterns for assets; runtimeCaching for WSS (NetworkOnly), HTTPS paths (NetworkFirst, nostr-events cache, 200 entries/24h).
  - Optimize: Include WebTorrent deps for SSR.
- **Storacha**: API endpoint auto-detected; email in `LoginModal.tsx`.
- **File Limits**: `MAX_FILE_SIZE = 100 * 1024 * 1024` in `UploadModal.tsx`.

## Development Guidelines

- **TypeScript**: Strict mode; extend `types.ts` for new events.
- **Testing**: Add Vitest for components (e.g., `test('upload computes hash', () => {...})`).
- **Debugging**: Console logs for magnet/CID; check SW dev tools for caches.
- **Build Optimizations**: `optimizeDeps.include` for WebTorrent; alias for DHT shim.

## Troubleshooting

- **No Peers**: Ensure HTTPS; check trackers in magnet URI.
- **Nostr Signing Fails**: Verify extension; fallback to console errors.
- **IPFS Auth**: Clear localStorage; check email for magic link.
- **SW Issues**: Unregister in dev tools; rebuild for changes.
- **Large Files**: Enforce 100MB limit; compress videos client-side if needed.

## Contributing

1. Fork the repository.
2. Create feature branch: `git checkout -b feature/detailed-description`.
3. Commit changes: `git commit -m "Add: Detailed Nostr event handling"`.
4. Push: `git push origin feature/detailed-description`.
5. Open PR with description of changes/tests.

Follow ESLint rules; add types for new props/events. Issues welcome for protocol bugs.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for the full text.
