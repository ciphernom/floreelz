// src/core/webtorrent.ts
import WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';

const TRACKER_OPTS = {
  announce: [
    'wss://tracker.btorrent.xyz',
    'wss://tracker.openwebtorrent.com', 
    'wss://tracker.webtorrent.dev:443/announce',
  ],
};

class WebTorrentClient {
  private client: WebTorrent.Instance;
  private torrents: Map<string, Torrent> = new Map();
  private seedingTorrents: Map<string, Torrent> = new Map();
  private blobUrls: Map<string, string> = new Map(); // Track blob URLs for cleanup

  constructor() {
    this.client = new WebTorrent();
    
    console.log('🚀 WebTorrent client initialized');
    
    this.client.on('error', (err: string | Error) => {
      console.error('❌ WebTorrent CLIENT ERROR:', err);
    });

    setInterval(() => {
      const clientRatio = isNaN(this.client.ratio) ? 0 : this.client.ratio;
      console.log('📊 WebTorrent Stats:', {
        torrents: this.client.torrents.length,
        ratio: clientRatio.toFixed(2),
        downloadSpeed: `${(this.client.downloadSpeed / 1024).toFixed(2)} KB/s`,
        uploadSpeed: `${(this.client.uploadSpeed / 1024).toFixed(2)} KB/s`,
        progress: this.client.progress,
        peersCount: this.client.torrents.reduce((acc, t) => acc + t.numPeers, 0)
      });
      
      this.client.torrents.forEach(t => {
        const torrentRatio = isNaN(t.ratio) ? 0 : t.ratio;
        console.log(`📦 Torrent ${t.infoHash?.substring(0,6)}: peers=${t.numPeers}, progress=${(t.progress*100).toFixed(1)}%, ratio=${torrentRatio.toFixed(2)}`);
      });
    }, 5000);
  }

  public seed(file: File): Promise<string> {
    console.log('🌱 Starting to seed file:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type
    });

    return new Promise((resolve) => {
      const existingTorrent = this.client.torrents.find(t => {
        return t.files && t.files[0] && t.files[0].name === file.name;
      });
      
      if (existingTorrent) {
        console.log('⚠️ Already seeding this file, returning existing magnet');
        this.seedingTorrents.set(existingTorrent.magnetURI, existingTorrent);
        resolve(existingTorrent.magnetURI);
        return;
      }

      this.client.seed(file, TRACKER_OPTS, (torrent: Torrent) => {
        console.log('✅ Seeding torrent successfully created!');
        console.log('📋 Torrent details:', {
          infoHash: torrent.infoHash,
          magnetURI: torrent.magnetURI,
          name: torrent.name,
          files: torrent.files?.map(f => ({ name: f.name, size: f.length })) || [],
          announce: torrent.announce
        });
        console.log('FULL MAGNET URI:', torrent.magnetURI);

        this.setupTorrentLogging(torrent, 'SEEDER');
        this.seedingTorrents.set(torrent.magnetURI, torrent);
        this.torrents.set(torrent.magnetURI, torrent);
        
        console.log('📢 Announcing to trackers...');
        
        resolve(torrent.magnetURI);
      });
    });
  }

  public async stream(magnetURI: string, element: HTMLVideoElement) {
    console.log('🎬 Starting stream for magnet URI:', magnetURI.substring(0, 50) + '...');
    
    const infoHash = magnetURI.match(/btih:([a-f0-9]{40})/i)?.[1];
    if (infoHash) {
      const existingByHash = this.client.torrents.find(t => 
        t.infoHash?.toLowerCase() === infoHash.toLowerCase()
      );
      
      if (existingByHash) {
        console.log('📦 Found existing torrent by infoHash');
        await this.attachToElement(existingByHash, element);
        return;
      }
    }

    const seedingTorrent = this.seedingTorrents.get(magnetURI);
    if (seedingTorrent) {
      console.log('📤 We are seeding this torrent');
      await this.attachToElement(seedingTorrent, element);
      return;
    }

    const cachedTorrent = this.torrents.get(magnetURI);
    if (cachedTorrent) {
      console.log('♻️ Using cached torrent');
      await this.attachToElement(cachedTorrent, element);
      return;
    }

    console.log('🆕 Adding new torrent to client...');
    
    try {
      const torrent = this.client.add(magnetURI, TRACKER_OPTS);
      
      console.log('📥 Torrent added:', {
        infoHash: torrent.infoHash,
        ready: torrent.ready
      });
      
      this.torrents.set(magnetURI, torrent);
      this.setupTorrentLogging(torrent, 'DOWNLOADER');
      
      const onMetadata = () => {
        console.log('✅ Metadata received!');
        this.attachToElement(torrent, element).catch(console.error);
      };

      if (torrent.ready) {
        onMetadata();
      } else {
        torrent.on('metadata', onMetadata);
      }
      
      torrent.on('error', (err) => {
        console.error('❌ Torrent error:', err);
      });
      
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        console.log('⚠️ Duplicate torrent, finding existing...');
        const existing = this.client.torrents.find(t => 
          t.magnetURI === magnetURI || t.infoHash === infoHash
        );
        if (existing) {
          await this.attachToElement(existing, element);
        }
      } else {
        console.error('❌ Error adding torrent:', error);
      }
    }
  }

  private async attachToElement(torrent: Torrent, element: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[Attach] Initial check - ready: ${torrent.ready}, files: ${torrent.files ? torrent.files.length : 'undefined'}`);
      
      const performAttach = async () => {
        if (!torrent.files || torrent.files.length === 0) {
          console.log('❌ No files even after wait');
          const err = new Error('No files available in torrent');
          console.error(err);
          reject(err);
          return;
        }

        const file = torrent.files.find(f => 
          f.name.endsWith('.mp4') || 
          f.name.endsWith('.webm') || 
          f.name.endsWith('.m4v')
        );
        
        if (file) {
          console.log('📹 Found video file:', {
            name: file.name,
            size: `${(file.length / 1024 / 1024).toFixed(2)} MB`
          });
          
          element.pause();
          element.src = '';
          element.load();
          
          try {
            const stream = file.createReadStream();
            const chunks: Uint8Array[] = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              const blob = new Blob(chunks, { type: 'video/mp4' });
              const url = URL.createObjectURL(blob);
              this.blobUrls.set(torrent.magnetURI, url); // Track for cleanup
              element.src = url;
              console.log('✅ Video src set');
              element.play().catch(e => console.log('Autoplay blocked:', e));
              resolve();
            });
            stream.on('error', (err) => {
              console.error('❌ Error reading stream:', err);
              reject(err);
            });
          } catch (err) {
            console.error('❌ Error creating stream:', err);
            reject(err);
          }
        } else {
          const noFileErr = new Error('No video file found in torrent!');
          console.error(noFileErr);
          console.log('Available files:', torrent.files.map(f => f.name));
          reject(noFileErr);
        }
      };

      if (torrent.files && torrent.files.length > 0) {
        console.log('📎 Files available immediately');
        performAttach();
      } else {
        if (torrent.ready) {
          console.log('⏳ Polling for files (ready torrent)');
          const maxWait = 50;
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (torrent.files && torrent.files.length > 0) {
              console.log(`📎 Files available after ${attempts * 0.1}s poll`);
              clearInterval(interval);
              performAttach();
            } else if (attempts >= maxWait) {
              clearInterval(interval);
              const timeoutErr = new Error('Files poll timeout');
              console.error(timeoutErr);
              reject(timeoutErr);
            }
          }, 100);
        } else {
          console.log('⏳ Waiting for metadata event');
          const onMetadata = () => {
            console.log('📎 Metadata received, checking files');
            performAttach();
          };
          torrent.on('metadata', onMetadata);
          setTimeout(() => {
            torrent.off('metadata', onMetadata);
            const fallbackErr = new Error('Metadata timeout');
            console.error(fallbackErr);
            reject(fallbackErr);
          }, 10000);
        }
      }
    });
  }

  private setupTorrentLogging(torrent: Torrent, role: string) {
    const prefix = `[${role}:${torrent.infoHash?.substring(0, 6)}]`;
    
    torrent.on('warning', (err: Error | string) => {
      console.warn(`${prefix} ⚠️ Warning:`, err);
    });

    torrent.on('error', (err: Error | string) => {
      console.error(`${prefix} ❌ Error:`, err);
    });

    torrent.on('wire', (_wire: any, addr?: string) => {
      console.log(`${prefix} 🔌 PEER CONNECTED:`, addr || 'unknown', `(total: ${torrent.numPeers})`);
    });

    torrent.on('noPeers', (announceType?: string) => {
      console.warn(`${prefix} 😔 No peers via ${announceType}`);
    });
  }

  public remove(magnetURI: string) {
    if (this.seedingTorrents.has(magnetURI)) {
      console.log('⚠️ KEEPING SEEDER ALIVE - not removing');
      return;
    }
    
    const infoHash = magnetURI.match(/btih:([a-f0-9]{40})/i)?.[1];
    if (infoHash) {
      for (const [_uri, torrent] of this.seedingTorrents) {
        if (torrent.infoHash?.toLowerCase() === infoHash.toLowerCase()) {
          console.log('⚠️ KEEPING SEEDER ALIVE (matched by hash) - not removing');
          return;
        }
      }
    }
    
    console.log('🗑️ Removing torrent (not a seeder)');
    
    const torrent = this.torrents.get(magnetURI) || 
                   this.client.torrents.find(t => t.magnetURI === magnetURI);
    
    if (torrent && !this.seedingTorrents.has(magnetURI)) {
      this.client.remove(torrent);
      this.torrents.delete(magnetURI);
      const blobUrl = this.blobUrls.get(magnetURI);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        this.blobUrls.delete(magnetURI);
        console.log('🧹 Revoked blob URL');
      }
      console.log('✅ Torrent removed');
    }
  }
}

export const webTorrentClient = new WebTorrentClient();
