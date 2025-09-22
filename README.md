<div align="center">
  <img src="https://raw.githubusercontent.com/ciphernom/floreelz/dd176078aabb86764663c814b905f0016c60d430/logo.png" alt="FloReelz Logo" width="250">
</div>

# FloReelz
*A decentralized, censorship-resistant video-sharing platform built on Nostr and WebTorrent.*

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
![Tech Stack](https://img.shields.io/badge/tech-React%20%7C%20TypeScript-blueviolet)
![Protocols](https://img.shields.io/badge/protocols-Nostr%20%7C%20WebTorrent%20%7C%20IPFS-brightgreen)

</div>

FloReelz is a decentralized video-sharing application implemented in React and TypeScript. It integrates **Nostr** for metadata and interaction events, **WebTorrent** for peer-to-peer video seeding and streaming, and **Storacha** (IPFS-based) for persistent storage fallback. The application supports video uploads limited to 100MB MP4 files, a vertical swipeable feed for browsing, and basic interactions like likes and reports, all without reliance on centralized servers.

---

## 📚 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [📋 Prerequisites](#-prerequisites)
- [⚙️ Installation](#️-installation)
- [🚀 Running the Application](#-running-the-application)
- [📖 Usage](#-usage)
- [📁 Project Structure](#-project-structure)
- [🔧 Configuration](#-configuration)
- [💡 Development Guidelines](#-development-guidelines)
- [🤔 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## 🏛️ Architecture Overview

The application follows a client-side architecture:

-   **Nostr Layer**: Handles event publishing and subscription. Video metadata is published as custom Nostr events (kind 38234). Likes are NIP-25 reactions on video events. Profiles use NIP-05 and NIP-19 for display names and bech32 encoding.
-   **WebTorrent Layer**: Generates magnet URIs for uploaded videos and streams them via browser-based torrents. Includes DHT support via `bittorrent-dht` shim for peer discovery.
-   **IPFS/Storacha Layer**: Uploads videos to IPFS via Storacha client, requiring email-based magic-link authentication. CIDs serve as fallback URLs if WebTorrent peers are unavailable.
-   **Frontend Rendering**: React components manage state with hooks. Swiper provides vertical scrolling for the feed. Service Worker (via Workbox) precaches core assets. It uses a NetworkOnly strategy for video streams to prioritize P2P connections.
-   **Data Flow**: On upload: File → SHA-256 hash → WebTorrent seed → IPFS pin → Nostr publish. On playback: Magnet URI → WebTorrent stream (15s timeout) → IPFS fallback → Blob URL for `<video>` element.

Error handling includes toasts for failures and retry mechanisms in the video player.

---

## ✨ Features

-   **Video Upload**: Select MP4 file, compute SHA-256 hash, extract thumbnail at 1s seek (320px width, WebP format), seed via WebTorrent, pin to IPFS, publish Nostr event with magnet URI, CID, title, summary, hash, and thumbnail.
-   **Video Feed**: Subscribes to Nostr kind 38234 events, limits to 50 recent videos, renders in Swiper with virtual indexing for performance. Displays title, summary, author (resolved via NIP-19 npub or profile name).
-   **Video Playback**: Streams via WebTorrent to `<video>` element (loop, inline, muted by default). Mutes via click or button. Falls back to IPFS after 15s timeout. Magnet URI → WebTorrent stream (15s timeout) → IPFS fallback → Blob URL for the <video> element. The Service Worker intentionally does not cache video streams.
-   **Dual Feed System**: Users can toggle between a global "For You" feed for discovery and a personalized "Following" feed.
-   **Interactions**: Like/unlike via NIP-25 reaction events, shareable `nevent` links for videos, and a reporting system for moderation.
-   **Profiles**: View user profiles with stats (followers, following, total likes received). Supports follow/unfollow (kind 3 events) and zapping via a Lightning Address (NIP-57). Users can edit their own profile, including their name, bio, and Lightning Address. Video thumbnails on the profile grid display their total like count.
-   **Authentication**: Storacha email login for IPFS; Nostr via browser extension (NIP-07).
-   **PWA Caching**: Precaches assets; runtime caches Nostr events and video blobs with expiration.
-   **Moderation**: Report modal with predefined reasons, publishes to Nostr for relay moderation.

---

## 🛠️ Tech Stack

-   **Core Framework**: React 19 (with hooks for state/effects), TypeScript 5.8 (strict mode, bundler resolution).
-   **Build Tool**: Vite 5.0 (ES modules, React plugin, Node polyfills for Buffer/process).
-   **Decentralized Protocols**:
    -   **Nostr**: `nostr-tools` 2.16 for event signing/subscription/relays (default: wss://relay.damus.io).
    -   **WebTorrent**: `webtorrent` 2.8 with `bittorrent-dht` 10.0 and `bittorrent-tracker` 11.2; shim for DHT in `src/shims/bittorrent-dht.ts`.
    -   **Storacha**: `@storacha/client` 1.7 for IPFS upload/auth (magic links).
-   **UI Components**: Swiper 12.0 (Mousewheel/Virtual modules for vertical feed), React Hot Toast 2.6 for notifications.
-   **Utilities**: `@noble/hashes` 2.0 for SHA-256; `idb` 8.0 for IndexedDB video caching.
-   **PWA/Service Worker**: `vite-plugin-pwa` 0.20 with Workbox 7.1 (precaching, NetworkFirst for events, NetworkOnly for WSS, NetworkOnly for video streams).
-   **Development**: ESLint 9.33 (with React hooks/refresh plugins), tsconfig with ES2023 target.

Dependencies are listed in `package.json`; no external APIs beyond relays/trackers.

---

## 📋 Prerequisites

-   📦 **Node.js**: 18+ (for ES2022+ features).
-   📦 **npm**: 9+ (for package management).
-   🔌 **Nostr extension**: (e.g., Alby) supporting NIP-07 for signing.
-   📧 **Email address**: For Storacha authentication.

---

## ⚙️ Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/ciphernom/floreelz.git](https://github.com/ciphernom/floreelz.git)
    cd floreelz
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **(Optional) Configure Nostr relays** in `src/core/nostr.ts` (array of WSS URLs).

---

## 🚀 Running the Application

-   **Start development server:**
    ```bash
    npm run dev
    ```
    Access at `http://localhost:5173`. Hot-reload enabled.

-   **Build for production:**
    ```bash
    npm run build
    ```
    Outputs to `dist/` with minified assets and SW registration.

-   **Preview production build:**
    ```bash
    npm run preview
    ```
    Serves `dist/` locally.

-   **Lint codebase:**
    ```bash
    npm run lint
    ```
    Enforces strict rules (no unused vars, etc.).

---

## 📖 Usage

### Uploading Videos

1.  Open upload modal via "**+**" button.
2.  Input title (required) and summary.
3.  Select an MP4 file (<100MB).
4.  If unauthenticated, a modal prompts for Storacha login (email → magic link → page reload).
5.  On submit, the app computes the hash/thumbnail, seeds a magnet URI, uploads to IPFS, and publishes a Nostr event:
    ```json
    {
      "kind": 1063,
      "tags": [
        ["title", "Example Video"],
        ["summary", "Description"],
        ["magnet", "magnet:?xt=urn:btih:..."],
        ["cid", "Qm..."],
        ["hash", "sha256-..."],
        ["thumbnail", "data:image/webp;base64,..."]
      ],
      "content": "",
      "created_at": "<timestamp>"
    }
    ```
6.  Toast notifications provide feedback; keep the tab open for seeding.

### Browsing and Playback

-   The feed subscribes to `kind: 38234` events on load.
-   The active slide auto-plays (muted; toggle via click).
-   Fallback logic in `VideoPlayer.tsx`:
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

### Profiles and Interactions

-   **Tap author** → Loads profile via NIP-05 fetch.
-   **Follow**: Publishes a `kind: 3` event with `["p", pubkey]`.
-   **Like**: Publishes a NIP-25 reaction `["+", eventId, pubkey]`.
-   **Zap**: Uses NIP-57 with a LUD-16 address (100 sats default).

---

## 📁 Project Structure

```bash
floreelz/
├── public/
│   └── sw.js               # Custom Service Worker extensions (video caching)
├── src/
│   ├── components/         # UI components
│   │   ├── InteractionBar.tsx  # Like/report buttons, modals
│   │   ├── LoginModal.tsx      # Storacha auth
│   │   ├── ProfileView.tsx     # Profile tabs (videos/liked); private tab is a placeholder for a future feature.
│   │   ├── SkeletonLoader.tsx  # Loading placeholders
│   │   ├── UploadModal.tsx     # Upload form + thumbnail extraction
│   │   ├── VideoFeed.tsx       # Swiper feed + author resolution
│   │   └── VideoPlayer.tsx     # Streaming logic + mute/retry
│   ├── core/               # Protocol clients
│   │   ├── ipfs.ts           # Storacha client (auth/upload/getUrl)
│   │   ├── nostr.ts          # Event pub/sub (videos, likes, follows, reports)
│   │   └── webtorrent.ts     # Seed/stream functions
│   ├── shims/              # Polyfills
│   │   └── bittorrent-dht.ts # DHT shim for Vite
│   ├── types.ts              # Shared types (VideoData, UserProfile)
│   ├── App.tsx               # Root component + modals
│   ├── main.tsx              # ReactDOM render
│   └── index.css             # Global styles (modal-overlay, etc.)
├── vite.config.ts          # Plugins (React, polyfills, PWA)
├── tsconfig.app.json       # App TS config (ES2022, JSX)
├── tsconfig.node.json      # Node TS config (Vite)
└── package.json            # Scripts/deps
```

---

## 🔧 Configuration

-   **Nostr Relays**: Edit `src/core/nostr.ts`:
    ```ts
    const relays = ['wss://relay.damus.io', 'wss://nostr-pub.wellorder.net'];
    ```
-   **Vite/PWA**: `vite.config.ts`:
    -   `VitePWA`: Auto-update registration, manifest (`name: 'FloReelz'`, `theme: '#000000'`).
    -   Workbox: Glob patterns for assets; runtimeCaching for WSS (NetworkOnly), HTTPS paths (NetworkFirst, `nostr-events` cache, 200 entries/24h).
    -   Optimize: Include WebTorrent deps for SSR.
-   **Storacha**: API endpoint is auto-detected; email logic is in `LoginModal.tsx`.
-   **File Limits**: `MAX_FILE_SIZE = 100 * 1024 * 1024` in `UploadModal.tsx`.

---

## 💡 Development Guidelines

-   **TypeScript**: Use strict mode; extend `types.ts` for new events.
-   **Testing**: Add Vitest for components (e.g., `test('upload computes hash', () => {...})`).
-   **Debugging**: Use console logs for magnet/CID; check Service Worker dev tools for caches.
-   **Build Optimizations**: Use `optimizeDeps.include` for WebTorrent; alias for DHT shim.

---

## 🤔 Troubleshooting

-   **No Peers**: Ensure HTTPS; check trackers in magnet URI.
-   **Nostr Signing Fails**: Verify extension is active; check console for errors.
-   **IPFS Auth**: Clear localStorage; check email for the magic link.
-   **SW Issues**: Unregister in dev tools; rebuild to apply changes.
-   **Large Files**: Enforce 100MB limit; consider client-side compression if needed.

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/my-new-feature`.
3.  Commit your changes: `git commit -m "Add: My new feature"`.
4.  Push to the branch: `git push origin feature/my-new-feature`.
5.  Open a Pull Request with a clear description of changes.

Please follow existing ESLint rules and add types for any new props or events.

---

## 📜 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for the full text.
