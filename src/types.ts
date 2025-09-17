import { Event } from 'nostr-tools';

export const VIDEO_KIND = 38234;

export interface VideoData {
  id: string;
  author: string;
  createdAt: number;
  magnetURI: string;
  title: string;
  summary: string;
  thumbnail?: string;
  hash?: string;
  hashtags: string[];
}

export type VideoEvent = Event;
