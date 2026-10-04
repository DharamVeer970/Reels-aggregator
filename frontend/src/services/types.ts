export type VideoSource = 'youtube' | 'instagram' | 'moj' | 'josh' | 'roposo' | 'triller' | 'tiktok' | 'facebook';

export interface VideoItem {
  id: string;
  source: VideoSource;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  permalink?: string;
  author?: string;
  publishedAt?: string;
  duration?: number;
}

export interface FeedResponse {
  items: VideoItem[];
  sources: Array<{ source: VideoSource; status: 'ok' | 'skipped' | 'error'; message?: string }>;
  cached: boolean;
}
