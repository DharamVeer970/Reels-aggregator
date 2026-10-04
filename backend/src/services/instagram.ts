import type { VideoItem } from '../types.js';
import { cleanText, isConfigured } from '../utils/config.js';

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  username?: string;
  timestamp?: string;
}

export async function fetchInstagramReels(limit: number): Promise<VideoItem[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!isConfigured(token) || !isConfigured(userId)) return [];
  const apiVersion = process.env.INSTAGRAM_API_VERSION || 'v21.0';

  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,username,timestamp';
  const params = new URLSearchParams({ fields, limit: String(Math.min(limit, 100)), access_token: token });
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${userId}/media?${params}`);
  if (!response.ok) throw new Error(`Instagram media failed: ${response.status}`);
  const payload = await response.json() as { data?: InstagramMedia[] };

  return (payload.data ?? [])
    .filter((media) => media.media_type === 'VIDEO' && media.media_url)
    .map((media) => ({
      id: media.id,
      source: 'instagram' as const,
      title: cleanText(media.caption, 'Instagram Reel'),
      description: media.caption,
      videoUrl: media.media_url as string,
      thumbnailUrl: media.thumbnail_url,
      permalink: media.permalink,
      author: media.username,
      publishedAt: media.timestamp,
    }));
}
