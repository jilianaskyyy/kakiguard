// /api/quiz, /api/leaderboard and /api/mod/* (moderator dashboard)
import { Router } from 'express';
import { one, all, run, json } from '../db.js';
import { requireAuth, requireModerator } from '../auth.js';
import { shapeReport } from './reports.js';
import { notify } from '../notify.js';

const r = Router();

// ---------- Learn ----------
r.get('/quiz', requireAuth, (_req, res) => {
  const items = all('SELECT * FROM quiz_items ORDER BY RANDOM() LIMIT 8').map((q) => ({ ...q, is_scam: !!q.is_scam, flags: json(q.flags) }));
  res.json(items);
});

r.post('/quiz/score', requireAuth, (req, res) => {
  const correct = Math.max(0, Math.min(20, Number(req.body.correct) || 0));
  const total = Math.max(1, Math.min(20, Number(req.body.total) || 1));
  run('INSERT INTO quiz_scores (user_id, correct, total) VALUES (?,?,?)', req.user.id, correct, total);
  run('UPDATE users SET points = points + ? WHERE id = ?', correct * 5, req.user.id);
  res.json({ points: one('SELECT points FROM users WHERE id = ?', req.user.id).points });
});

r.get('/leaderboard', requireAuth, (_req, res) => {
  res.json(all("SELECT id, name, color, points FROM users WHERE role = 'user' ORDER BY points DESC LIMIT 10"));
});

// ---------- Moderator ----------
r.get('/mod/queue', requireAuth, requireModerator, (_req, res) => {
  const pending = all(`SELECT r.*, u.name AS author, u.color AS author_color, 0 AS seen, 0 AS seen_by_me, 0 AS comment_count
    FROM reports r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.risk_score DESC, r.created_at DESC`).map(shapeReport);
  const comments = all(`SELECT c.id, c.content, c.created_at, u.name, r.title AS report_title FROM comments c
    JOIN users u ON u.id = c.user_id JOIN reports r ON r.id = c.report_id WHERE c.hidden = 0 ORDER BY c.created_at DESC LIMIT 15`);
  const counts = one(`SELECT
      SUM(status='pending') AS pending, SUM(status='verified') AS verified, SUM(status='rejected') AS rejected FROM reports`);
  res.json({ pending, comments, counts });
});

r.post('/mod/reports/:id', requireAuth, requireModerator, (req, res) => {
  const { action } = req.body; // 'verify' | 'reject'
  if (!['verify', 'reject'].includes(action)) return res.status(400).json({ error: 'bad_action' });
  const status = action === 'verify' ? 'verified' : 'rejected';
  run("UPDATE reports SET status = ?, reviewed_by = ?, created_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE created_at END WHERE id = ?",
    status, req.user.id, status, req.params.id);
  const rep = shapeReport(one(`SELECT r.*, u.name AS author, u.color AS author_color, 0 AS seen, 0 AS seen_by_me, 0 AS comment_count
    FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ?`, req.params.id));
  if (!rep) return res.status(404).json({ error: 'not_found' });
  if (status === 'verified') {
    run('UPDATE users SET points = points + 20 WHERE id = ?', rep.user_id);
    // Every phone's feed updates instantly; whether it BUZZES depends on each person's settings
    const io = req.app.get('io');
    io.emit('community:alert', rep);
    all("SELECT id FROM users WHERE role = 'user'").forEach(({ id }) => {
      if (id === rep.user_id) notify(io, { userId: id, type: 'report', level: 'info', refId: rep.id, body: rep.title });
      else notify(io, { userId: id, type: 'community', level: 'info', refId: rep.id, body: rep.title });
    });
  }
  res.json(rep);
});

r.delete('/mod/comments/:id', requireAuth, requireModerator, (req, res) => {
  run('UPDATE comments SET hidden = 1 WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default r;
