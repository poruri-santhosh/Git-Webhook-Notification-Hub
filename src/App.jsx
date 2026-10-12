import { useCallback, useEffect, useState } from "react";

function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(seconds) < 60) return formatter.format(-seconds, "second");
  if (Math.abs(seconds) < 3600)
    return formatter.format(-Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400)
    return formatter.format(-Math.round(seconds / 3600), "hour");
  return formatter.format(-Math.round(seconds / 86400), "day");
}

export default function App() {
  const [commits, setCommits] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCommits = useCallback(async () => {
    try {
      const response = await fetch("/api/commits");
      if (!response.ok) throw new Error("Could not load commits.");
      const data = await response.json();
      setCommits(data.commits);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommits();
    const interval = window.setInterval(loadCommits, 15000);
    return () => window.clearInterval(interval);
  }, [loadCommits]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Commit Stream home">
          <span className="brand-mark" aria-hidden="true">
            {"</>"}
          </span>
          <span>commit<span className="brand-light">stream</span></span>
        </a>
        <span className="live-indicator">
          <span className="live-dot" />
          LIVE FEED
        </span>
      </header>

      <section className="intro">
        <p className="eyebrow">GITHUB WEBHOOK ACTIVITY</p>
        <h1>Every commit,<br /><span>in one stream.</span></h1>
        <p className="intro-copy">
          A live window into the work happening across your repositories.
        </p>
        <div className="feed-meta">
          <span className="feed-meta-dot" />
          <span>{commits.length} {commits.length === 1 ? "COMMIT" : "COMMITS"}</span>
          <span className="meta-divider">/</span>
          <span>REFRESHES EVERY 15 SECONDS</span>
        </div>
      </section>

      <section className="feed" aria-label="Recent commits" aria-live="polite">
        {loading ? (
          <div className="empty-state">
            <span className="loader" />
            <p>Connecting to the commit stream...</p>
          </div>
        ) : error ? (
          <div className="empty-state error-state">
            <span className="empty-icon" aria-hidden="true">!</span>
            <h2>Stream unavailable</h2>
            <p>{error} Check your API and database configuration, then try again.</p>
            <button className="retry-button" onClick={loadCommits}>Try again</button>
          </div>
        ) : commits.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">↳</span>
            <h2>Nothing in the stream yet</h2>
            <p>Push a commit to a repository connected to your GitHub webhook.</p>
          </div>
        ) : (
          commits.map((commit) => (
            <article className="commit-card" key={commit.sha}>
              <div className="card-topline">
                <span className="repo-label">
                  <span className="repo-icon" aria-hidden="true">◈</span>
                  {commit.repository}
                </span>
                <time dateTime={commit.timestamp} title={new Date(commit.timestamp).toLocaleString()}>
                  {timeAgo(commit.timestamp)}
                </time>
              </div>
              <p className="commit-message">{commit.message}</p>
              <div className="card-footer">
                <span className="author-avatar" aria-hidden="true">
                  {commit.author.slice(0, 1).toUpperCase()}
                </span>
                <span className="author-name">{commit.author}</span>
                {commit.url ? (
                  <a
                    className="commit-sha"
                    href={commit.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View commit ${commit.sha.slice(0, 7)}`}
                  >
                    {commit.sha.slice(0, 7)} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="commit-sha">{commit.sha.slice(0, 7)}</span>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <footer className="footer">
        <span>BUILT FOR THE MOMENT AFTER PUSH</span>
        <span>POWERED BY GITHUB WEBHOOKS</span>
      </footer>
    </main>
  );
}
