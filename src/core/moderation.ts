// src/core/moderation.ts
import { finalizeEvent, UnsignedEvent, SimplePool } from 'nostr-tools';
import { minePow } from 'nostr-tools/nip13'; // NEW: Import for PoW

const REPORT_KIND = 1984;
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];
const REPORT_POW_DIFFICULTY = 12; // NEW: PoW difficulty for reports
const VELOCITY_THRESHOLD_REPORTS = 5; // NEW: Min reports for velocity check
const VELOCITY_TIME_WINDOW = 300; // NEW: 5min window in seconds
const HIDE_THRESHOLD = 0.35; // NEW: Reputation threshold for hiding

export type ReportReason = 'spam' | 'nsfw' | 'illegal' | 'harassment' | 'other';

export interface Report {
  reporter: string;
  targetEvent: string;
  targetPubkey: string;
  reason: ReportReason;
  timestamp: number;
}

export class ModerationSystem {
  private pool = new SimplePool();
  private secretKey: Uint8Array;
  private publicKey: string;
  
  
  constructor(secretKey: Uint8Array, publicKey: string) {
    this.secretKey = secretKey;
    this.publicKey = publicKey;
  }
  
  // Add PoW mining before signing
  async reportVideo(
    videoEventId: string, 
    videoPubkey: string, 
    reason: ReportReason,
    comment?: string
  ): Promise<void> {
    const event: UnsignedEvent = {
      kind: REPORT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.publicKey,
      tags: [
        ['e', videoEventId, 'report'],
        ['p', videoPubkey],
        ['reason', reason],
      ],
      content: comment || `Reported for: ${reason}`,
    };
    
    if (comment) {
      event.tags.push(['comment', comment]);
    }
    
    // Mine PoW to deter spam reports
    console.log(`⛏️ Mining PoW for report (diff ${REPORT_POW_DIFFICULTY})...`);
    const minedEvent = minePow(event, REPORT_POW_DIFFICULTY);
    
    const signedEvent = finalizeEvent(minedEvent, this.secretKey);
    await this.pool.publish(RELAYS, signedEvent);
    
  }
  
  // Calculate velocity multiplier based on recent report surge
  async calculateVelocityPenalty(videoEventId: string): Promise<number> {
    // Query recent reports (limit to small number for "recent")
    const reports = await this.pool.querySync(RELAYS, {
      kinds: [REPORT_KIND],
      '#e': [videoEventId],
      limit: 10 // Small fixed number for recent checks
    });
    
    if (reports.length < VELOCITY_THRESHOLD_REPORTS) {
      return 1.0; // No surge
    }
    
    // Sort by created_at to find time delta
    const sortedReports = reports.sort((a, b) => a.created_at - b.created_at);
    const timeDelta = sortedReports[sortedReports.length - 1].created_at - sortedReports[0].created_at;
    
    if (timeDelta <= VELOCITY_TIME_WINDOW) {
      console.log(`🚨 Velocity surge detected for ${videoEventId.slice(0,10)}... (${reports.length} reports in ${timeDelta}s)`);
      return 3.0; // High penalty for rapid reports
    }
    
    return 1.0; // Normal
  }
  
  // Simplified to only check reputation threshold (remove reportCount param/logic)
  shouldHideVideo(uploaderReputation: number): boolean {
    return uploaderReputation < HIDE_THRESHOLD;
  }
  
}
