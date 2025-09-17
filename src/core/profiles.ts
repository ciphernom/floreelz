import { SimplePool, finalizeEvent, UnsignedEvent, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface UserProfile {
  pubkey: string;
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  created_at?: number;
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

class ProfileManager {
  private pool = new SimplePool();
  private profileCache = new Map<string, UserProfile>();
  private secretKey: Uint8Array | null = null;
  public publicKey: string | null = null;
  private usingExtension: boolean = false;
  private extension: any = null;
  
  constructor() {
    this.extension = typeof window !== 'undefined' ? (window as any).nostr : null;
    this.usingExtension = !!this.extension;

    if (!this.usingExtension) {
      const sk = localStorage.getItem('nostr_sk');
      if (sk) {
        this.secretKey = hexToBytes(sk);
        this.publicKey = getPublicKey(this.secretKey);
      } else {
        throw new Error('No Nostr keys found');
      }
    } else {
      this.publicKey = null;
      this.secretKey = null;
    }
  }
  
  private async ensureInitialized(): Promise<void> {
    if (this.publicKey) return;

    if (this.usingExtension) {
      this.publicKey = await this.extension.getPublicKey();
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

  public async getProfile(pubkey: string): Promise<UserProfile> {
    if (this.profileCache.has(pubkey)) {
      return this.profileCache.get(pubkey)!;
    }
    
    try {
      const events = await this.pool.querySync(RELAYS, {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      });
      
      if (events.length === 0) {
        const minimal: UserProfile = { pubkey };
        this.profileCache.set(pubkey, minimal);
        return minimal;
      }
      
      const profileEvent = events[0];
      const content = JSON.parse(profileEvent.content);
      
      const profile: UserProfile = {
        pubkey,
        name: content.name,
        about: content.about,
        picture: content.picture,
        banner: content.banner,
        nip05: content.nip05,
        lud06: content.lud06,
        lud16: content.lud16,
        created_at: profileEvent.created_at
      };
      
      this.profileCache.set(pubkey, profile);
      return profile;
      
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      const minimal: UserProfile = { pubkey };
      this.profileCache.set(pubkey, minimal);
      return minimal;
    }
  }
  
  public async updateMyProfile(updates: Partial<UserProfile>): Promise<void> {
    await this.ensureInitialized();
    
    const currentProfile = this.profileCache.get(this.publicKey!) || { pubkey: this.publicKey! };
    const mergedProfile = { ...currentProfile, ...updates };
    
    const content = {
      name: mergedProfile.name || '',
      about: mergedProfile.about || '',
      picture: mergedProfile.picture || '',
      banner: mergedProfile.banner || '',
      nip05: mergedProfile.nip05 || '',
      lud06: mergedProfile.lud06 || '',
      lud16: mergedProfile.lud16 || '',
    };
    
    const event: UnsignedEvent = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey!,
      tags: [],
      content: JSON.stringify(content)
    };
    
    const signedEvent = await this.signEvent(event);
    
    const results = await this.pool.publish(RELAYS, signedEvent);
    
    this.profileCache.set(this.publicKey!, {
      ...mergedProfile,
      pubkey: this.publicKey!,
      created_at: event.created_at
    });
    
    console.log('✅ Profile updated:', results);
  }
  
  public getSecretKey(): string {
    if (this.usingExtension) {
      throw new Error('Using NIP-07 extension');
    }
    return bytesToHex(this.secretKey!);
  }
  
  public clearCache(): void {
    this.profileCache.clear();
  }
  
  public getCachedProfile(pubkey: string): UserProfile | undefined {
    return this.profileCache.get(pubkey);
  }
}

let profileManagerInstance: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!profileManagerInstance) {
    profileManagerInstance = new ProfileManager();
  }
  return profileManagerInstance;
}
