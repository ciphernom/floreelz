import {
  generateSecretKey,
  getPublicKey,
  SimplePool,
  finalizeEvent,
  type UnsignedEvent,
} from 'nostr-tools';
import { minePow } from 'nostr-tools/nip13';
import { toast } from 'react-hot-toast';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { VIDEO_KIND, VideoData, VideoEvent } from '../types';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

const POW_DIFFICULTY = 0;

class NostrClient {
  private pool = new SimplePool();
  private secretKey: Uint8Array;
  public publicKey: string;
  private videoSub: ReturnType<typeof this.pool.subscribeMany> | null = null;

  constructor() {
    console.log('🔐 Initializing Nostr client...');
    
    let sk = localStorage.getItem('nostr_sk');
    if (!sk) {
      this.secretKey = generateSecretKey();
      localStorage.setItem('nostr_sk', bytesToHex(this.secretKey));
      console.log('🆕 Generated new secret key');
    } else {
      this.secretKey = hexToBytes(sk);
      console.log('♻️ Loaded existing secret key');
    }
    this.publicKey = getPublicKey(this.secretKey);
    console.log(`✅ Logged in with public key: ${this.publicKey}`);
  }

  public subscribeToVideos(onVideo: (video: VideoData) => void) {
    console.log('📡 Subscribing to video feed...');
    console.log('Relays:', RELAYS);
    console.log('Filter:', { kinds: [VIDEO_KIND], limit: 20 });
    
    if (this.videoSub) {
      console.log('♻️ Closing existing subscription');
      this.videoSub.close();
    }
    
    this.videoSub = this.pool.subscribeMany(
      RELAYS,
      [{ kinds: [VIDEO_KIND], limit: 20 }],
      {
        onevent: (event) => {
          console.log('📨 Received event:', {
            id: event.id,
            kind: event.kind,
            pubkey: event.pubkey.substring(0, 10) + '...',
            created_at: new Date(event.created_at * 1000).toISOString(),
            tags: event.tags
          });
          
          const videoData = this.parseVideoEvent(event as VideoEvent);
          console.log('📹 Parsed video data:', videoData);
          onVideo(videoData);
        },
        oneose: () => {
          console.log('✅ End of stored events (EOSE)');
        }
      }
    );
    
    console.log('✅ Video subscription active');
  }

  public unsubscribeFromVideos() {
    console.log('📴 Unsubscribing from video feed...');
    if (this.videoSub) {
      this.videoSub.close();
      this.videoSub = null;
      console.log('✅ Unsubscribed from video feed');
    } else {
      console.log('⚠️ No active subscription to close');
    }
  }

  public async publishVideo(magnetURI: string, title: string, summary: string) {
    console.log('📤 Publishing video to Nostr:', {
      title,
      summary,
      magnetURI: magnetURI.substring(0, 50) + '...'
    });

    const event: UnsignedEvent = {
      kind: VIDEO_KIND,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey,
      tags: [
        ['d', title],
        ['magnet', magnetURI],
        ['title', title],
        ['summary', summary],
      ],
      content: `${title} - ${summary}`,
    };
    
    console.log('📝 Unsigned event created:', event);

    const toastId = toast.loading(`Mining Proof of Work (difficulty ${POW_DIFFICULTY})...`);
    console.time('⛏️ PoW Mining');
    
    const minedEvent = minePow(event, POW_DIFFICULTY);
    
    console.timeEnd('⛏️ PoW Mining');
    console.log('✅ PoW mining complete');
    toast.dismiss(toastId);

    const signedEvent = finalizeEvent(minedEvent, this.secretKey);
    console.log('✍️ Event signed:', signedEvent);
    
    console.log('📡 Publishing to relays...');
    const results = await this.pool.publish(RELAYS, signedEvent);
    
    console.log('📊 Publish results:', results);
    console.log('✅ Published video event:', signedEvent);
    
    return signedEvent;
  }

  public async likeVideo(video: VideoData) {
    console.log('❤️ Liking video:', video.title);
    
    let event: UnsignedEvent = {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey,
      tags: [
        ['e', video.id],
        ['p', video.author],
      ],
      content: '❤️',
    };

    console.log('Mining PoW for like...');
    event = minePow(event, POW_DIFFICULTY);

    const signedEvent = finalizeEvent(event, this.secretKey);
    const results = await this.pool.publish(RELAYS, signedEvent);
    
    console.log('✅ Like published:', results);
  }

  private parseVideoEvent(event: VideoEvent): VideoData {
    console.log('🔍 Parsing video event...');
    const findTag = (name: string) => {
      const tag = event.tags.find((t: string[]) => t[0] === name)?.[1] || '';
      console.log(`  Tag [${name}]:`, tag);
      return tag;
    };
    
    return {
      id: event.id!,
      author: event.pubkey,
      createdAt: event.created_at,
      magnetURI: findTag('magnet'),
      title: findTag('title'),
      summary: findTag('summary'),
      hashtags: event.tags.filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1]),
    };
  }
}

export const nostrClient = new NostrClient();
