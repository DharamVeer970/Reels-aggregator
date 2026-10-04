import { Router } from 'express';
import type { FeedResponse, VideoSource } from '../types.js';
import { fetchYouTubeShorts } from '../services/youtube.js';
import { fetchInstagramReels } from '../services/instagram.js';
import { fetchApifyVideos, isApifySourceConfigured } from '../services/apify.js';
import { readCache, writeCache } from '../utils/cache.js';
import { parsePositiveInt } from '../utils/config.js';

export const videosRouter = Router();
const allSources: VideoSource[] = ['youtube', 'instagram', 'moj', 'josh', 'roposo', 'triller', 'tiktok', 'facebook'];

// In-flight dedup: React StrictMode (and two fast clicks) can fire identical
// /api/videos requests concurrently before the cache is written. Without this,
// each one starts its own paid Apify Actor runs. Concurrent identical requests
// now share a single fan-out.
const inflight = new Map<string, Promise<FeedResponse>>();

function isSourceConfigured(source: VideoSource): boolean {
  if (source === 'youtube') {
    return Boolean(process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_ACCESS_TOKEN);
  }
  if (source === 'instagram') {
    return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);
  }
  return isApifySourceConfigured(source);
}

async function fetchSourceItems(source: VideoSource, limit: number) {
  if (source === 'youtube') {
    return fetchYouTubeShorts(limit);
  }
  if (source === 'instagram') {
    return fetchInstagramReels(limit);
  }
  return fetchApifyVideos(source, limit);
}

videosRouter.get('/', async (request: import('express').Request, response: import('express').Response, next: import('express').NextFunction) => {
  try {
    const limit = parsePositiveInt(request.query.limit as string | undefined, 50, 100);
    const forceRefresh = request.query.refresh === '1' || request.query.fresh === '1';
    const requested = String(request.query.source || '').split(',').filter((source): source is VideoSource => allSources.includes(source as VideoSource));
    const sources = requested.length ? requested : allSources;
    const cached = readCache<FeedResponse>();
    if (cached && !requested.length && !forceRefresh) {
      console.log(`[videos] GET limit=${limit} sources=all -> cache hit (${cached.items.length} items)`);
      response.json({ ...cached, cached: true });
      return;
    }

    const key = `${limit}|${sources.join(',')}`;
    const pending = inflight.get(key);
    if (pending) {
      console.log(`[videos] GET limit=${limit} sources=${sources.join(',')} -> joining in-flight request`);
      response.json(await pending);
      return;
    }

    const started = Date.now();
    console.log(`[videos] GET limit=${limit} sources=${sources.join(',')}`);
    const task = (async (): Promise<FeedResponse> => {
      const results = await Promise.all(sources.map(async (source) => {
        if (!isSourceConfigured(source)) {
          return { source, status: 'skipped' as const, items: [], message: 'Provider is not configured' };
        }
        try {
          const items = await fetchSourceItems(source, limit);
          return { source, status: 'ok' as const, items };
        } catch (error) {
          return { source, status: 'error' as const, items: [], message: error instanceof Error ? error.message : 'Provider failed' };
        }
      }));
      const feed: FeedResponse = {
        items: uniqueVideos(results.flatMap((result) => result.items)).slice(0, limit),
        sources: results.map(({ items: _items, ...status }) => status), cached: false,
      };
      if (!requested.length) writeCache(feed, Number(process.env.CACHE_TTL_SECONDS || 60));
      const summary = results.map((result) => `${result.source}=${result.status}${result.status === 'ok' ? `(${result.items.length})` : result.message ? `(${result.message})` : ''}`).join(' ');
      console.log(`[videos] done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${summary} -> ${feed.items.length} items`);
      return feed;
    })();
    inflight.set(key, task);
    try {
      response.json(await task);
    } finally {
      inflight.delete(key);
    }
  } catch (error) { next(error); }
});

function uniqueVideos(items: FeedResponse['items']): FeedResponse['items'] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.id}:${item.permalink || item.videoUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
