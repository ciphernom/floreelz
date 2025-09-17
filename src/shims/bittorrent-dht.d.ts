// ./src/shims/bittorrent-dht.d.ts
declare module 'bittorrent-dht' {
  // Stub for browser - WebTorrent expects empty Client
  export const Client: {};
  // Export other symbols as any (no need for full types)
  export const DHT: any;
  // Add more if needed, e.g., export * from 'bittorrent-dht'; but keep minimal
}
