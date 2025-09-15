import { Event } from 'nostr-tools';

// The kind for our specific video events
export const VIDEO_KIND = 36234;

// This is the structure of the video metadata we'll store in Nostr events
export interface VideoData {
  id: string; // The Nostr event ID
  author: string; // The author's public key
  createdAt: number; // Event creation timestamp
  magnetURI: string;
  title: string;
  summary: string;
  hashtags: string[];
}

// A Nostr event specifically for our video posts
export type VideoEvent = Event;
