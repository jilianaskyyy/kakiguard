// Safety Circle extras:
//   /api/blocks  — one shared block list for the whole circle
//   /api/verify  — "Is it really you?": checks a caller's claim with the real family member's account
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { notify } from '../notify.js';
import { circleIdsFor } from './circles.js';
import { normalizeNumber, findNumbers } from '../../shared/privacy.js';

const r = Router();

// Every number blocked by anyone in any of my circles
export function blockedFor(userId) {
  const ids = circleIdsFor(userId);
  if (!ids.length) return [];
  return all(`SELECT b.id, b.circle_id, b.number, b.label, b.created_at, u.name AS added_by_name, u.color AS added_by_color
    FROM circle_blocks b LEFT JOIN users u ON u.id = b.added_by
    WHERE b.circle_id IN (${ids.map(() => '?').join(',')}) ORDER BY b.created_at DESC`, ...ids);
}

// Used by /api/check: is any number in this message on my family's block list?
export function familyBlockedHits(userId, text) {
  const list = blockedFor(userId);
  if (!list.length) return [];
  const byNum = new Map(list.map((b) => [b.number, b]));
  return findNumbers(text).filter((n) => byNum.has(n.norm)).map((n) => ({ ...n, block: byNum.get(n.norm) }));
}

r.get('/blocks', requireAuth, (req, res) => res.json(blockedFor(req.user.id)));

r.post('/blocks', requireAuth, (req, res) => {
  const number = normalizeNumber(req.body.number);
  const circleId = Number(req.body.circle_id) || circleIdsFor(req.user.id)[0];
  if (!number || number.length < 8) return res.status(400).json({ error: 'bad_number' });
  if (!circleIdsFor(req.user.id).includes(circleId)) return res.status(400).json({ error: 'no_circle' });
  run('INSERT OR IGNORE INTO circle_blocks (circle_id, number, label, added_by) VALUES (?,?,?,?)',
    circleId, number, String(req.body.label || '').slice(0, 60) || null, req.user.id);
  const list = blockedFor(req.user.id);
  req.app.get('io').to(`circle:${circleId}`).emit('blocks:update', { circle_id: circleId, by: req.user.name, number });
  res.json(list);
});

r.delete('/blocks/:id', requireAuth, (req, res) => {
  const b = one('SELECT * FROM circle_blocks WHERE id = ?', req.params.id);
  if (!b || !circleIdsFor(req.user.id).includes(b.circle_id)) return res.status(404).json({ error: 'not_found' });
  run('DELETE FROM circle_blocks WHERE id = ?', b.id);
  req.app.get('io').to(`circle:${b.circle_id}`).emit('blocks:update', { circle_id: b.circle_id });
  res.json(blockedFor(req.user.id));
});

// ---------- Is it really you? ----------
const inSameCircle = (a, b) => {
  const mine = circleIdsFor(a);
  return circleIdsFor(b).some((c) => mine.includes(c));
};
const verifyFull = (id) => one(`SELECT v.*, f.name AS from_name, f.color AS from_color, t.name AS to_name, t.color AS to_color
  FROM verify_requests v JOIN users f ON f.id = v.from_id JOIN users t ON t.id = v.to_id WHERE v.id = ?`, id);

r.post('/verify', requireAuth, (req, res) => {
  const to = Number(req.body.user_id);
  if (!to || to === req.user.id || !inSameCircle(req.user.id, to)) return res.status(400).json({ error: 'not_in_circle' });
  const id = run('INSERT INTO verify_requests (from_id, to_id) VALUES (?,?)', req.user.id, to).lastInsertRowid;
  const v = verifyFull(id);
  // Urgent: it has to reach them while the call is still going
  notify(req.app.get('io'), { userId: to, type: 'verify', level: 'urgent', actorId: req.user.id, refId: id, extra: v });
  res.json(v);
});

r.post('/verify/:id/answer', requireAuth, (req, res) => {
  const v = one('SELECT * FROM verify_requests WHERE id = ?', req.params.id);
  if (!v || v.to_id !== req.user.id) return res.status(404).json({ error: 'not_found' });
  const answer = req.body.answer === 'yes' ? 'yes' : 'no';
  run("UPDATE verify_requests SET status = ?, answered_at = datetime('now') WHERE id = ?", answer, v.id);
  const full = verifyFull(v.id);
  req.app.get('io').to(`user:${v.from_id}`).emit('verify:answer', full);
  res.json(full);
});

export default r;
