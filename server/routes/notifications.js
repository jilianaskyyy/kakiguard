// /api/notifications and /api/notify-settings
import { Router } from 'express';
import { all, one, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { getSettings, weeklySummary, inQuietHours } from '../notify.js';
import { circleIdsFor } from './circles.js';

const r = Router();

r.get('/notifications', requireAuth, (req, res) => {
  const items = all(`SELECT n.*, u.name AS actor_name, u.color AS actor_color
    FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT 60`, req.user.id);
  const unread = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', req.user.id).n;
  const s = getSettings(req.user.id);
  res.json({ items, unread, summary: s.weekly_summary ? weeklySummary(req.user.id) : null, quietNow: inQuietHours(s) });
});

r.get('/notifications/unread', requireAuth, (req, res) => {
  res.json({ unread: one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', req.user.id).n });
});

r.post('/notifications/read-all', requireAuth, (req, res) => {
  run('UPDATE notifications SET read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

r.post('/notifications/:id/read', requireAuth, (req, res) => {
  run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

// Settings + the people who could be my main kaki
r.get('/notify-settings', requireAuth, (req, res) => {
  const ids = circleIdsFor(req.user.id);
  const people = ids.length ? all(`SELECT DISTINCT u.id, u.name, u.color, m.relation FROM circle_members m JOIN users u ON u.id = m.user_id
    WHERE m.circle_id IN (${ids.map(() => '?').join(',')}) AND u.id != ? ORDER BY u.id`, ...ids, req.user.id) : [];
  res.json({ settings: getSettings(req.user.id), people });
});

const ALLOWED = {
  receive: ['all', 'family', 'urgent'],
  ask_mode: ['circle', 'main_first'],
  call_alert: ['auto', 'ask', 'off'],
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

r.patch('/notify-settings', requireAuth, (req, res) => {
  getSettings(req.user.id); // make sure the row exists
  const b = req.body;
  const sets = [];
  const vals = [];
  for (const [k, ok] of Object.entries(ALLOWED)) if (ok.includes(b[k])) { sets.push(`${k} = ?`); vals.push(b[k]); }
  for (const k of ['quiet_start', 'quiet_end']) if (TIME.test(b[k] || '')) { sets.push(`${k} = ?`); vals.push(b[k]); }
  for (const k of ['quiet_on', 'weekly_summary']) if (typeof b[k] === 'boolean') { sets.push(`${k} = ?`); vals.push(b[k] ? 1 : 0); }
  if (Array.isArray(b.muted)) { sets.push('muted = ?'); vals.push(JSON.stringify(b.muted.map(Number).filter(Boolean))); }
  if ('main_kaki_id' in b) { sets.push('main_kaki_id = ?'); vals.push(b.main_kaki_id ? Number(b.main_kaki_id) : null); }
  if (sets.length) run(`UPDATE notify_settings SET ${sets.join(', ')} WHERE user_id = ?`, ...vals, req.user.id);
  res.json({ settings: getSettings(req.user.id) });
});

export default r;
