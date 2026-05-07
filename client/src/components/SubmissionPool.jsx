import { useState, useEffect } from 'react';
import { api } from '../api';
import './SubmissionPool.css';

const EUROVISION_POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];

function buildVoterQueue(results, voteBreakdown) {
  const subDetails = {};
  results.forEach(r => { subDetails[r.id] = r; });
  const byVoter = {};
  Object.entries(voteBreakdown).forEach(([subId, votes]) => {
    votes.forEach(({ username, points }) => {
      if (!byVoter[username]) byVoter[username] = [];
      const sub = subDetails[Number(subId)];
      if (sub) byVoter[username].push({ ...sub, subId: Number(subId), points });
    });
  });
  return Object.entries(byVoter).map(([username, votes]) => ({
    username,
    votes: votes.sort((a, b) => a.points - b.points), // low → high, 12 pts last
  }));
}

function getYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/vi\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export default function VotingPanel({ username }) {
  const [votingState, setVotingState] = useState('closed');
  const [submissions, setSubmissions] = useState([]);
  const [myVotes, setMyVotes] = useState({}); // { submissionId: points }
  const [results, setResults] = useState(null);
  const [voteBreakdown, setVoteBreakdown] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealPhase, setRevealPhase] = useState('start'); // 'start' | 'revealing' | 'done'
  const [voterQueue, setVoterQueue] = useState([]);
  const [voterIdx, setVoterIdx] = useState(0);
  const [pointIdx, setPointIdx] = useState(-1);
  const [runningScores, setRunningScores] = useState({});
  const [lastScoredId, setLastScoredId] = useState(null);
  const [adminPw, setAdminPw] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { state } = await api.getVotingState();
      setVotingState(state);

      if (state === 'open' && username) {
        const data = await api.getVotingSubmissions(username);
        setSubmissions(data.submissions);
        setMyVotes(data.myVotes || {});
      } else if (state === 'revealed') {
        const data = await api.getResults();
        setResults(data.results);
        setVoteBreakdown(data.voteBreakdown || {});
        setVoterQueue(buildVoterQueue(data.results, data.voteBreakdown || {}));
        setRunningScores({});
        setRevealPhase('start');
        setVoterIdx(0);
        setPointIdx(-1);
      }
    } catch (e) {
      if (!e.message.includes('not open') && !e.message.includes('not been revealed')) {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [username]);

  const togglePoints = (subId, points) => {
    setMyVotes(prev => {
      const next = { ...prev };
      // If this submission already has these points, unassign
      if (next[subId] === points) {
        delete next[subId];
        return next;
      }
      // If these points are assigned elsewhere, unassign them first
      for (const [key, val] of Object.entries(next)) {
        if (val === points) delete next[key];
      }
      next[subId] = points;
      return next;
    });
  };

  const handleSaveVotes = async () => {
    setSaving(true);
    setError('');
    try {
      await api.submitVotes(username, myVotes);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
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

  const handleAdminAction = async (newState) => {
    setError('');
    try {
      await api.setVotingState(newState, adminPw);
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleStartReveal = () => {
    setRevealPhase('revealing');
    setVoterIdx(0);
    setPointIdx(-1);
  };

  const handleRevealPoint = () => {
    const voter = voterQueue[voterIdx];
    if (!voter) return;
    const nextIdx = pointIdx + 1;
    if (nextIdx >= voter.votes.length) return;
    const vote = voter.votes[nextIdx];
    setRunningScores(prev => ({
      ...prev,
      [vote.subId]: (prev[vote.subId] || 0) + vote.points,
    }));
    setLastScoredId(vote.subId);
    setTimeout(() => setLastScoredId(null), 1800);
    setPointIdx(nextIdx);
  };

  const handleNextVoter = () => {
    setVoterIdx(v => v + 1);
    setPointIdx(-1);
  };

  const handleFinish = () => setRevealPhase('done');

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="voting-panel">
      <div className="voting-header">
        <h2>🏆 Voting</h2>
        <div className={`state-badge state-${votingState}`}>
          {votingState === 'closed' && '🔒 Voting Closed'}
          {votingState === 'open' && '🗳️ Voting Open'}
          {votingState === 'revealed' && '🎉 Results Revealed'}
        </div>
        <div className="voting-admin-wrap">
          <button className="admin-toggle" onClick={() => setShowAdmin(!showAdmin)}>
            ⚙️
          </button>
          {showAdmin && (
            <div className="admin-panel">
              {!isAdmin ? (
                <form onSubmit={handleAdminLogin} style={{display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap'}}>
                  <input
                    type="password"
                    placeholder="Admin password"
                    value={adminPw}
                    onChange={(e) => setAdminPw(e.target.value)}
                  />
                  <div className="admin-buttons">
                    <button type="submit">Login</button>
                  </div>
                </form>
              ) : (
                <>
                  <span style={{fontSize:'0.8rem', color:'#a78bfa', fontWeight:600}}>🔑 Admin</span>
                  <div className="admin-buttons">
                    <button onClick={() => handleAdminAction('closed')}>🔒 Close</button>
                    <button onClick={() => handleAdminAction('open')}>🗳️ Open Voting</button>
                    <button onClick={() => handleAdminAction('revealed')}>🎉 Reveal Results</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* CLOSED STATE */}
      {votingState === 'closed' && (
        <div className="closed-msg">
          <div className="big-lock">🔒</div>
          <p>Voting hasn't started yet. The host will open voting when everyone has submitted their songs.</p>
        </div>
      )}

      {/* OPEN STATE — Eurovision-style point allocation */}
      {votingState === 'open' && username && (
        <div className="voting-open">
          <div className="voting-instructions">
            <p>Assign Eurovision points to your favourite submissions. Each point value can only be used once.</p>
            <div className="point-legend">
              {EUROVISION_POINTS.map(p => {
                const assigned = Object.values(myVotes).includes(p);
                return (
                  <span key={p} className={`point-chip ${assigned ? 'used' : 'available'}`}>
                    {p}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="voting-list">
            {submissions.map((sub) => (
              <div key={sub.id} className="voting-card">
                {sub.youtube_url && (
                  <div className="voting-video-area">
                    {playingId === sub.id ? (
                      <div className="voting-embed">
                        <iframe
                          src={`https://www.youtube.com/embed/${getYoutubeId(sub.youtube_url)}?autoplay=1`}
                          title={sub.song}
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                        />
                        <button className="close-video" onClick={() => setPlayingId(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="voting-thumbnail" onClick={() => setPlayingId(sub.id)}>
                        <img src={getYoutubeThumbnail(sub.youtube_url)} alt={sub.song} loading="lazy" />
                        <span className="play-icon">▶</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="voting-song-info">
                  <div className="voting-song-title">{sub.song}</div>
                  <div className="voting-song-meta">{sub.artist} · {sub.country} · {sub.year}</div>
                </div>
                <div className="point-buttons">
                  {EUROVISION_POINTS.map(p => {
                    const isSelected = myVotes[sub.id] === p;
                    const isUsedElsewhere = !isSelected && Object.values(myVotes).includes(p);
                    return (
                      <button
                        key={p}
                        className={`point-btn ${isSelected ? 'selected' : ''} ${isUsedElsewhere ? 'used' : ''}`}
                        onClick={() => togglePoints(sub.id, p)}
                        disabled={isUsedElsewhere}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                {myVotes[sub.id] && (
                  <div className="assigned-points">{myVotes[sub.id]} pts</div>
                )}
              </div>
            ))}
          </div>

          <button
            className="save-votes-btn"
            onClick={handleSaveVotes}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save My Votes'}
          </button>
        </div>
      )}

      {votingState === 'open' && !username && (
        <div className="closed-msg">
          <p>Please enter your name to vote.</p>
        </div>
      )}

      {/* REVEALED STATE — Eurovision jury reveal */}
      {votingState === 'revealed' && results && (() => {
        const leaderboard = [...results]
          .map(r => ({ ...r, currentTotal: runningScores[r.id] || 0 }))
          .sort((a, b) => b.currentTotal - a.currentTotal || a.song.localeCompare(b.song));
        const currentVoter = voterQueue[voterIdx];
        const currentPoints = currentVoter?.votes || [];
        const isLastPoint = pointIdx === currentPoints.length - 1;
        const isLastVoter = voterIdx === voterQueue.length - 1;
        return (
          <div className="results-panel">
            {revealPhase === 'start' && (
              <div className="reveal-start">
                <p>The votes are in! We have a valid result, take it away.</p>
                <p className="reveal-voter-count">{voterQueue.length} voter{voterQueue.length !== 1 ? 's' : ''} · {results.length} submissions</p>
                <button className="reveal-btn" onClick={handleStartReveal}>🎬 Begin the Reveal</button>
              </div>
            )}
            {(revealPhase === 'revealing' || revealPhase === 'done') && (
              <div className="eurovision-reveal">
                {revealPhase === 'revealing' && currentVoter && (
                  <div className="current-voter-panel">
                    <div className="voter-label">🌍 Now voting</div>
                    <div className="voter-name">{currentVoter.username}</div>
                    {pointIdx >= 0 && (
                      <div className="voter-points-row">
                        {currentPoints.map((v, i) => (
                          <span key={i} className={`voter-pt ${i < pointIdx ? 'pt-done' : i === pointIdx ? 'pt-current' : 'pt-pending'}`}>
                            {i <= pointIdx ? v.points : '·'}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="voter-actions">
                      {pointIdx === -1 && (
                        <button className="reveal-btn" onClick={handleRevealPoint}>
                          Reveal {currentVoter.username}'s votes →
                        </button>
                      )}
                      {pointIdx >= 0 && !isLastPoint && (
                        <button className="reveal-btn" onClick={handleRevealPoint}>
                          Next: {currentPoints[pointIdx + 1].points} pts →
                        </button>
                      )}
                      {pointIdx >= 0 && isLastPoint && !isLastVoter && (
                        <button className="reveal-btn" onClick={handleNextVoter}>
                          Next: {voterQueue[voterIdx + 1].username} →
                        </button>
                      )}
                      {pointIdx >= 0 && isLastPoint && isLastVoter && (
                        <button className="reveal-btn" onClick={handleFinish}>
                          🏆 Final Results!
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {revealPhase === 'done' && leaderboard[0] && (
                  <div className="winner-banner">
                    🏆 Winner: <strong>{leaderboard[0].song}</strong> by {leaderboard[0].artist} — {leaderboard[0].currentTotal} points!
                  </div>
                )}
                <div className="leaderboard">
                  {leaderboard.map((item, rank) => (
                    <div
                      key={item.id}
                      className={`leaderboard-row${rank === 0 && item.currentTotal > 0 ? ' lb-leader' : ''}${item.id === lastScoredId ? ' lb-just-scored' : ''}${rank === 0 && revealPhase === 'done' ? ' lb-winner' : ''}`}
                    >
                      <div className="lb-rank">{rank + 1}</div>
                      <div className="lb-info">
                        <div className="lb-song">{item.song}</div>
                        <div className="lb-meta">{item.artist} · {item.country} · {item.year}</div>
                      </div>
                      <div className="lb-score">{item.currentTotal > 0 ? item.currentTotal : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
