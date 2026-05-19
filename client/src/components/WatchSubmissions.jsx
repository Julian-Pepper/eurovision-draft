import { useState, useEffect } from 'react';
import { api } from '../api';
import './WatchSubmissions.css';

function getYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/vi\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WatchSubmissions() {
  const [state, setState] = useState('closed');
  const [submissions, setSubmissions] = useState([]);
  const [submissionCount, setSubmissionCount] = useState(null);
  const [submitters, setSubmitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  // Admin controls
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    setLoading(true);
    try {
      const [data, countData, submittersData] = await Promise.all([
        api.getWatchingState(),
        api.getWatchingCount(),
        api.getWatchingSubmitters(),
      ]);
      setState(data.state);
      setSubmissionCount(countData.count);
      setSubmitters(submittersData);
      if (data.state === 'open') {
        const subs = await api.getWatchingSubmissions();
        setSubmissions(shuffleArray(subs));
      }
    } catch (e) {
      // state might just be closed
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.verifyAdmin(adminPw);
      setIsAdmin(true);
    } catch (e) {
      setError('Invalid password');
    }
  };

  const handleToggleState = async () => {
    setError('');
    try {
      const newState = state === 'open' ? 'closed' : 'open';
      await api.setWatchingState(newState, adminPw);
      setState(newState);
      if (newState === 'open') {
        const subs = await api.getWatchingSubmissions();
        setSubmissions(shuffleArray(subs));
        setCurrentIndex(0);
        setAutoplay(false);
      } else {
        setSubmissions([]);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="watch-submissions">
      <div className="watch-header">
        <h2>📺 Watch All Submissions</h2>

        {/* Admin panel toggle */}
        <div className="watch-admin-wrap">
          <button className="admin-toggle" onClick={() => setShowAdmin(!showAdmin)}>⚙️</button>
          {showAdmin && (
          <div className="admin-panel">
            {!isAdmin ? (
              <form onSubmit={handleAdminLogin} className="admin-form">
                <input
                  type="password"
                  placeholder="Admin password"
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                />
                <button type="submit">Login</button>
              </form>
            ) : (
              <div className="admin-controls">
                <span className="admin-badge">🔑 Admin</span>
                <button className="admin-action-btn" onClick={handleToggleState}>
                  {state === 'open' ? '🔒 Close Watching' : '🔓 Open Watching'}
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {state === 'closed' ? (
        <div className="watch-closed">
          <div className="lock-icon">🔒</div>
          <h3>Watching is not open yet</h3>
          <p>The admin will open the watch party when it’s time to listen to all submissions together.</p>
          {submissionCount !== null && (
            <p className="watch-count-preview">{submissionCount} song{submissionCount !== 1 ? 's' : ''} added so far</p>
          )}
          {isAdmin && submitters.length > 0 && (
            <div className="watch-submitters">
              <h4>Who’s in</h4>
              <ul className="submitters-list">
                {submitters.map(s => (
                  <li key={s.username} className="submitter-item">
                    <span className="submitter-name">{s.username}</span>
                    <span className="submitter-songs">{s.song_count} song{s.song_count !== 1 ? 's' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : submissions.length === 0 ? (
        <div className="watch-closed">
          <p>No submissions yet.</p>
        </div>
      ) : (
        <>
          <div className="watch-progress">
            Song {currentIndex + 1} of {submissions.length}
          </div>
          {(() => {
            const sub = submissions[currentIndex];
            return (
              <div className="watch-card watch-card-single">
                <div className="watch-video-area">
                  {autoplay ? (
                    <div className="watch-embed">
                      <iframe
                        key={sub.id}
                        src={`https://www.youtube.com/embed/${getYoutubeId(sub.youtube_url)}?autoplay=1`}
                        title={sub.song}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="watch-thumbnail" onClick={() => setAutoplay(true)}>
                      <img
                        src={getYoutubeThumbnail(sub.youtube_url)}
                        alt={sub.song}
                      />
                      <span className="play-icon">▶</span>
                    </div>
                  )}
                </div>
                <div className="watch-info">
                  <div className="watch-song">{sub.song}</div>
                  <div className="watch-meta">{sub.artist} · {sub.country} · {sub.year}</div>
                </div>
              </div>
            );
          })()}
          <div className="watch-nav">
            <button
              className="watch-nav-btn"
              disabled={currentIndex === 0}
              onClick={() => { setCurrentIndex(currentIndex - 1); setAutoplay(false); }}
            >
              ← Previous
            </button>
            <button
              className="watch-nav-btn watch-nav-next"
              disabled={currentIndex >= submissions.length - 1}
              onClick={() => { setCurrentIndex(currentIndex + 1); setAutoplay(false); }}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
