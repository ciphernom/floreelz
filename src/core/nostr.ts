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
import { ModerationSystem, ReportReason } from './moderation';
import { ReputationManager } from './reputation';

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
  public likedVideos: Set<string> = new Set(); // Track liked video IDs
  private moderationSystem: ModerationSystem;
  public reputationManager: ReputationManager;

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
    this.moderationSystem = new ModerationSystem(this.secretKey, this.publicKey);
    this.reputationManager = new ReputationManager();
  }

  async reportVideo(videoId: string, authorPubkey: string, reason: ReportReason) {
    // Calculate velocity before reporting
    const velocityMultiplier = await this.moderationSystem.calculateVelocityPenalty(videoId);
    // Record the report impact on reputation
    this.reputationManager.recordReport(authorPubkey, this.publicKey, velocityMultiplier);
    return this.moderationSystem.reportVideo(videoId, authorPubkey, reason);
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
        onevent: async (event) => {
          console.log('📨 Received event:', {
            id: event.id,
            kind: event.kind,
            pubkey: event.pubkey.substring(0, 10) + '...',
            created_at: new Date(event.created_at * 1000).toISOString(),
            tags: event.tags
          });
          
          const videoData = this.parseVideoEvent(event as VideoEvent);
          console.log('📹 Parsed video data:', videoData);
          
          // MODIFIED: Replace old moderation with reputation check
          const uploaderRep = this.reputationManager.getReputationScore(event.pubkey);
          console.log(`[Filter] Uploader ${event.pubkey.slice(0,10)}... rep: ${uploaderRep.toFixed(3)}`);
          
          if (!this.moderationSystem.shouldHideVideo(uploaderRep)) {
            onVideo(videoData);
          } else {
            console.log(`[Filter] Hiding video ${event.id} (low rep: ${uploaderRep.toFixed(3)})`);
            //  Destroy torrent for hidden videos (responsible behaviour)
            import('../core/webtorrent').then(({ webTorrentClient }) => {
              webTorrentClient.destroyTorrent(videoData.magnetURI);
            });
          }
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
    const isLiked = this.likedVideos.has(video.id);
    
    if (isLiked) {
      // Unlike - remove from set
      console.log('💔 Unliking video:', video.title);
      this.likedVideos.delete(video.id);
    } else {
      // Like - add to set and publish event
      console.log('❤️ Liking video:', video.title);
      this.likedVideos.add(video.id);
      
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
      
      // NEW: Record positive reputation signal for author
      this.reputationManager.recordLike(video.author, this.publicKey);
    }
    
    return !isLiked; // Return new liked state
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
  
  private userVideosCache = new Map<string, VideoData[]>();

    public async getUserVideos(pubkey: string): Promise<VideoData[]> {
      // Check cache first
      if (this.userVideosCache.has(pubkey)) {
        return this.userVideosCache.get(pubkey)!;
      }

      console.log('📹 Fetching videos for user:', pubkey.substring(0, 10) + '...');
      
      const events = await this.pool.querySync(RELAYS, {
        kinds: [VIDEO_KIND],
        authors: [pubkey],
        limit: 100
      });
      
      const videos = events
        .map(event => this.parseVideoEvent(event as VideoEvent))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      // Cache the results
      this.userVideosCache.set(pubkey, videos);
      
      console.log(`✅ Found ${videos.length} videos for user`);
      return videos;
    }

public async getUserStats(pubkey: string): Promise<{
  following: number;
  followers: number;
  likes: number;
}> {
  console.log('📊 Fetching stats for user:', pubkey.substring(0, 10) + '...');
  
  // Get following count (kind 3 contact list)
  const followingEvents = await this.pool.querySync(RELAYS, {
    kinds: [3],
    authors: [pubkey],
    limit: 1
  });
  
  let followingCount = 0;
  if (followingEvents.length > 0) {
    // Count p tags in contact list
    followingCount = followingEvents[0].tags.filter(t => t[0] === 'p').length;
  }
  
  // Get followers count
  const followerEvents = await this.pool.querySync(RELAYS, {
    kinds: [3],
    '#p': [pubkey],
    limit: 500 // Reduced for performance
  });
  
  // Get total likes received on user's videos
  const userVideos = await this.getUserVideos(pubkey);
  const videoIds = userVideos.map(v => v.id);
  
  let totalLikes = 0;
  if (videoIds.length > 0) {
    // Query in batches to avoid too large queries
    const batchSize = 20;
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      const likeEvents = await this.pool.querySync(RELAYS, {
        kinds: [7],
        '#e': batch,
        limit: 500
      });
      totalLikes += likeEvents.length;
    }
  }
  
  const stats = {
    following: followingCount,
    followers: followerEvents.length,
    likes: totalLikes
  };
  
  console.log('📊 Stats:', stats);
  return stats;
}

    public async follow(pubkey: string): Promise<void> {
      console.log('➕ Following user:', pubkey.substring(0, 10) + '...');
      
      // Get current following list
      const events = await this.pool.querySync(RELAYS, {
        kinds: [3],
        authors: [this.publicKey],
        limit: 1
      });
      
      let tags: string[][] = [];
      if (events.length > 0) {
        tags = events[0].tags.filter(t => t[0] === 'p');
      }
      
      // Add new follow if not already following
      if (!tags.some(t => t[1] === pubkey)) {
        tags.push(['p', pubkey]);
      }
      
      const event: UnsignedEvent = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: this.publicKey,
        tags,
        content: ''
      };
      
      const signedEvent = finalizeEvent(event, this.secretKey);
      await this.pool.publish(RELAYS, signedEvent);
      
      console.log('✅ Followed user');
    }

    public async unfollow(pubkey: string): Promise<void> {
      console.log('➖ Unfollowing user:', pubkey.substring(0, 10) + '...');
      
      const events = await this.pool.querySync(RELAYS, {
        kinds: [3],
        authors: [this.publicKey],
        limit: 1
      });
      
      if (events.length === 0) return;
      
      // Remove from following list
      const tags = events[0].tags.filter(t => !(t[0] === 'p' && t[1] === pubkey));
      
      const event: UnsignedEvent = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: this.publicKey,
        tags,
        content: ''
      };
      
      const signedEvent = finalizeEvent(event, this.secretKey);
      await this.pool.publish(RELAYS, signedEvent);
      
      console.log('✅ Unfollowed user');
    }

    public async isFollowing(pubkey: string): Promise<boolean> {
      const events = await this.pool.querySync(RELAYS, {
        kinds: [3],
        authors: [this.publicKey],
        limit: 1
      });
      
      if (events.length === 0) return false;
      
      return events[0].tags.some(t => t[0] === 'p' && t[1] === pubkey);
    }

    public async getLikedVideos(): Promise<VideoData[]> {
      // Get all like events from this user
      const likeEvents = await this.pool.querySync(RELAYS, {
        kinds: [7],
        authors: [this.publicKey],
        limit: 100
      });
      
      // Extract video event IDs
      const videoIds = likeEvents
        .map(e => e.tags.find(t => t[0] === 'e')?.[1])
        .filter(Boolean) as string[];
      
      if (videoIds.length === 0) return [];
      
      // Fetch the actual video events
      const videoEvents = await this.pool.querySync(RELAYS, {
        kinds: [VIDEO_KIND],
        ids: videoIds
      });
      
      return videoEvents
        .map(event => this.parseVideoEvent(event as VideoEvent))
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    // Add a method to get the secret key for export
    public getSecretKey(): Uint8Array {
      return this.secretKey;
    }

    // Method to clear video cache when needed
    public clearVideoCache(pubkey?: string): void {
      if (pubkey) {
        this.userVideosCache.delete(pubkey);
      } else {
        this.userVideosCache.clear();
      }
    }
    
}

export const nostrClient = new NostrClient();
