# FloReelz

FloReelz is a decentralized video-sharing platform built with React, TypeScript, WebTorrent, and Nostr. It allows users to upload, stream, and interact with videos in a peer-to-peer network, leveraging Nostr for event publishing and WebTorrent for video distribution.

## Features

- **Video Upload**: Upload MP4 videos, which are seeded via WebTorrent and published as events on the Nostr protocol.
- **Video Feed**: Browse a vertical, swipeable feed of videos using Swiper, with metadata fetched from Nostr.
- **Streaming**: Stream videos directly in the browser using WebTorrent.
- **Interactions**: Like videos with reactions published to Nostr.
- **Notifications**: User feedback via toast notifications using `react-hot-toast`.
- **Decentralized**: No central server dependency; videos are shared peer-to-peer, and metadata is stored on Nostr relays.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: CSS (with Swiper for the video feed)
- **Decentralized Protocols**:
  - **Nostr**: For publishing and retrieving video metadata and interactions (`nostr-tools`)
  - **WebTorrent**: For peer-to-peer video seeding and streaming (`webtorrent`)
- **Build Tool**: Vite 7
- **Dependencies**:
  - `react-hot-toast` for notifications
  - `swiper` for the video feed carousel
  - `@noble/hashes` for cryptographic utilities
  - `bittorrent-tracker` for WebTorrent tracker support
- **Development Tools**:
  - ESLint for linting
  - TypeScript for type safety
  - Vite plugins (`@vitejs/plugin-react`, `vite-plugin-node-polyfills`)

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd nostr-tok-ts
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173` (or the port specified by Vite).

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Preview the production build**:
   ```bash
   npm run preview
   ```

6. **Lint the codebase**:
   ```bash
   npm run lint
   ```

## Usage

1. **Uploading a Video**:
   - Click the "+" button to open the upload modal.
   - Enter a title, summary, and select an MP4 video file.
   - Click "Upload" to seed the video via WebTorrent and publish its metadata to Nostr relays.
   - Keep the tab open during seeding to ensure availability.

2. **Browsing Videos**:
   - The video feed loads automatically, fetching video metadata from Nostr relays.
   - Swipe vertically to navigate through videos.
   - Videos stream automatically when active in the Swiper carousel.

3. **Interacting with Videos**:
   - Use the interaction bar to like a video (❤️), which publishes a reaction event to Nostr.
   - Additional interaction buttons (💬, 🔗) are placeholders for future features.

## Project Structure

```
nostr-tok-ts/
├── dist/                    # Production build output
├── node_modules/            # Dependencies
├── src/
│   ├── components/          # React components
│   │   ├── InteractionBar.tsx  # Video interaction buttons
│   │   ├── UploadModal.tsx     # Video upload form
│   │   ├── VideoFeed.tsx       # Main video feed with Swiper
│   │   ├── VideoPlayer.tsx     # WebTorrent video player
│   ├── core/
│   │   ├── nostr.ts         # Nostr client for event publishing/subscription
│   │   ├── webtorrent.ts    # WebTorrent client for seeding/streaming
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # React entry point
│   ├── types.ts             # TypeScript type definitions
│   ├── index.css            # Global styles
│   ├── vite-env.d.ts        # Vite type definitions
├── index.html               # HTML entry point
├── package.json             # Project metadata and dependencies
├── tsconfig.json            # TypeScript configuration for the app
├── tsconfig.node.json       # TypeScript configuration for Node (Vite config)
├── tsconfig.app.json        # TypeScript configuration for the app
├── vite.config.ts           # Vite configuration
├── vite.config.d.ts         # Vite config type definitions
```

## Configuration

- **Nostr Relays**: Configured in `src/core/nostr.ts` with default relays (`relay.damus.io`, `relay.snort.social`, `nos.lol`).
- **WebTorrent Trackers**: Configured in `src/core/webtorrent.ts` with public trackers (`tracker.btorrent.xyz`, `tracker.openwebtorrent.com`, `tracker.webtorrent.dev`).
- **Proof of Work**: Nostr events use a Proof of Work difficulty of 0 (configurable in `src/core/nostr.ts`).

## Development Notes

- **TypeScript**: Strict type checking is enforced (`strict: true` in `tsconfig.json`).
- **Vite**: Uses `vite-plugin-node-polyfills` to support Node.js APIs in the browser for WebTorrent.
- **WebTorrent**: Handles MP4, WebM, and M4V files. Streams are converted to Blob URLs for video playback.
- **Nostr**: Stores video metadata (title, summary, magnet URI) in custom events (`kind: 36234`).
- **Error Handling**: Comprehensive logging is implemented for debugging WebTorrent and Nostr operations.

## Limitations

- Videos must be in MP4, WebM, or M4V format.
- Seeding requires the browser tab to remain open.
- No peer discovery without active seeders for a torrent.
- Limited interaction features (only likes are implemented).
- Relies on public Nostr relays and WebTorrent trackers, which may have uptime or performance issues.

## Future Improvements

- Add support for comments and sharing via Nostr events.
- Implement video caching for faster playback.
- Enhance error handling for network disruptions.
- Add user authentication for Nostr key management.
- Support additional video formats and codecs.

## Contributing

Contributions are welcome! Please:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.

## License

This project is licensed under the GNU GPL v3 License.
