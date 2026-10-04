import { useEffect, useMemo, useState } from 'react';
import VideoFeed from './components/VideoFeed';
import { getFeed, type FeedResponse, type VideoSource } from './services/api';
import './styles.css';

const sourceLabels: Record<VideoSource, string> = { youtube: 'YouTube', instagram: 'Instagram', moj: 'Moj', josh: 'Josh', roposo: 'Roposo', triller: 'Triller', tiktok: 'TikTok', facebook: 'Facebook' };

export default function App() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeSource, setActiveSource] = useState<'all' | VideoSource>('all');
  const [smartMix, setSmartMix] = useState(false);
  useEffect(() => { getFeed().then(setFeed).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load feed')); }, []);
  const sources = useMemo(() => [...new Set(feed?.items.map((video) => video.source) ?? [])], [feed]);
  const videos = useMemo(() => {
    const filtered = (feed?.items ?? []).filter((video) => {
      const haystack = `${video.title} ${video.description ?? ''} ${video.author ?? ''}`.toLowerCase();
      return (activeSource === 'all' || video.source === activeSource) && haystack.includes(query.toLowerCase());
    });
    return smartMix ? [...filtered].sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title)) : filtered;
  }, [activeSource, feed, query, smartMix]);
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">✦</span><span>loop<span className="brand-dot">.</span></span></div><div className="sidebar-copy"><span className="eyebrow">Your daily signal</span><h1>Find your<br /><em>next</em> favorite.</h1><p>One calm feed for the best short-form moments from everywhere.</p></div><div className="sidebar-note"><span className="status-dot" /> Live across {sources.length || 0} networks</div><div className="sidebar-footer"><span>Curated for you</span><span>⌘ K</span></div></aside>
    <main className="content"><header className="topbar"><div className="mobile-brand"><span className="brand-mark">✦</span> loop<span className="brand-dot">.</span></div><div className="search-wrap"><span className="search-icon" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your signal" aria-label="Search your signal" /><kbd>⌘ K</kbd></div><button className={`mix-button ${smartMix ? 'active' : ''}`} onClick={() => setSmartMix((current) => !current)}><span>✦</span>{smartMix ? 'Smart mix on' : 'Smart mix'}</button></header>
      <section className="feed-intro"><div><span className="eyebrow">Discover / {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span><h2>What’s moving you today?</h2></div>{feed && <span className="result-count">{videos.length} of {feed.items.length} moments</span>}</section>
      <nav className="filters" aria-label="Filter by source"><button className={activeSource === 'all' ? 'selected' : ''} onClick={() => setActiveSource('all')}>All moments</button>{sources.map((source) => <button key={source} className={activeSource === source ? 'selected' : ''} onClick={() => setActiveSource(source)}>{sourceLabels[source]}</button>)}</nav>
      {error && <p className="error">{error}</p>}{feed ? <VideoFeed videos={videos} /> : !error && <p className="loading">Tuning your feed<span>...</span></p>}
    </main>
  </div>;
}
