import type { FeedResponse } from './types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';

export async function getFeed(limit = 100): Promise<FeedResponse> {
  const response = await fetch(`${API_URL}/api/videos?limit=${limit}&fresh=1`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
  return response.json() as Promise<FeedResponse>;
}

export type { FeedResponse, VideoItem, VideoSource } from './types';

