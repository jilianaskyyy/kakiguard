// /api/circles and /api/kaki — Safety Circle + "Ask my Kaki" + SOS
import { Router } from 'express';
import { analyse } from '../../shared/scamEngine.js';
import { redact } from '../../shared/privacy.js';
import { one, all, run, json } from '../db.js';
import { requireAuth } from '../auth.js';
import { isOnline } from '../presence.js';
import { notify, getSettings, ESCALATE_MS } from '../notify.js';

const r = Router();

export const circleIdsFor = (userId) => all('SELECT circle_id FROM circle_members WHERE user_id = ?', userId).map((x) => x.circle_id);

function circleWithMembers(id) {
  const c = one('SELECT * FROM circles WHERE id = ?', id);
  if (!c) return null;
  c.members = all(`SELECT u.id, u.name, u.color, u.lang, m.relation FROM circle_members m
    JOIN users u ON u.id = m.user_id WHERE m.circle_id = ? ORDER BY u.id`, id)
    .map((m) => ({ ...m, online: isOnline(m.id) }));
  return c;
}

function kakiFull(id) {
  const k = one(`SELECT k.*, u.name AS sender_name, u.color AS sender_color, c.name AS circle_name
    FROM kaki_checks k JOIN users u ON u.id = k.sender_id JOIN circles c ON c.id = k.circle_id WHERE k.id = ?`, id);
  if (!k) return null;
  k.ai_flags = json(k.ai_flags);
  k.replies = all(`SELECT kr.verdict, kr.created_at, u.id AS user_id, u.name, u.color FROM kaki_replies kr
    JOIN users u ON u.id = kr.user_id WHERE kr.check_id = ? ORDER BY kr.created_at`, id);
  return k;
}

r.get('/circles', requireAuth, (req, res) => {
  res.json(circleIdsFor(req.user.id).map(circleWithMembers));
});

r.post('/circles', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim() || `${req.user.name}'s Circle`;
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const id = run('INSERT INTO circles (name, owner_id, invite_code) VALUES (?,?,?)', name, req.user.id, code).lastInsertRowid;
  run('INSERT INTO circle_members (circle_id, user_id, relation) VALUES (?,?,?)', id, req.user.id, null);
  res.json(circleWithMembers(id));
});

r.post('/circles/join', requireAuth, (req, res) => {
  const c = one('SELECT id FROM circles WHERE invite_code = ?', String(req.body.code || '').trim().toUpperCase());
  if (!c) return res.status(404).json({ error: 'bad_code' });
  run('INSERT OR IGNORE INTO circle_members (circle_id, user_id, relation) VALUES (?,?,?)', c.id, req.user.id, req.body.relation || null);
  const circle = circleWithMembers(c.id);
  req.app.get('io').to(`circle:${c.id}`).emit('circle:update', circle);
  res.json(circle);
});

// Recent asks / SOS from my circles
r.get('/kaki', requireAuth, (req, res) => {
  const ids = circleIdsFor(req.user.id);
  if (!ids.length) return res.json([]);
  const rows = all(`SELECT id FROM kaki_checks WHERE circle_id IN (${ids.map(() => '?').join(',')})
    ORDER BY created_at DESC, id DESC LIMIT 20`, ...ids);
  res.json(rows.map((x) => kakiFull(x.id)));
});

// kind: 'ask' (is this a scam?), 'sos' (I think I've been scammed), 'call' (I'm on a suspicious call right now)
r.post('/kaki', requireAuth, (req, res) => {
  const { kind = 'ask' } = req.body;
  const content = redact(String(req.body.content || '')).slice(0, 3000);
  const circleId = req.body.circle_id || circleIdsFor(req.user.id)[0];
  if (!circleId) return res.status(400).json({ error: 'no_circle' });
  if (!['ask', 'sos', 'call'].includes(kind)) return res.status(400).json({ error: 'bad_kind' });
  const a = analyse(content);
  const id = run('INSERT INTO kaki_checks (sender_id, circle_id, content, risk_score, ai_flags, kind) VALUES (?,?,?,?,?,?)',
    req.user.id, circleId, content, kind === 'sos' ? 100 : a.score,
    JSON.stringify(a.flags.map((f) => f.flag)), kind).lastInsertRowid;
  const k = kakiFull(id);
  const io = req.app.get('io');
  io.to(`circle:${circleId}`).emit('kaki:new', k); // keeps everyone's family feed up to date (no buzzing)

  // Who gets notified. SOS and risky calls are urgent and go to everyone.
  // A normal ask goes to my main kaki first, and only to the rest if they don't answer in time.
  const others = all('SELECT user_id FROM circle_members WHERE circle_id = ? AND user_id != ?', circleId, req.user.id).map((m) => m.user_id);
  const mine = getSettings(req.user.id);
  const send = (ids, type) => ids.forEach((uid) => notify(io, {
    userId: uid, type, level: kind === 'ask' ? 'family' : 'urgent', actorId: req.user.id, refId: id, body: k.content, extra: k,
  }));
  if (kind === 'ask' && mine.ask_mode === 'main_first' && others.includes(mine.main_kaki_id)) {
    send([mine.main_kaki_id], 'ask');
    setTimeout(() => {
      const answered = one('SELECT COUNT(*) AS n FROM kaki_replies WHERE check_id = ?', id).n;
      if (!answered) send(others.filter((u) => u !== mine.main_kaki_id), 'escalated');
    }, ESCALATE_MS);
  } else {
    send(others, kind);
  }
  res.json(k);
});

r.post('/kaki/:id/reply', requireAuth, (req, res) => {
  const { verdict } = req.body;
  if (!['scam', 'safe', 'unsure', 'calling'].includes(verdict)) return res.status(400).json({ error: 'bad_verdict' });
  const k = one('SELECT * FROM kaki_checks WHERE id = ?', req.params.id);
  if (!k || !circleIdsFor(req.user.id).includes(k.circle_id)) return res.status(404).json({ error: 'not_found' });
  run('DELETE FROM kaki_replies WHERE check_id = ? AND user_id = ?', k.id, req.user.id);
  run('INSERT INTO kaki_replies (check_id, user_id, verdict) VALUES (?,?,?)', k.id, req.user.id, verdict);
  run('UPDATE users SET points = points + 5 WHERE id = ?', req.user.id);
  const full = kakiFull(k.id);
  const io = req.app.get('io');
  io.to(`circle:${k.circle_id}`).emit('kaki:reply', { check: full, from: req.user.name, verdict });
  if (k.sender_id !== req.user.id) {
    notify(io, { userId: k.sender_id, type: 'reply', level: 'family', actorId: req.user.id, refId: k.id, body: verdict });
  }
  res.json(full);
});

export default r;
