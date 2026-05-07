import { useState, useEffect } from 'react';
import { api } from '../api';
import './MySubmissions.css';

function getYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/vi\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export default function MySubmissions({ username, onRemove }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState(null);

  const loadSubmissions = async () => {
    if (!username) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.getMySubmissions(username);
      setSubmissions(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, [username]);

  const handleRemove = async (subId) => {
    setError('');
    try {
      await api.removeSubmission(subId, username);
      await loadSubmissions();
      if (onRemove) onRemove();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!username) {
    return (
      <div className="my-submissions">
        <h2>📋 My Submissions</h2>
        <div className="empty-state">Please enter your name to see your submissions.</div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="my-submissions">
      <h2>📋 My Submissions</h2>
      <p className="sub-hint">You have submitted <strong>{submissions.length}/2</strong> songs.</p>

      {error && <div className="error-msg">{error}</div>}

      {submissions.length === 0 ? (
        <div className="empty-state">
          You haven't submitted any songs yet. Go to Browse Songs to pick your entries!
        </div>
      ) : (
        <div className="my-sub-list">
          {submissions.map((sub) => (
            <div key={sub.id} className="my-sub-card">
              {sub.youtube_url && (
                <div className="my-sub-video-area">
                  {playingId === sub.id ? (
                    <div className="my-sub-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${getYoutubeId(sub.youtube_url)}?autoplay=1`}
                        title={sub.song}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                      <button className="close-video" onClick={() => setPlayingId(null)}>✕</button>
                    </div>
                  ) : (
                    <div className="my-sub-thumbnail" onClick={() => setPlayingId(sub.id)}>
                      <img
                        src={getYoutubeThumbnail(sub.youtube_url)}
                        alt={sub.song}
                      />
                      <span className="play-icon">▶</span>
                    </div>
                  )}
                </div>
              )}
              <div className="my-sub-info">
                <div className="my-sub-song">{sub.song}</div>
                <div className="my-sub-meta">{sub.artist} · {sub.country} · {sub.year}</div>
              </div>
              <button className="remove-btn" onClick={() => handleRemove(sub.id)}>
                ✕ Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
