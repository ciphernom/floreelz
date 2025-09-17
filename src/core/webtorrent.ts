import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';
import { Buffer } from 'buffer';
const TRACKER_OPTS = {
  announce: [
      'ws://localhost:8000', // Add your local tracker
    'wss://tracker.btorrent.xyz',
    'wss://tracker.openwebtorrent.com', 
    'wss://tracker.webtorrent.dev:443/announce',
    'wss://tracker.files.fm:7073/announce',
    'wss://spacetracker.org:443/announce'
  ],
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

class WebTorrentClient {
  private client: WebTorrent.Instance;
  private torrents: Map<string, Torrent> = new Map();
  private seedingTorrents: Map<string, Torrent> = new Map();

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
    }, 5000);
  }

  public seed(file: File): Promise<string> {
    console.log('🌱 Starting to seed file:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type
    });

    return new Promise((resolve) => {
      const existingTorrent = this.client.torrents.find(t => 
        t.files && t.files[0] && t.files[0].name === file.name
      );
      
      if (existingTorrent) {
        this.seedingTorrents.set(existingTorrent.magnetURI, existingTorrent);
        resolve(existingTorrent.magnetURI);
        return;
      }

      this.client.seed(file, TRACKER_OPTS, (torrent: Torrent) => {
        console.log('✅ Seeding torrent successfully created!');
        console.log('FULL MAGNET URI:', torrent.magnetURI);

        this.setupTorrentLogging(torrent, 'SEEDER');
        this.seedingTorrents.set(torrent.magnetURI, torrent);
        this.torrents.set(torrent.magnetURI, torrent);
        
        resolve(torrent.magnetURI);
      });
    });
  }

  public async stream(magnetURI: string, element: HTMLVideoElement, expectedHash?: string) {
    console.log('🎬 Starting stream for magnet URI:', magnetURI.substring(0, 50) + '...');
    
    const infoHash = magnetURI.match(/btih:([a-f0-9]{40})/i)?.[1];
    if (infoHash) {
      const existingByHash = this.client.torrents.find(t => 
        t.infoHash?.toLowerCase() === infoHash.toLowerCase()
      );
      
      if (existingByHash) {
        console.log('📦 Found existing torrent by infoHash');
        await this.attachToElement(existingByHash, element, expectedHash);
        return;
      }
    }

    const seedingTorrent = this.seedingTorrents.get(magnetURI);
    if (seedingTorrent) {
      console.log('📤 We are seeding this torrent');
      await this.attachToElement(seedingTorrent, element, expectedHash);
      return;
    }

    const cachedTorrent = this.torrents.get(magnetURI);
    if (cachedTorrent) {
      console.log('📦 Using cached torrent');
      await this.attachToElement(cachedTorrent, element, expectedHash);
      return;
    }

    console.log('🆕 Adding new torrent to client...');
    
    try {
      const torrent = this.client.add(magnetURI, TRACKER_OPTS);
      
      this.torrents.set(magnetURI, torrent);
      this.setupTorrentLogging(torrent, 'DOWNLOADER');
      
      const onMetadata = () => {
        this.attachToElement(torrent, element, expectedHash).catch(err => {
          console.error('Attach failed:', err);
          this.destroyTorrent(magnetURI);
          throw err;
        });
      };

      if (torrent.ready) {
        onMetadata();
      } else {
        torrent.on('metadata', onMetadata);
      }
      
      torrent.on('error', (err) => {
        console.error('❌ Torrent error:', err);
        this.destroyTorrent(magnetURI);
      });
      
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        console.log('⚠️ Duplicate torrent, finding existing...');
        const existing = this.client.torrents.find(t => 
          t.magnetURI === magnetURI || t.infoHash === infoHash
        );
        if (existing) {
          await this.attachToElement(existing, element, expectedHash);
        }
      } else {
        console.error('❌ Error adding torrent:', error);
        this.destroyTorrent(magnetURI);
        throw error;
      }
    }
  }

 private async attachToElement(torrent: Torrent, element: HTMLVideoElement, expectedHash?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Attach] Initial check - ready: ${torrent.ready}, files: ${torrent.files ? torrent.files.length : 'undefined'}`);
    
    const performAttach = async () => {
      if (!torrent.files || torrent.files.length === 0) {
        reject(new Error('No files available in torrent'));
        return;
      }

      const file: TorrentFile | undefined = torrent.files.find(f => 
        /\.(mp4|webm|m4v)$/i.test(f.name)
      );

      if (!file) {
        reject(new Error('No video file found in torrent'));
        return;
      }

      console.log('📹 Found video file:', {
        name: file.name,
        size: `${(file.length / 1024 / 1024).toFixed(2)} MB`
      });

      // Special case for fully available torrents (e.g., own uploads/seeders)
      if (torrent.progress >= 1) {
        console.log('📹 Using direct blob URL since fully available');
        file.getBlob((err, blob) => {
          if (err) {
            console.error('Failed to get blob:', err);
            reject(err);
            return;
          }
          if (!blob) {
            reject(new Error('Blob is empty'));
            return;
          }
          const url = URL.createObjectURL(blob);
          element.src = url;
          element.load();
          console.log('✅ Direct blob URL set');

          // Hash verification (async) - read directly from blob
          if (expectedHash) {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const arrayBuffer = e.target!.result as ArrayBuffer;
              const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
              const computedHash = arrayBufferToHex(hashBuffer);
              if (computedHash !== expectedHash) {
                URL.revokeObjectURL(url);
                element.src = '';
                reject(new Error(`Hash mismatch: expected ${expectedHash}, got ${computedHash}`));
              } else {
                console.log('✅ Hash verified for direct play');
                resolve();
              }
            };
            reader.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error('Failed to read blob for hash check'));
            };
            reader.readAsArrayBuffer(blob);
          } else {
            resolve();
          }
        });
        return; // Exit early for direct play
      }

      // Original streaming logic for partial downloads
      element.pause();
      element.src = '';
      element.load();
      
      try {
        file.appendTo(element);
        console.log('✅ Video streaming started');

        file.once('done', async () => {
          console.log('Video fully downloaded, verifying integrity...');
          try {
            const buffer = await new Promise<Buffer>((resolve, reject) => {
              file.getBuffer((err, buffer) => {
                if (err) return reject(err);
                if (!buffer) return reject(new Error('Buffer is empty'));
                resolve(buffer);
              });
            });
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const computedHash = arrayBufferToHex(hashBuffer);

            if (expectedHash && computedHash !== expectedHash) {
              throw new Error(`Hash mismatch: expected ${expectedHash}, got ${computedHash}`);
            }

            console.log('✅ Integrity verified');
          } catch (err) {
            console.error('❌ Integrity check failed:', err);
            element.src = '';
            element.load();
            element.dispatchEvent(new Event('error'));
            import('react-hot-toast').then(({ toast }) => toast.error('Video integrity check failed'));
          }
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    };

    if (torrent.files && torrent.files.length > 0) {
      performAttach();
    } else {
      if (torrent.ready) {
        console.log('⏳ Polling for files (ready torrent)');
        const maxWait = 50;
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (torrent.files && torrent.files.length > 0) {
            clearInterval(interval);
            performAttach();
          } else if (attempts >= maxWait) {
            clearInterval(interval);
            reject(new Error('Files poll timeout'));
          }
        }, 100);
      } else {
        console.log('⏳ Waiting for metadata event');
        const onMetadata = () => {
          performAttach().catch(reject);
        };
        torrent.on('metadata', onMetadata);
        setTimeout(() => {
          torrent.removeListener('metadata', onMetadata);
          reject(new Error('Metadata timeout'));
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
    console.log('🌱 Keeping torrent for seeding:', magnetURI.substring(0, 30) + '...');
    return;
  }
  
  public destroyTorrent(magnetURI: string): void {
    let torrent = this.torrents.get(magnetURI);
    if (!torrent) {
      torrent = this.client.torrents.find(t => t.magnetURI === magnetURI);
    }
    if (!torrent) {
      console.log('⚠️ No torrent found to destroy:', magnetURI.substring(0, 30) + '...');
      return;
    }

    this.torrents.delete(magnetURI);
    this.seedingTorrents.delete(magnetURI);

    this.client.remove(torrent);
    console.log('💥 Destroyed torrent:', magnetURI.substring(0, 30) + '...');
  }
}

export const webTorrentClient = new WebTorrentClient();
