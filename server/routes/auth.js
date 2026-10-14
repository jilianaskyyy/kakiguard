// /api/auth/*  and  /api/me  (incl. PDPA tools: download my data, delete my account)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, one, all, run } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const r = Router();
const COLORS = ['#2F6BFF', '#E85D75', '#1E9E6A', '#F29B1D', '#7A4DFF', '#0E7490', '#C2410C'];
const MODES = ['simple', 'full'];
const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, lang: u.lang, points: u.points, color: u.color, ui_mode: u.ui_mode });

r.post('/auth/login', (req, res) => {
  const { username = '', password = '' } = req.body;
  const u = one('SELECT * FROM users WHERE username = ?', username.trim().toLowerCase());
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'wrong_login' });
  res.json({ token: signToken(u), user: publicUser(u) });
});

r.post('/auth/register', (req, res) => {
  const { name = '', username = '', password = '', lang = 'en', ui_mode = 'full', consent = false } = req.body;
  const uname = username.trim().toLowerCase();
  if (!consent) return res.status(400).json({ error: 'need_consent' });
  if (!name.trim() || !/^[a-z0-9_]{3,20}$/.test(uname) || password.length < 6) {
    return res.status(400).json({ error: 'invalid_signup' });
  }
  if (one('SELECT id FROM users WHERE username = ?', uname)) return res.status(409).json({ error: 'username_taken' });
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const id = run(`INSERT INTO users (name, username, password_hash, lang, color, ui_mode, consent_at)
    VALUES (?,?,?,?,?,?, datetime('now'))`,
  name.trim().slice(0, 40), uname, bcrypt.hashSync(password, 10), lang, color, MODES.includes(ui_mode) ? ui_mode : 'full').lastInsertRowid;
  const u = one('SELECT * FROM users WHERE id = ?', id);
  res.json({ token: signToken(u), user: publicUser(u) });
});

// Demo accounts shown on the login screen (one-tap login for judges)
r.get('/auth/demo-accounts', (_req, res) => {
  res.json(all("SELECT name, username, role, color, ui_mode FROM users WHERE username IN ('jiliana','mum','dad','ethan','mod') ORDER BY id"));
});

r.get('/me', requireAuth, (req, res) => {
  const stats = one(`SELECT
      (SELECT COUNT(*) FROM reports WHERE user_id = @id) AS reports,
      (SELECT COUNT(*) FROM reports WHERE user_id = @id AND status = 'verified') AS verified,
      (SELECT COUNT(*) FROM comments WHERE user_id = @id) AS comments,
      (SELECT COALESCE(SUM(correct),0) FROM quiz_scores WHERE user_id = @id) AS quiz_correct,
      (SELECT COUNT(*) FROM quiz_scores WHERE user_id = @id) AS games,
      (SELECT COUNT(*) FROM kaki_replies WHERE user_id = @id) AS kaki_helps`, { id: req.user.id });
  res.json({ user: req.user, stats });
});

r.patch('/me', requireAuth, (req, res) => {
  const { lang, ui_mode } = req.body;
  if (['en', 'zh', 'ms', 'ta'].includes(lang)) run('UPDATE users SET lang = ? WHERE id = ?', lang, req.user.id);
  if (MODES.includes(ui_mode)) run('UPDATE users SET ui_mode = ? WHERE id = ?', ui_mode, req.user.id);
  res.json({ user: one('SELECT id, name, username, role, lang, points, color, ui_mode FROM users WHERE id = ?', req.user.id) });
});

// PDPA access obligation: everything we hold about you, as one JSON file
r.get('/me/export', requireAuth, (req, res) => {
  const id = req.user.id;
  const data = {
    exported_at: new Date().toISOString(),
    account: one('SELECT id, name, username, role, lang, ui_mode, points, created_at, consent_at FROM users WHERE id = ?', id),
    circles: all('SELECT c.name, m.relation FROM circle_members m JOIN circles c ON c.id = m.circle_id WHERE m.user_id = ?', id),
    reports: all('SELECT title, content, platform, scam_type, status, created_at FROM reports WHERE user_id = ?', id),
    comments: all('SELECT content, created_at FROM comments WHERE user_id = ?', id),
    family_asks: all('SELECT kind, content, risk_score, created_at FROM kaki_checks WHERE sender_id = ?', id),
    family_replies: all('SELECT verdict, created_at FROM kaki_replies WHERE user_id = ?', id),
    message_checks: all('SELECT score, level, top_flag, created_at FROM checks WHERE user_id = ?', id),
    notifications: all('SELECT type, level, body, created_at FROM notifications WHERE user_id = ?', id),
    notification_settings: one('SELECT * FROM notify_settings WHERE user_id = ?', id) || null,
    note: 'KakiGuard never stores the messages you check, only the score. Family ask text is wiped after 30 days.',
  };
  res.setHeader('Content-Disposition', 'attachment; filename="kakiguard-my-data.json"');
  res.json(data);
});

// PDPA: withdraw consent / delete account. Removes everything linked to you.
const deleteUser = db.transaction((id) => {
  // Circles you own: hand them to the next member, or delete if you're the only one
  for (const c of all('SELECT id FROM circles WHERE owner_id = ?', id)) {
    const next = one('SELECT user_id FROM circle_members WHERE circle_id = ? AND user_id != ? LIMIT 1', c.id, id);
    if (next) run('UPDATE circles SET owner_id = ? WHERE id = ?', next.user_id, c.id);
    else run('DELETE FROM circles WHERE id = ?', c.id);
  }
  run('UPDATE notifications SET actor_id = NULL WHERE actor_id = ?', id);
  run('UPDATE reports SET reviewed_by = NULL WHERE reviewed_by = ?', id);
  run('UPDATE notify_settings SET main_kaki_id = NULL WHERE main_kaki_id = ?', id);
  run('DELETE FROM comments WHERE user_id = ?', id);
  run('DELETE FROM kaki_replies WHERE user_id = ?', id);
  run('DELETE FROM kaki_checks WHERE sender_id = ?', id);
  run('DELETE FROM reports WHERE user_id = ?', id);
  run('DELETE FROM seen_too WHERE user_id = ?', id);
  run('DELETE FROM quiz_scores WHERE user_id = ?', id);
  run('DELETE FROM users WHERE id = ?', id); // the rest cascades
});

r.delete('/me', requireAuth, (req, res) => {
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'confirm_required' });
  deleteUser(req.user.id);
  res.json({ ok: true });
});

export default r;
