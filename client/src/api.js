const API = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Songs catalog
  getSongs: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/songs?${qs}`);
  },
  getCountries: () => request('/songs/countries'),
  getYears: () => request('/songs/years'),

  // Submissions
  submitSong: (song_id, username) =>
    request('/submissions', {
      method: 'POST',
      body: JSON.stringify({ song_id, username }),
    }),
  getMySubmissions: (username) =>
    request(`/my-submissions/${encodeURIComponent(username)}`),
  removeSubmission: (id, username) =>
    request(`/submissions/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ username }),
    }),

  // Voting
  getVotingState: () => request('/voting/state'),
  setVotingState: (state, admin_password) =>
    request('/voting/state', {
      method: 'POST',
      body: JSON.stringify({ state, admin_password }),
    }),
  getVotingSubmissions: (username) => {
    const qs = username ? `?username=${encodeURIComponent(username)}` : '';
    return request(`/voting/submissions${qs}`);
  },
  submitVotes: (username, votes) =>
    request('/votes', {
      method: 'POST',
      body: JSON.stringify({ username, votes }),
    }),
  getUserVotes: (username) => request(`/votes/${encodeURIComponent(username)}`),

  // Results
  getResults: () => request('/results'),

  // Admin
  verifyAdmin: (admin_password) =>
    request('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ admin_password }),
    }),
  getAdminSubmissions: (admin_password) =>
    request('/admin/submissions', {
      method: 'POST',
      body: JSON.stringify({ admin_password }),
    }),

  // Watching
  getWatchingState: () => request('/watching/state'),
  setWatchingState: (state, admin_password) =>
    request('/watching/state', {
      method: 'POST',
      body: JSON.stringify({ state, admin_password }),
    }),
  getWatchingSubmissions: () => request('/watching/submissions'),
  getWatchingCount: () => request('/watching/count'),
  getWatchingSubmitters: () => request('/watching/submitters'),
};
