# Reels Aggregator

A starter full-stack short-video feed that combines YouTube Shorts, Instagram Reels, and configurable Apify actors for Moj, TikTok, Facebook Reels, plus placeholders for Josh, Roposo, and Triller (no verified Apify Actor exists for those three as of 2026-09-24).

## Folder structure

```text
reels-aggregator-app/
├── .env
├── .env.example
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── routes/videos.ts
│       ├── services/
│       │   ├── youtube.ts
│       │   ├── instagram.ts
│       │   └── apify.ts
│       └── utils/
│           ├── cache.ts
│           └── config.ts
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
│       ├── components/VideoFeed.tsx
│       └── services/
│           ├── api.ts
│           └── types.ts
└── README.md
```

## Prerequisites

- Node.js 18.18 or newer
- npm
- API credentials for the providers you want to enable

## 1. Configure the backend

The real environment file stays at the project root: `C:\Users\Asus\OneDrive\Desktop\Showing_Videos\.env`. The backend loads that file directly; it is not copied or moved into `backend`. The safe template is `C:\Users\Asus\OneDrive\Desktop\Showing_Videos\.env.example`. Keep both files local and never commit the real `.env`. Configure:

- `YOUTUBE_API_KEY` or `YOUTUBE_ACCESS_TOKEN`: use a normal YouTube Data API v3 key or a valid OAuth 2 access token. The current pasted YouTube value was tested and returned `401 Invalid Credentials`, so replace it before expecting YouTube results.
- `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID`: intentionally blank for now.
- `APIFY_TOKEN`: your Apify token.
- `APIFY_MOJ_ACTOR_ID=qgQZ7HLYWPgV7FM4I`: the verified public Actor `ribtools/moj-scraper` from `https://apify.com/ribtools/moj-scraper`.
- `APIFY_MOJ_INPUT_JSON`: the verified Actor input format, currently `{"profiles":[{"profile":"moj","maxVideos":10}]}`.
- `APIFY_JOSH_ACTOR_ID`, `APIFY_ROPOSO_ACTOR_ID`, and `APIFY_TRILLER_ACTOR_ID`: intentionally blank. Searched Apify Store on 2026-09-24 (`/v2/store?search=josh|roposo|triller|chingari|mx takatak`): 0 relevant hits, only unrelated Apple-App-Store/real-estate/Rotten-Tomatoes results. Leave blank until a verified Actor appears; blank sources are skipped independently.
- `APIFY_JOSH_INPUT_JSON`, `APIFY_ROPOSO_INPUT_JSON`, and `APIFY_TRILLER_INPUT_JSON`: optional Actor-specific input payloads. Each selected Actor may require a different schema.
- `APIFY_TIKTOK_ACTOR_ID=clockworks/tiktok-scraper` (`GdWCkxBtKWOsKjdch`, 291k users): verified TikTok actor. Input e.g. `{"hashtags":["fyp"],"resultsPerPage":10,"profileScrapeSections":["videos"],"profileSorting":"latest"}`.
- `APIFY_FACEBOOK_ACTOR_ID=apify/facebook-reels-scraper` (`5CvjfVGyTzrrG3sWx`, official, 7.4k users): verified Facebook Reels actor. Input e.g. `{"startUrls":[{"url":"https://www.facebook.com/9GAGCute"}],"resultsLimit":10}`.

A real Apify Moj test succeeded with one profile and returned a direct MP4 `video_url`, thumbnail, caption, timestamp, and author metadata.

Install and run the backend:

```bash
cd backend
npm install
npm run dev
```

The API starts at `http://localhost:4000`.

Useful checks:

```bash
curl http://localhost:4000/health
curl "http://localhost:4000/api/videos?limit=10"
curl "http://localhost:4000/api/videos?source=youtube&limit=5"
```

`/api/videos` returns normalized items with `id`, `source`, `title`, `videoUrl`, optional metadata, and per-source status information. Provider calls run in parallel and provider failures are reported without discarding successful sources.

## 2. Configure and run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. To use a different backend URL, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

The feed uses a full-viewport vertical card layout. Native video cards autoplay while sufficiently visible and pause when they leave the viewport. YouTube uses its privacy-enhanced embed because the YouTube Data API supplies metadata and watch URLs, not a downloadable media stream. TikTok uses `tiktok.com/embed/v2/<id>` and Facebook uses the video plugin embed; both render as iframes while direct MP4 sources (e.g. Moj) use native `<video>`. The mute button controls native video elements and the YouTube embed URL.

## Optional cache

The starter uses a small in-memory TTL cache (`CACHE_TTL_SECONDS`, default 60 seconds), which is enough for development and a single backend process. For production, replace `backend/src/utils/cache.ts` with Redis, and optionally persist normalized results in MongoDB. A shared cache also makes multiple backend instances consistent.

## Production build

```bash
cd backend
npm run build
npm start

cd ../frontend
npm run build
npm run preview
```

Deploy the backend behind HTTPS and set `FRONTEND_ORIGIN` to the deployed frontend origin. Put the frontend build behind a static host/CDN. For real deployment, add authentication/rate limiting around provider endpoints, validate allowed CORS origins, and review each platform's terms, API permissions, hotlink rules, and content-storage requirements before redistributing media URLs.

## Why this stack

- **Node.js + Express + TypeScript:** Node's event-driven, asynchronous I/O fits network-bound API calls. Express keeps the HTTP layer small, while TypeScript catches provider response and route mistakes at build time.
- **nodemon + TypeScript:** nodemon restarts the backend during local development, while TypeScript catches provider response and route mistakes at build time.
- **React + Vite + TypeScript:** React keeps feed cards composable, and Vite gives fast startup and optimized production bundles. Vite is lighter and more modern than CRA.
- **Parallel provider adapters:** Each integration is isolated behind a service function, making providers independently configurable, testable, and replaceable.
- **Normalized API response:** The frontend does not need to know provider-specific response shapes. Provider status information also makes missing credentials and remote failures easy to diagnose.
- **TTL cache:** Provider APIs and scrapers are relatively expensive; caching reduces latency, rate-limit pressure, and unnecessary Actor runs.
