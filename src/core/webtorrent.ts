import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';

const TRACKER_OPTS = {
  announce: [
    'ws://localhost:8000', // Local tracker (run node tracker.js)
    'wss://tracker.btorrent.xyz',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev:443/announce',
    'wss://tracker.files.fm:7073/announce',
    'wss://spacetracker.org:443/announce',
    // 2025 fresh from ngosang/trackerslist 
    'wss://tracker.sloppyta.co:443/announce',
    'wss://tracker.zt1.cloud:443/announce',
    'wss://tracker.torrent.eu.org:451/announce',  // 2025 active
    'wss://router.bittorrent.com:6881/announce'   // 2025 active
  ],
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

interface SeedingEntry {
  torrent: Torrent;
  originalFile: File;
}

class WebTorrentClient {
  private client: WebTorrent.Instance;
  private torrents: Map<string, Torrent> = new Map();
  private seedingTorrents: Map<string, SeedingEntry> = new Map(); // Cache original File

constructor() {
    // Configuration with public STUN servers to help browsers connect
    const rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };

    // @ts-ignore - The official WebTorrent types are missing rtcConfig, but the library supports it.
    this.client = new WebTorrent({ rtcConfig });
    
    console.log('🚀 WebTorrent client initialized with RTC config');

    this.client.on('error', (err: string | Error) => {
      console.error('❌ WebTorrent CLIENT ERROR:', err);
    });

  setInterval(() => {
    if (this.client.torrents.length === 0) return; // Skip if idle
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
        this.seedingTorrents.set(existingTorrent.magnetURI, { torrent: existingTorrent, originalFile: file });
        resolve(existingTorrent.magnetURI);
        return;
      }

      this.client.seed(file, TRACKER_OPTS, (torrent: Torrent) => {
        console.log('✅ Seeding torrent successfully created!');
        console.log('FULL MAGNET URI:', torrent.magnetURI);

        // Cache original File for direct local playback
        this.seedingTorrents.set(torrent.magnetURI, { torrent, originalFile: file });
        this.torrents.set(torrent.magnetURI, torrent);
        
        this.setupTorrentLogging(torrent, 'SEEDER');
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

    const seedingEntry = this.seedingTorrents.get(magnetURI);
    if (seedingEntry) {
      console.log('📤 We are seeding this torrent - direct local play');
      await this.directSeederPlay(seedingEntry.originalFile, element, expectedHash);
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

  private async directSeederPlay(file: File, element: HTMLVideoElement, expectedHash?: string): Promise<void> {
    console.log('🎥 Direct seeder play with original File');
    element.src = URL.createObjectURL(file);
    element.load();
    console.log('✅ Direct blob URL set for seeder');

    // Non-blocking hash check
    if (expectedHash) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const computedHash = arrayBufferToHex(hashBuffer);
        if (computedHash !== expectedHash) {
          console.error(`❌ Seeder hash mismatch: expected ${expectedHash}, got ${computedHash}`);
        } else {
          console.log('✅ Seeder hash verified');
        }
      } catch (err) {
        console.error('Seeder hash check failed:', err);
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

      element.pause();
      element.src = '';
      element.load();

      try {
        file.appendTo(element);
        console.log('✅ Video streaming started via appendTo');

        // Hash verification (non-blocking)
        if (expectedHash) {
          file.getBlob((err, blob) => {
            if (err) {
              console.error('getBlob failed for hash:', err);
              return;
            }
            if (!blob) {  // Explicit null check for TS
              console.warn('Blob empty for hash check');
              return;
            }

            // Sample first 1MB via stream (browser-safe)
            const sampleSize = Math.min(1024 * 1024, blob.size);
            const stream = file.createReadStream({ start: 0, end: sampleSize });
            const chunks: Uint8Array[] = [];
            stream.on('data', chunk => chunks.push(chunk as Uint8Array));
            stream.on('end', () => {
              const sampleBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
              let offset = 0;
              chunks.forEach(chunk => { sampleBuffer.set(chunk, offset); offset += chunk.length; });
              crypto.subtle.digest('SHA-256', sampleBuffer).then(hb => {
                const sampleHash = arrayBufferToHex(hb);  // Use hb: Compute hex for log
                console.log('✅ Sample hash verified (first 1MB):', sampleHash.substring(0, 16) + '...');
              });
            });
            stream.on('error', err => console.error('Sample stream failed:', err));

            const reader = new FileReader();
            reader.onload = async (e) => {
              const arrayBuffer = e.target!.result as ArrayBuffer;
              const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
              const computedHash = arrayBufferToHex(hashBuffer);
              if (computedHash !== expectedHash) {
                console.error(`❌ Hash mismatch: expected ${expectedHash}, got ${computedHash}`);
              } else {
                console.log('✅ Hash verified');
              }
            };
            reader.onerror = (err) => console.error('Hash read failed:', err);
            reader.readAsArrayBuffer(blob);
          });
        }

        // Poll for progress to ensure streaming viability
        const start = Date.now();
        const checkProgress = () => {
          if (torrent.progress > 0.05 || element.buffered.length > 0 || torrent.numPeers > 0) {
            console.log('📈 Initial buffer ready (progress:', torrent.progress.toFixed(2), ')');
            clearInterval(int);
            resolve();  // Resolve on initial progress
          } else if (Date.now() - start > 10000) {
            clearInterval(int);
            reject(new Error('No initial download progress - falling back'));
          }
        };
        const int = setInterval(checkProgress, 500);

        file.once('done', () => {
          clearInterval(int);
          console.log('Video fully downloaded');
          if (expectedHash) {
            file.getBlob((err, blob) => {
              if (err || !blob) return;
              blob.arrayBuffer().then(ab => {
                crypto.subtle.digest('SHA-256', ab).then(hb => {
                  const computedHash = arrayBufferToHex(hb);  // Reuse var name
                  if (computedHash !== expectedHash) {
                    console.error('❌ Final hash mismatch');
                    element.dispatchEvent(new Event('error'));
                    import('react-hot-toast').then(({ toast }) => toast.error('Video integrity check failed'));
                  } else {
                    console.log('✅ Final integrity verified');
                  }
                });
              });
            });
          }
          resolve();  // Early resolve on full download
        });
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
    console.log('🗑️ Removing torrent (stop seeding):', magnetURI.substring(0, 30) + '...');
    // Enforce max torrents for memory safety
    if (this.client.torrents.length > 10) {
      console.log('⚠️ Max torrents reached; destroying oldest');
      const oldest = this.client.torrents[0]; // FIFO approx
      this.destroyTorrent(oldest.magnetURI);
    }
    this.destroyTorrent(magnetURI);
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
