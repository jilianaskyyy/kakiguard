// /api/reports — community scam reports & discussion
import { Router } from 'express';
import { analyse } from '../../shared/scamEngine.js';
import { redact } from '../../shared/privacy.js';
import { one, all, run, json } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
const PLATFORMS = ['sms', 'whatsapp', 'telegram', 'call', 'email', 'social', 'website', 'other'];
const TYPES = ['job', 'investment', 'ecommerce', 'phishing', 'bank', 'gov', 'delivery', 'romance', 'other'];

const LIST_SQL = `SELECT r.*, u.name AS author, u.color AS author_color,
    (SELECT COUNT(*) FROM seen_too s WHERE s.report_id = r.id) AS seen,
    (SELECT COUNT(*) FROM seen_too s WHERE s.report_id = r.id AND s.user_id = @me) AS seen_by_me,
    (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id AND c.hidden = 0) AS comment_count
  FROM reports r JOIN users u ON u.id = r.user_id`;

export const shapeReport = (row) => row && ({ ...row, asked_to: json(row.asked_to), ai_flags: json(row.ai_flags) });

r.get('/reports', requireAuth, (req, res) => {
  const { type, q, mine } = req.query;
  let sql = `${LIST_SQL} WHERE `;
  const p = { me: req.user.id };
  if (mine) sql += 'r.user_id = @me';
  else sql += "r.status = 'verified'";
  if (type && TYPES.includes(type)) { sql += ' AND r.scam_type = @type'; p.type = type; }
  if (q) { sql += ' AND (r.title LIKE @q OR r.content LIKE @q)'; p.q = `%${q}%`; }
  sql += ' ORDER BY r.created_at DESC LIMIT 50';
  res.json(all(sql, p).map(shapeReport));
});

r.get('/reports/:id', requireAuth, (req, res) => {
  const rep = one(`${LIST_SQL} WHERE r.id = @id`, { me: req.user.id, id: req.params.id });
  if (!rep) return res.status(404).json({ error: 'not_found' });
  const comments = all(`SELECT c.id, c.content, c.created_at, u.name, u.color, u.role
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.report_id = ? AND c.hidden = 0 ORDER BY c.created_at`, rep.id);
  res.json({ ...shapeReport(rep), comments });
});

r.post('/reports', requireAuth, (req, res) => {
  const { platform, scam_type, asked_to = [], lost_money = 'no' } = req.body;
  // NRIC, card, bank account numbers and OTPs are removed BEFORE saving
  const title = redact(String(req.body.title || '')).slice(0, 120);
  const content = redact(String(req.body.content || '')).slice(0, 4000);
  if (!content.trim() || !PLATFORMS.includes(platform) || !TYPES.includes(scam_type)) {
    return res.status(400).json({ error: 'invalid_report' });
  }
  // AI pre-screen: moderators see this score, but a human always decides
  const ai = analyse(content);
  const id = run(`INSERT INTO reports (user_id, title, content, platform, scam_type, asked_to, lost_money, risk_score, ai_flags)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  req.user.id, title.trim() || content.slice(0, 60), content.trim(), platform, scam_type,
  JSON.stringify(asked_to), lost_money, ai.score, JSON.stringify(ai.flags.map((f) => f.flag))).lastInsertRowid;
  run('UPDATE users SET points = points + 10 WHERE id = ?', req.user.id);

  const report = shapeReport(one(`${LIST_SQL} WHERE r.id = @id`, { me: req.user.id, id }));
  req.app.get('io').to('mods').emit('mod:new', report);
  res.json(report);
});

r.post('/reports/:id/seen', requireAuth, (req, res) => {
  const exists = one('SELECT 1 FROM seen_too WHERE report_id = ? AND user_id = ?', req.params.id, req.user.id);
  if (exists) run('DELETE FROM seen_too WHERE report_id = ? AND user_id = ?', req.params.id, req.user.id);
  else run('INSERT INTO seen_too (report_id, user_id) VALUES (?,?)', req.params.id, req.user.id);
  const { n } = one('SELECT COUNT(*) AS n FROM seen_too WHERE report_id = ?', req.params.id);
  res.json({ seen: n, seen_by_me: !exists });
});

r.post('/reports/:id/comments', requireAuth, (req, res) => {
  const content = redact(String(req.body.content || '').trim()).slice(0, 1000);
  if (!content) return res.status(400).json({ error: 'empty' });
  const id = run('INSERT INTO comments (report_id, user_id, content) VALUES (?,?,?)', req.params.id, req.user.id, content).lastInsertRowid;
  run('UPDATE users SET points = points + 3 WHERE id = ?', req.user.id);
  res.json(one(`SELECT c.id, c.content, c.created_at, u.name, u.color, u.role
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`, id));
});

// Home screen numbers
r.get('/stats', requireAuth, (_req, res) => {
  res.json({
    verified: one("SELECT COUNT(*) AS n FROM reports WHERE status = 'verified'").n,
    today: one("SELECT COUNT(*) AS n FROM reports WHERE status = 'verified' AND created_at > datetime('now','-1 day')").n,
    protectedPeople: one('SELECT COUNT(*) AS n FROM seen_too').n + one('SELECT COUNT(*) AS n FROM users').n,
    trending: all(`SELECT scam_type, COUNT(*) AS n FROM reports WHERE status = 'verified'
      GROUP BY scam_type ORDER BY n DESC LIMIT 4`),
  });
});

export default r;
