import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

async function init() {
  db = await getDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const router = express.Router();

  // Helper: run a SELECT and return all rows as objects
  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function queryOne(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  }

  function getSetting(key) {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
  }

  function setSetting(key, value) {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDb(db);
  }

  // ─── Songs ──────────────────────────────────────────────────────────────────

  router.get('/api/songs', (req, res) => {
    const { search, country, year, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push("(s.song LIKE ? OR s.artist LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (country) {
      conditions.push("s.country = ?");
      params.push(country);
    }
    if (year) {
      conditions.push("s.year = ?");
      params.push(Number(year));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    // Only show songs that have a YouTube URL, hide Israel
    const videoCondition = "s.youtube_url IS NOT NULL AND s.youtube_url != '' AND s.country != 'Israel'";
    const fullWhere = where ? `${where} AND ${videoCondition}` : `WHERE ${videoCondition}`;

    const countRow = queryOne(`SELECT COUNT(*) as total FROM songs s ${fullWhere}`, params);

    const songs = queryAll(`
      SELECT s.*
      FROM songs s
      ${fullWhere}
      ORDER BY s.year DESC, s.country ASC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    res.json({ songs, total: countRow.total, page: Number(page), limit: Number(limit) });
  });

  router.get('/api/songs/countries', (_req, res) => {
    const rows = queryAll('SELECT DISTINCT country FROM songs ORDER BY country');
    res.json(rows.map(r => r.country));
  });

  router.get('/api/songs/years', (_req, res) => {
    const rows = queryAll('SELECT DISTINCT year FROM songs ORDER BY year DESC');
    res.json(rows.map(r => r.year));
  });

  // ─── Submissions (anonymous) ───────────────────────────────────────────────

  // POST /api/submissions — submit a song (anonymous to others)
  router.post('/api/submissions', (req, res) => {
    const { song_id, username } = req.body;

    if (!song_id || !username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'song_id and username are required' });
    }

    const trimmedUsername = username.trim().substring(0, 50);

    // Check 2-song limit
    const userCount = queryOne('SELECT COUNT(*) as count FROM submissions WHERE username = ?', [trimmedUsername]);
    if (userCount.count >= 2) {
      return res.status(409).json({ error: 'You have already submitted 2 songs (maximum reached)' });
    }

    // Check song exists
    const song = queryOne('SELECT id FROM songs WHERE id = ?', [song_id]);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check not already submitted
    const existing = queryOne('SELECT id FROM submissions WHERE song_id = ?', [song_id]);
    if (existing) {
      return res.status(409).json({
        error: 'Sorry, someone already picked this song! Try another one.'
      });
    }

    db.run('INSERT INTO submissions (song_id, username) VALUES (?, ?)', [song_id, trimmedUsername]);
    saveDb(db);

    const inserted = queryOne('SELECT last_insert_rowid() as id');
    res.status(201).json({ id: inserted.id, song_id, username: trimmedUsername });
  });

  // GET /api/my-submissions/:username — user's own submissions
  router.get('/api/my-submissions/:username', (req, res) => {
    const username = req.params.username;
    const submissions = queryAll(
      `SELECT sub.id, sub.song_id, sub.submitted_at, s.year, s.country, s.artist, s.song, s.youtube_url
       FROM submissions sub JOIN songs s ON s.id = sub.song_id
       WHERE sub.username = ?`,
      [username]
    );
    res.json(submissions);
  });

  // DELETE /api/submissions/:id — remove own submission
  router.delete('/api/submissions/:id', (req, res) => {
    const { username } = req.body;
    const subId = Number(req.params.id);

    const sub = queryOne('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (sub.username !== username) return res.status(403).json({ error: 'You can only remove your own submissions' });

    db.run('DELETE FROM votes WHERE submission_id = ?', [subId]);
    db.run('DELETE FROM submissions WHERE id = ?', [subId]);
    saveDb(db);
    res.json({ success: true });
  });

  // ─── Voting (Eurovision-style) ─────────────────────────────────────────────

  // GET /api/voting/state — current voting state
  router.get('/api/voting/state', (_req, res) => {
    const state = getSetting('voting_state') || 'closed';
    res.json({ state });
  });

  // POST /api/voting/state — admin: change voting state
  router.post('/api/voting/state', (req, res) => {
    const { state, admin_password } = req.body;
    const correctPw = getSetting('admin_password');

    if (admin_password !== correctPw) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }

    if (!['closed', 'open', 'revealed'].includes(state)) {
      return res.status(400).json({ error: 'State must be: closed, open, or revealed' });
    }

    setSetting('voting_state', state);
    res.json({ state });
  });

  // GET /api/voting/submissions — get all submissions for voting (when voting is open)
  router.get('/api/voting/submissions', (req, res) => {
    const state = getSetting('voting_state');
    const { username } = req.query;

    if (state === 'closed') {
      return res.status(403).json({ error: 'Voting is not open yet' });
    }

    // When voting is open, show all submissions (still anonymous submitters)
    // When revealed, show everything
    const submissions = queryAll(`
      SELECT sub.id, sub.song_id,
             s.year, s.country, s.artist, s.song, s.youtube_url
      FROM submissions sub
      JOIN songs s ON s.id = sub.song_id
      ORDER BY s.year DESC, s.country ASC
    `);

    // Get this user's existing votes
    let myVotes = {};
    if (username) {
      const votes = queryAll('SELECT submission_id, points FROM votes WHERE username = ?', [username]);
      for (const v of votes) {
        myVotes[v.submission_id] = v.points;
      }
    }

    res.json({ submissions, myVotes, state });
  });

  // POST /api/votes — submit Eurovision-style points (12, 10, 8-1)
  router.post('/api/votes', (req, res) => {
    const { username, votes } = req.body;
    // votes = { submission_id: points, ... }
    // Valid Eurovision points: 12, 10, 8, 7, 6, 5, 4, 3, 2, 1

    const state = getSetting('voting_state');
    if (state !== 'open') {
      return res.status(403).json({ error: 'Voting is not currently open' });
    }

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!votes || typeof votes !== 'object') {
      return res.status(400).json({ error: 'Votes object is required' });
    }

    const trimmedUsername = username.trim().substring(0, 50);
    const allowedPoints = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];

    // Validate: each point value used at most once
    const usedPoints = Object.values(votes).map(Number);
    const pointSet = new Set(usedPoints);

    for (const p of usedPoints) {
      if (!allowedPoints.includes(p)) {
        return res.status(400).json({ error: `Invalid point value: ${p}. Allowed: ${allowedPoints.join(', ')}` });
      }
    }

    if (pointSet.size !== usedPoints.length) {
      return res.status(400).json({ error: 'Each point value can only be assigned once' });
    }

    if (usedPoints.length > 10) {
      return res.status(400).json({ error: 'You can assign at most 10 point values' });
    }

    // Check user isn't voting for own submissions
    const ownSubs = queryAll('SELECT id FROM submissions WHERE username = ?', [trimmedUsername]);
    const ownIds = new Set(ownSubs.map(s => s.id));

    for (const subId of Object.keys(votes)) {
      if (ownIds.has(Number(subId))) {
        return res.status(403).json({ error: "You can't vote for your own submissions" });
      }
    }

    // Clear previous votes
    db.run('DELETE FROM votes WHERE username = ?', [trimmedUsername]);

    // Insert new votes
    for (const [subId, points] of Object.entries(votes)) {
      db.run(
        'INSERT INTO votes (username, submission_id, points) VALUES (?, ?, ?)',
        [trimmedUsername, Number(subId), Number(points)]
      );
    }

    saveDb(db);
    res.json({ success: true });
  });

  // GET /api/votes/:username — get user's current votes
  router.get('/api/votes/:username', (req, res) => {
    const state = getSetting('voting_state');
    if (state === 'closed') {
      return res.status(403).json({ error: 'Voting is not open' });
    }

    const votes = queryAll('SELECT submission_id, points FROM votes WHERE username = ?', [req.params.username]);
    const voteMap = {};
    for (const v of votes) {
      voteMap[v.submission_id] = v.points;
    }
    res.json(voteMap);
  });

  // GET /api/results — final scores, sorted lowest to highest
  router.get('/api/results', (_req, res) => {
    const state = getSetting('voting_state');
    if (state !== 'revealed') {
      return res.status(403).json({ error: 'Results have not been revealed yet', state });
    }

    const results = queryAll(`
      SELECT sub.id, sub.username as submitted_by,
             s.year, s.country, s.artist, s.song, s.youtube_url,
             COALESCE(SUM(v.points), 0) as total_points,
             COUNT(v.id) as vote_count
      FROM submissions sub
      JOIN songs s ON s.id = sub.song_id
      LEFT JOIN votes v ON v.submission_id = sub.id
      GROUP BY sub.id
      ORDER BY total_points ASC
    `);

    // Also get detailed vote breakdown per submission
    const detailed = {};
    for (const r of results) {
      const voteBreakdown = queryAll(
        'SELECT username, points FROM votes WHERE submission_id = ? ORDER BY points DESC',
        [r.id]
      );
      detailed[r.id] = voteBreakdown;
    }

    res.json({ results, voteBreakdown: detailed });
  });

  // ─── Admin ──────────────────────────────────────────────────────────────────

  // POST /api/admin/verify — verify admin password
  router.post('/api/admin/verify', (req, res) => {
    const { admin_password } = req.body;
    const correctPw = getSetting('admin_password');
    if (admin_password === correctPw) {
      res.json({ valid: true });
    } else {
      res.status(403).json({ valid: false, error: 'Invalid password' });
    }
  });

  // GET /api/admin/submissions — admin view of all submissions (shows who submitted what)
  router.post('/api/admin/submissions', (req, res) => {
    const { admin_password } = req.body;
    const correctPw = getSetting('admin_password');
    if (admin_password !== correctPw) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }

    const submissions = queryAll(`
      SELECT sub.id, sub.username, sub.submitted_at,
             s.id as song_id, s.year, s.country, s.artist, s.song
      FROM submissions sub
      JOIN songs s ON s.id = sub.song_id
      ORDER BY sub.username, s.year DESC
    `);
    res.json(submissions);
  });

  // ─── Watching ─────────────────────────────────────────────────────────────

  // GET /api/watching/state — current watching state
  router.get('/api/watching/state', (_req, res) => {
    const state = getSetting('watching_state') || 'closed';
    res.json({ state });
  });

  // POST /api/watching/state — admin: toggle watching open/closed
  router.post('/api/watching/state', (req, res) => {
    const { state, admin_password } = req.body;
    const correctPw = getSetting('admin_password');

    if (admin_password !== correctPw) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }

    if (!['closed', 'open'].includes(state)) {
      return res.status(400).json({ error: 'State must be: closed or open' });
    }

    setSetting('watching_state', state);
    res.json({ state });
  });

  // GET /api/watching/count — total submission count (always available)
  router.get('/api/watching/count', (_req, res) => {
    const row = queryOne('SELECT COUNT(*) as count FROM submissions');
    res.json({ count: row ? row.count : 0 });
  });

  // GET /api/watching/submitters — list of submitters with song counts (always available)
  router.get('/api/watching/submitters', (_req, res) => {
    const rows = queryAll(`
      SELECT username, COUNT(*) as song_count
      FROM submissions
      GROUP BY username
      ORDER BY username ASC
    `);
    res.json(rows);
  });

  // GET /api/watching/submissions — all submissions for watching (when open)
  router.get('/api/watching/submissions', (_req, res) => {
    const state = getSetting('watching_state');
    if (state !== 'open') {
      return res.status(403).json({ error: 'Watching is not open yet' });
    }

    const submissions = queryAll(`
      SELECT sub.id, sub.song_id, sub.username,
             s.year, s.country, s.artist, s.song, s.youtube_url
      FROM submissions sub
      JOIN songs s ON s.id = sub.song_id
      ORDER BY sub.username ASC, s.year DESC
    `);
    res.json(submissions);
  });

  // Serve the built React frontend
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  router.use(express.static(clientDist));
  // SPA fallback — serve index.html for any non-API route
  router.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.use('/eurovision', router);

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Eurovision Draft running on http://localhost:${PORT}/eurovision/`);
  });
}

init().catch(console.error);
