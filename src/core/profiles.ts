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
  private secretKey: Uint8Array;
  public publicKey: string;
  
  constructor() {
    // Get the same keys from localStorage that nostr.ts uses
    const sk = localStorage.getItem('nostr_sk');
    if (sk) {
      this.secretKey = hexToBytes(sk);
      this.publicKey = getPublicKey(this.secretKey);
    } else {
      throw new Error('No Nostr keys found');
    }
  }
  
  public async getProfile(pubkey: string): Promise<UserProfile> {
    console.log('📝 Fetching profile for:', pubkey.substring(0, 10) + '...');
    
    // Check cache first
    if (this.profileCache.has(pubkey)) {
      console.log('✅ Profile found in cache');
      return this.profileCache.get(pubkey)!;
    }
    
    try {
      const events = await this.pool.querySync(RELAYS, {
        kinds: [0], // Kind 0 is for profile metadata
        authors: [pubkey],
        limit: 1
      });
      
      if (events.length === 0) {
        console.log('❌ No profile found, returning default');
        return { pubkey }; // Return minimal profile
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
      
      console.log('✅ Profile loaded:', profile.name || 'Unnamed');
      this.profileCache.set(pubkey, profile);
      return profile;
      
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return { pubkey }; // Return minimal profile on error
    }
  }
  
  public async updateMyProfile(updates: Partial<UserProfile>): Promise<void> {
    console.log('📤 Updating profile:', updates);
    
    // Get current profile to merge with updates
    const currentProfile = this.profileCache.get(this.publicKey) || { pubkey: this.publicKey };
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
      pubkey: this.publicKey,
      tags: [],
      content: JSON.stringify(content)
    };
    
    const signedEvent = finalizeEvent(event, this.secretKey);
    
    console.log('📡 Publishing profile update...');
    const results = await this.pool.publish(RELAYS, signedEvent);
    console.log('✅ Profile updated:', results);
    
    // Update cache
    this.profileCache.set(this.publicKey, {
      ...mergedProfile,
      pubkey: this.publicKey,
      created_at: event.created_at
    });
  }
  
  public getSecretKey(): string {
    return bytesToHex(this.secretKey);
  }
  
  public clearCache(): void {
    this.profileCache.clear();
    console.log('🧹 Profile cache cleared');
  }
  
  public getCachedProfile(pubkey: string): UserProfile | undefined {
    return this.profileCache.get(pubkey);
  }
}

// Create singleton instance
let profileManagerInstance: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!profileManagerInstance) {
    try {
      profileManagerInstance = new ProfileManager();
    } catch (error) {
      console.error('Failed to initialize ProfileManager:', error);
      throw error;
    }
  }
  return profileManagerInstance;
}
