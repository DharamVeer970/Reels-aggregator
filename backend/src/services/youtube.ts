import type { VideoItem } from '../types.js';
import { cleanText, isConfigured } from '../utils/config.js';

interface YouTubeSearchItem {
  id?: { videoId?: string };
}
interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
}
interface YouTubeVideoItem {
  id: string;
  snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string };
  contentDetails?: { duration?: string };
}

const API_ROOT = 'https://www.googleapis.com/youtube/v3';

export async function fetchYouTubeShorts(limit: number): Promise<VideoItem[]> {
  const configuredToken = process.env.YOUTUBE_ACCESS_TOKEN?.trim();
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || (configuredToken?.startsWith('AIza') ? configuredToken : undefined);
  const accessToken = configuredToken?.startsWith('AIza') ? undefined : configuredToken;
  if (!isConfigured(apiKey) && !isConfigured(accessToken)) return [];
  const authHeaders: Record<string, string> = {};
  if (isConfigured(accessToken)) {
    authHeaders.Authorization = `Bearer ${accessToken}`;
  }
  const authParams: Record<string, string> = {};
  if (isConfigured(apiKey)) {
    authParams.key = apiKey;
  }

  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < limit) {
    const searchParams = new URLSearchParams({
      part: 'id', type: 'video', videoDuration: 'short', order: 'date',
      maxResults: String(Math.min(limit - ids.length, 50)), q: process.env.YOUTUBE_QUERY || 'shorts', ...authParams,
    });
    if (pageToken) searchParams.set('pageToken', pageToken);
    const searchResponse = await fetch(`${API_ROOT}/search?${searchParams}`, { headers: authHeaders });
    if (!searchResponse.ok) {
      if (searchResponse.status === 401) throw new Error('YouTube authentication failed (401). Replace YOUTUBE_ACCESS_TOKEN or configure YOUTUBE_API_KEY.');
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }
    const search = await searchResponse.json() as YouTubeSearchResponse;
    ids.push(...(search.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id)));
    pageToken = search.nextPageToken;
    if (!pageToken || !(search.items?.length)) break;
  }
  if (!ids.length) return [];

  const detailItems: YouTubeVideoItem[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const detailsParams = new URLSearchParams({ part: 'snippet,contentDetails', id: ids.slice(index, index + 50).join(','), ...authParams });
    const detailsResponse = await fetch(`${API_ROOT}/videos?${detailsParams}`, { headers: authHeaders });
    if (!detailsResponse.ok) throw new Error(`YouTube details failed: ${detailsResponse.status}`);
    const details = await detailsResponse.json() as { items?: YouTubeVideoItem[] };
    detailItems.push(...(details.items ?? []));
  }

  return detailItems.map((video) => ({
    id: video.id,
    source: 'youtube' as const,
    title: cleanText(video.snippet?.title, 'YouTube Short'),
    description: video.snippet?.description,
    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
    permalink: `https://www.youtube.com/watch?v=${video.id}`,
    author: video.snippet?.channelTitle,
    publishedAt: video.snippet?.publishedAt,
    duration: parseDuration(video.contentDetails?.duration),
  }));
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(value);
  if (!match) return undefined;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
