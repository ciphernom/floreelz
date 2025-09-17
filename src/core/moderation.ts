// src/core/moderation.ts
export const REPORT_KIND = 1984;
export const REPORT_POW_DIFFICULTY = 12;
export const VELOCITY_THRESHOLD_REPORTS = 5; // Min reports for velocity check
export const VELOCITY_TIME_WINDOW = 300;     // 5min window in seconds
export const HIDE_THRESHOLD = 0.35;          // Reputation threshold for hiding

export type ReportReason =
  | 'spam'
  | 'nsfw'
  | 'illegal'
  | 'harassment'
  | 'other';
 

export class ModerationSystem {
  shouldHideVideo(uploaderReputation: number): boolean {
    return uploaderReputation < HIDE_THRESHOLD;
  }
}
