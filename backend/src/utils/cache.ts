import type { FeedResponse } from '../types.js';

let cache: { expiresAt: number; response: FeedResponse } | undefined;

export function readCache<T>(now = Date.now()): T | undefined {
  if (cache && cache.expiresAt > now) return cache.response as T;
  return undefined;
}

export function writeCache(response: FeedResponse, ttlSeconds: number): void {
  cache = { response, expiresAt: Date.now() + ttlSeconds * 1000 };
}
