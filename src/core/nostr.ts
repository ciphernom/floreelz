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
import { ReputationManager } from './reputation';
import {
  ModerationSystem,
  ReportReason,
  REPORT_KIND,
  REPORT_POW_DIFFICULTY,
  VELOCITY_THRESHOLD_REPORTS,
  VELOCITY_TIME_WINDOW,
} from './moderation';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

const POW_DIFFICULTY = 10; // Configurable PoW difficulty for anti-spam


class NostrClient {
  private pool = new SimplePool();
  private secretKey: Uint8Array | null = null;
  public publicKey: string | null = null;
  private videoSub: ReturnType<typeof this.pool.subscribeMany> | null = null;
  public likedVideos: Set<string> = new Set();
  private moderationSystem = new ModerationSystem();
  public reputationManager: ReputationManager;
  private usingExtension: boolean = false;
  private extension: any = null;

  constructor() {
    console.log('🔐 Initializing Nostr client...');
    
    this.extension = typeof window !== 'undefined' ? (window as any).nostr : null;
    this.usingExtension = !!this.extension;

    if (!this.usingExtension) {
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
    } else {
      console.log('🔌 Detected NIP-07 extension');
      this.publicKey = null;
      this.secretKey = null;
    }

    this.reputationManager = new ReputationManager();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.publicKey) return;

    if (this.usingExtension) {
      try {
        this.publicKey = await this.extension.getPublicKey();
        console.log(`✅ Using NIP-07 extension with pubkey: ${this.publicKey}`);
      } catch (e) {
        console.error('Failed to get pubkey from extension:', e);
        toast.error('Nostr extension required for signing');
        throw e;
      }
    }
  }

  private async signEvent(unsigned: UnsignedEvent): Promise<any> {
    await this.ensureInitialized();
    if (this.usingExtension) {
      return await this.extension.signEvent(unsigned);
    } else {
      return finalizeEvent(unsigned, this.secretKey!);
    }
  }

  public async getSecretKey(): Promise<Uint8Array> {
    if (this.usingExtension) {
      throw new Error('Using NIP-07 extension - no local secret key');
    }
    return this.secretKey!;
  }

  private async calculateVelocityPenalty(videoEventId: string): Promise<number> {
    const reports = await this.pool.querySync(RELAYS, {
      kinds: [REPORT_KIND],
      '#e': [videoEventId],
      limit: 10
    });
    
    if (reports.length < VELOCITY_THRESHOLD_REPORTS) {
      return 1.0;
    }
    
    const sortedReports = reports.sort((a, b) => a.created_at - b.created_at);
    const timeDelta = sortedReports[sortedReports.length - 1].created_at - sortedReports[0].created_at;
    
    if (timeDelta <= VELOCITY_TIME_WINDOW) {
      console.log(`🚨 Velocity surge detected for ${videoEventId.slice(0,10)}... (${reports.length} reports in ${timeDelta}s)`);
      return 3.0;
    }
    
    return 1.0;
  }

  public async reportVideo(videoId: string, authorPubkey: string, reason: ReportReason): Promise<void> {
    await this.ensureInitialized();
    
    const velocityMultiplier = await this.calculateVelocityPenalty(videoId);
    this.reputationManager.recordReport(authorPubkey, this.publicKey!, velocityMultiplier);

    const event: UnsignedEvent = {
      kind: REPORT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey!,
      tags: [
        ['e', videoId, 'report'],
        ['p', authorPubkey],
        ['reason', reason],
      ],
      content: `Reported for: ${reason}`,
    };
    
    console.log(`⛏️ Mining PoW for report (diff ${REPORT_POW_DIFFICULTY})...`);
    const minedEvent = minePow(event, REPORT_POW_DIFFICULTY);
    
    const signedEvent = await this.signEvent(minedEvent);
    await this.pool.publish(RELAYS, signedEvent);
    console.log('✅ Report published');
  }

  public subscribeToVideos(onVideo: (video: VideoData) => void) {
   // Phase 3: Enhanced subscription for personalized discovery
   // First, get followed users for social feed
   this.getFollowedPubkeys().then(followed => {
     const filters = [{ kinds: [VIDEO_KIND], authors: followed, limit: 50 }];
     // Add filter for videos liked by followed users
     if (followed.length > 0) {
       filters.push({ kinds: [7], authors: followed, limit: 100 }); // Likes by followed
     }
     this.videoSub = this.pool.subscribeMany(RELAYS, filters, {
       onevent: async (event) => {
         // Handle video events and like events to fetch liked videos
         if (event.kind === VIDEO_KIND) {
          const videoData = this.parseVideoEvent(event as VideoEvent);
          const uploaderRep = this.reputationManager.getReputationScore(event.pubkey);
            if (!this.moderationSystem.shouldHideVideo(uploaderRep)) {
              onVideo(videoData); // Deduplication is correctly handled in the VideoFeed component
            }
         } else if (event.kind === 7) {
           // Fetch the liked video and add to feed if not already present
           const videoId = event.tags.find(t => t[0] === 'e')?.[1];
           if (videoId) {
             const videoEvent = await this.pool.querySync(RELAYS, { ids: [videoId], kinds: [VIDEO_KIND] });
             if (videoEvent.length > 0) {
               const videoData = this.parseVideoEvent(videoEvent[0] as VideoEvent);
               onVideo(videoData); // Will dedupe in caller
             }
           }
         }
       },
       oneose: () => console.log('✅ Personalized feed loaded')
     });
   }).catch(err => {
     console.error('Failed to load followed for personalized feed:', err);
     // Fallback to global feed
     this.videoSub = this.pool.subscribeMany(RELAYS, [{ kinds: [VIDEO_KIND], limit: 20 }], {
       onevent: (event) => {
         const videoData = this.parseVideoEvent(event as VideoEvent);
         const uploaderRep = this.reputationManager.getReputationScore(event.pubkey);
         if (!this.moderationSystem.shouldHideVideo(uploaderRep)) {
           onVideo(videoData);
         }
       }
     });
   });
 }

 private async getFollowedPubkeys(): Promise<string[]> {
   await this.ensureInitialized();
   const events = await this.pool.querySync(RELAYS, {
     kinds: [3],
     authors: [this.publicKey!],
     limit: 1
   });
   if (events.length === 0) return [];
   return events[0].tags
     .filter(t => t[0] === 'p')
     .map(t => t[1]);
 }
  public unsubscribeFromVideos() {
    if (this.videoSub) {
      this.videoSub.close();
      this.videoSub = null;
    }
  }

  public async publishVideo(magnetURI: string, title: string, summary: string, hash: string, thumbnail?: string, cid?: string) {

    await this.ensureInitialized();
    
    console.log('📤 Publishing video to Nostr:', {
      title,
      summary,
      magnetURI: magnetURI.substring(0, 50) + '...',
      hash: hash.substring(0, 16) + '...', 
      cid 
    });

    const event: UnsignedEvent = {
      kind: VIDEO_KIND,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey!,
      tags: [
        ['d', title],
        ['magnet', magnetURI],
        ['title', title],
        ['summary', summary],
        ['hash', hash],
        ...(thumbnail ? [['thumbnail', thumbnail]] : []),
        ...(cid ? [['cid', cid]] : []), // Phase 3: Add CID tag for IPFS fallback
      ],
      content: `${title} - ${summary}`,
    };
    
    const toastId = toast.loading(`Mining Proof of Work (difficulty ${POW_DIFFICULTY})...`);
    console.time('⛏️ PoW Mining');
    
    const minedEvent = minePow(event, POW_DIFFICULTY);
    console.timeEnd('⛏️ PoW Mining');
    
    toast.dismiss(toastId);
    toast.loading('Signing and publishing...');

    const signedEvent = await this.signEvent(minedEvent);
    
    await this.pool.publish(RELAYS, signedEvent);
    
    toast.success('Published!');
    
    console.log('✅ Published video event:', signedEvent);
    
    return signedEvent;
  }

  public async likeVideo(video: VideoData) {
    await this.ensureInitialized();
    
    const isLiked = this.likedVideos.has(video.id);
    
    if (isLiked) {
      this.likedVideos.delete(video.id);
      toast('💔 Unliked');
      return false;
    } else {
      this.likedVideos.add(video.id);
      
      let event: UnsignedEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: this.publicKey!,
        tags: [
          ['e', video.id],
          ['p', video.author],
        ],
        content: '❤️',
      };

      event = minePow(event, POW_DIFFICULTY);

      const signedEvent = await this.signEvent(event);
      await this.pool.publish(RELAYS, signedEvent);
      
      this.reputationManager.recordLike(video.author, this.publicKey!);
      
      toast('❤️ Liked!');
      return true;
    }
  }

  private parseVideoEvent(event: VideoEvent): VideoData {
    const findTag = (name: string) => {
      const tag = event.tags.find((t: string[]) => t[0] === name)?.[1] || '';
      return tag;
    };
    
    return {
      id: event.id!,
      author: event.pubkey,
      createdAt: event.created_at,
      thumbnail: findTag('thumbnail'),
      magnetURI: findTag('magnet'),
      title: findTag('title'),
      summary: findTag('summary'),
      hash: findTag('hash'),
      cid: findTag('cid'), // Phase 3: Parse CID for fallback
      hashtags: event.tags.filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1]),
    };
  }
  
  private userVideosCache = new Map<string, VideoData[]>();

  public async getUserVideos(pubkey: string): Promise<VideoData[]> {
    if (this.userVideosCache.has(pubkey)) {
      return this.userVideosCache.get(pubkey)!;
    }

    const events = await this.pool.querySync(RELAYS, {
      kinds: [VIDEO_KIND],
      authors: [pubkey],
      limit: 100
    });
    
    const videos = events
      .map(event => this.parseVideoEvent(event as VideoEvent))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    this.userVideosCache.set(pubkey, videos);
    
    return videos;
  }

  public async getUserStats(pubkey: string): Promise<{
    following: number;
    followers: number;
    likes: number;
  }> {
    await this.ensureInitialized();
    
    const followingEvents = await this.pool.querySync(RELAYS, {
      kinds: [3],
      authors: [pubkey],
      limit: 1
    });
    
    let followingCount = 0;
    if (followingEvents.length > 0) {
      followingCount = followingEvents[0].tags.filter(t => t[0] === 'p').length;
    }
    
    const followerEvents = await this.pool.querySync(RELAYS, {
      kinds: [3],
      '#p': [pubkey],
      limit: 500
    });
    
    const userVideos = await this.getUserVideos(pubkey);
    const videoIds = userVideos.map(v => v.id);
    
    let totalLikes = 0;
    if (videoIds.length > 0) {
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
    
    return {
      following: followingCount,
      followers: followerEvents.length,
      likes: totalLikes
    };
  }

  public async follow(pubkey: string): Promise<void> {
    await this.ensureInitialized();
    
    const events = await this.pool.querySync(RELAYS, {
      kinds: [3],
      authors: [this.publicKey!],
      limit: 1
    });
    
    let tags: string[][] = [];
    if (events.length > 0) {
      tags = events[0].tags.filter(t => t[0] === 'p');
    }
    
    if (!tags.some(t => t[1] === pubkey)) {
      tags.push(['p', pubkey]);
    }
    
    const event: UnsignedEvent = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey!,
      tags,
      content: ''
    };
    
    const signedEvent = await this.signEvent(event);
    await this.pool.publish(RELAYS, signedEvent);
  }

  public async unfollow(pubkey: string): Promise<void> {
    await this.ensureInitialized();
    
    const events = await this.pool.querySync(RELAYS, {
      kinds: [3],
      authors: [this.publicKey!],
      limit: 1
    });
    
    if (events.length === 0) return;
    
    const tags = events[0].tags.filter(t => !(t[0] === 'p' && t[1] === pubkey));
    
    const event: UnsignedEvent = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey!,
      tags,
      content: ''
    };
    
    const signedEvent = await this.signEvent(event);
    await this.pool.publish(RELAYS, signedEvent);
  }

  public async isFollowing(pubkey: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const events = await this.pool.querySync(RELAYS, {
      kinds: [3],
      authors: [this.publicKey!],
      limit: 1
    });
    
    if (events.length === 0) return false;
    
    return events[0].tags.some(t => t[0] === 'p' && t[1] === pubkey);
  }

  public async zapUser(targetPubkey: string, lnurl: string, amountSats: number = 21): Promise<void> {
    await this.ensureInitialized();
    if (!this.usingExtension) {
      toast.error("A NIP-07 extension is required to send a Zap.");
      throw new Error("NIP-07 extension required for zapping");
    }

    try {
      const zapEvent = await this.extension.zap(targetPubkey, amountSats * 1000, lnurl);
      if (zapEvent) {
        toast.success(`⚡ Zap of ${amountSats} sats sent!`);
        console.log('✅ Zap successful, event published by extension:', zapEvent);
      } else {
        toast.error('Zap was cancelled or failed in the extension.');
      }
    } catch (e: any) {
      console.error("❌ Zap failed:", e);
      toast.error(`Zap failed: ${e.message}`);
      throw e;
    }
  }


  public async getLikedVideos(): Promise<VideoData[]> {
    await this.ensureInitialized();
    
    const likeEvents = await this.pool.querySync(RELAYS, {
      kinds: [7],
      authors: [this.publicKey!],
      limit: 100
    });
    
    const videoIds = likeEvents
      .map(e => e.tags.find(t => t[0] === 'e')?.[1])
      .filter(Boolean) as string[];
    
    if (videoIds.length === 0) return [];
    
    const videoEvents = await this.pool.querySync(RELAYS, {
      kinds: [VIDEO_KIND],
      ids: videoIds
    });
    
    return videoEvents
      .map(event => this.parseVideoEvent(event as VideoEvent))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public clearVideoCache(pubkey?: string): void {
    if (pubkey) {
      this.userVideosCache.delete(pubkey);
    } else {
      this.userVideosCache.clear();
    }
  }
}

export const nostrClient = new NostrClient();
