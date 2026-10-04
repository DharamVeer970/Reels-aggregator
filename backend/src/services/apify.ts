import { ApifyClient } from 'apify-client';
import type { VideoItem, VideoSource } from '../types.js';
import { isConfigured } from '../utils/config.js';

const ACTOR_ENV: Record<Exclude<VideoSource, 'youtube' | 'instagram'>, string> = {
  moj: 'APIFY_MOJ_ACTOR_ID', josh: 'APIFY_JOSH_ACTOR_ID', roposo: 'APIFY_ROPOSO_ACTOR_ID', triller: 'APIFY_TRILLER_ACTOR_ID',
  tiktok: 'APIFY_TIKTOK_ACTOR_ID', facebook: 'APIFY_FACEBOOK_ACTOR_ID',
};
const INPUT_ENV: Record<Exclude<VideoSource, 'youtube' | 'instagram'>, string> = {
  moj: 'APIFY_MOJ_INPUT_JSON', josh: 'APIFY_JOSH_INPUT_JSON', roposo: 'APIFY_ROPOSO_INPUT_JSON', triller: 'APIFY_TRILLER_INPUT_JSON',
  tiktok: 'APIFY_TIKTOK_INPUT_JSON', facebook: 'APIFY_FACEBOOK_INPUT_JSON',
};
type ApifySource = keyof typeof ACTOR_ENV;
type RawItem = Record<string, unknown>;

export async function fetchApifyVideos(source: ApifySource, limit: number): Promise<VideoItem[]> {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env[ACTOR_ENV[source]];
  if (!isConfigured(token) || !isConfigured(actorId)) return [];

  const started = Date.now();
  console.log(`[apify:${source}] starting actor ${actorId}`);
  const client = new ApifyClient({ token });
  // log: null disables live streaming of the Actor's container logs to our console.
  // Without it, every run floods the terminal with "Pulling container image… / CheerioCrawler…" lines.
  const run = await client.actor(actorId).call(parseInput(process.env[INPUT_ENV[source]], source), { log: null });
  if (!run.defaultDatasetId) throw new Error(`Apify run did not return a dataset for ${source}`);
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  const items = dataset.items.flatMap((item: unknown) => normalizeApifyItem(item as RawItem, source, limit));
  console.log(`[apify:${source}] done: ${items.length} videos in ${((Date.now() - started) / 1000).toFixed(1)}s (run ${run.id}, status ${run.status})`);
  return items;
}

export function isApifySourceConfigured(source: ApifySource): boolean {
  return isConfigured(process.env.APIFY_TOKEN) && isConfigured(process.env[ACTOR_ENV[source]]);
}

function parseInput(value: string | undefined, source: ApifySource): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error(`Invalid JSON in ${INPUT_ENV[source]}`);
  }
}

function normalizeApifyItem(item: RawItem, source: ApifySource, limit: number): VideoItem[] {
  const videoUrl = getApifyVideoUrl(item, source);
  if (!videoUrl || !isVideoUrl(videoUrl, source)) return [];
  const author = item.author && typeof item.author === 'object' ? item.author as RawItem : undefined;
  const authorMeta = item.authorMeta && typeof item.authorMeta === 'object' ? item.authorMeta as RawItem : undefined;
  const caption = firstString(item, ['caption', 'description', 'text', 'title', 'name']) || firstString(authorMeta ?? {}, ['nickName', 'name']);
  const thumbnail = getApifyThumbnail(item);
  const permalink = getApifyPermalink(item, source, videoUrl);
  return [{
    id: getApifyId(item, source),
    source,
    title: caption || `${source} video`,
    description: firstString(item, ['caption', 'description', 'text']),
    videoUrl,
    thumbnailUrl: thumbnail,
    permalink,
    author: author ? firstString(author, ['handle', 'username', 'name']) : (firstString(authorMeta ?? {}, ['nickName', 'name']) || firstString(item, ['author', 'username', 'ownerUsername'])),
    publishedAt: firstString(item, ['created_at', 'publishedAt', 'published_at', 'timestamp', 'createTimeISO', 'time']),
    duration: getApifyDuration(item),
  }].slice(0, limit);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getApifyVideoUrl(item: RawItem, source: ApifySource): string | undefined {
  const direct = firstString(item, ['video_url', 'videoUrl', 'media_url', 'mediaUrl', 'downloadUrl', 'download_url', 'downloadAddr']);
  if (direct) return direct;
  const mediaUrls = item.mediaUrls;
  if (Array.isArray(mediaUrls)) {
    const first = mediaUrls.find((value): value is string => typeof value === 'string' && value.length > 0);
    if (first) return first;
  }
  const playback = item.playback_video;
  if (playback && typeof playback === 'object') {
    const video = playback as RawItem;
    const native = asString(video.browser_native_hd_url) || asString(video.browser_native_sd_url);
    if (native) return native;
  }
  if (source === 'tiktok') {
    return asString(item.webVideoUrl) || asString(item.url);
  }
  if (source === 'facebook') {
    return asString(item.shareable_url) || asString(item.topLevelReelUrl) || asString(item.topLevelUrl) || asString(item.url);
  }
  return asString(item.url);
}

function getApifyThumbnail(item: RawItem): string | undefined {
  const direct = firstString(item, ['thumbnail_url', 'thumbnailUrl', 'image_url', 'imageUrl', 'coverUrl', 'displayUrl']);
  if (direct) return direct;
  const videoMeta = item.videoMeta;
  if (videoMeta && typeof videoMeta === 'object') {
    const cover = asString((videoMeta as RawItem).coverUrl) || asString((videoMeta as RawItem).originalCoverUrl);
    if (cover) return cover;
  }
  const authorMeta = item.authorMeta;
  if (authorMeta && typeof authorMeta === 'object') {
    const avatar = asString((authorMeta as RawItem).avatar) || asString((authorMeta as RawItem).originalAvatarUrl);
    if (avatar) return avatar;
  }
  const preferred = item.preferred_thumbnail;
  if (preferred && typeof preferred === 'object') {
    const image = (preferred as RawItem).image;
    if (image && typeof image === 'object') {
      const uri = asString((image as RawItem).uri);
      if (uri) return uri;
    }
  }
  const playback = item.playback_video;
  if (playback && typeof playback === 'object') {
    const image = (playback as RawItem).image;
    if (image && typeof image === 'object') {
      const uri = asString((image as RawItem).uri);
      if (uri) return uri;
    }
  }
  return undefined;
}

function getApifyPermalink(item: RawItem, source: ApifySource, fallback: string): string | undefined {
  if (source === 'tiktok') return asString(item.webVideoUrl) || firstString(item, ['url', 'permalink', 'postUrl', 'post_url']) || fallback;
  if (source === 'facebook') return asString(item.shareable_url) || asString(item.topLevelReelUrl) || firstString(item, ['url', 'permalink']) || fallback;
  return firstString(item, ['url', 'permalink', 'postUrl', 'post_url']) || fallback;
}

function getApifyId(item: RawItem, source: ApifySource): string {
  const direct = firstString(item, ['id', 'shortcode', 'post_id', 'videoId']);
  if (direct) return direct;
  const permalink = getApifyPermalink(item, source, '');
  const match = permalink ? /(\d{6,})/.exec(permalink) : null;
  if (match) return match[1];
  return `${source}-${Date.now()}`;
}

function getApifyDuration(item: RawItem): number | undefined {
  const direct = numberValue(item.duration_seconds ?? item.duration ?? item.videoDuration);
  if (direct !== undefined) return direct;
  const videoMeta = item.videoMeta;
  if (videoMeta && typeof videoMeta === 'object') {
    const nested = numberValue((videoMeta as RawItem).duration);
    if (nested !== undefined) return nested;
  }
  const playback = item.playback_video;
  if (playback && typeof playback === 'object') {
    const seconds = numberValue((playback as RawItem).length_in_second);
    if (seconds !== undefined) return seconds;
  }
  return undefined;
}

function firstString(item: RawItem, keys: string[]): string | undefined {
  return keys.map((key) => item[key]).find((value): value is string => typeof value === 'string' && value.length > 0);
}

function isVideoUrl(value: string, source?: ApifySource): boolean {
  if (source === 'tiktok' || source === 'facebook') {
    return /^https?:\/\//i.test(value);
  }
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(value) || /\/(video|reel)\//i.test(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
