// =============================================================
// Notifications: "quiet by default, loud only when it matters"
//
// Every notification is saved to the inbox. Whether it also BUZZES
// the phone (pop-up / toast) depends on the receiver's settings:
//
//   urgent  (SOS, risky live call)      -> always buzzes, even in quiet hours
//   family  (asks, replies)             -> buzzes unless quiet hours, "urgent only", or that person is muted
//   info    (community alerts, reports) -> buzzes only if the receiver chose "everything"
// =============================================================
import { one, all, run, json } from './db.js';

const TZ = process.env.APP_TZ || 'Asia/Singapore';
export const ESCALATE_MS = (Number(process.env.ESCALATE_SECONDS) || 120) * 1000;

export function getSettings(userId) {
  let s = one('SELECT * FROM notify_settings WHERE user_id = ?', userId);
  if (!s) {
    run('INSERT OR IGNORE INTO notify_settings (user_id) VALUES (?)', userId);
    s = one('SELECT * FROM notify_settings WHERE user_id = ?', userId);
  }
  return { ...s, muted: json(s.muted), quiet_on: !!s.quiet_on, weekly_summary: !!s.weekly_summary };
}

function nowHHMM() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
}

export function inQuietHours(s, at = nowHHMM()) {
  if (!s.quiet_on) return false;
  const { quiet_start: a, quiet_end: b } = s;
  return a <= b ? at >= a && at < b : at >= a || at < b; // handles 22:00 -> 07:00
}

export function shouldPush(s, level, actorId) {
  if (level === 'urgent') return true;
  if (inQuietHours(s)) return false;
  if (s.receive === 'urgent') return false;
  if (level === 'info') return s.receive === 'all';
  if (actorId && s.muted.includes(actorId)) return false;
  return true;
}

export function notificationById(id) {
  return one(`SELECT n.*, u.name AS actor_name, u.color AS actor_color
    FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE n.id = ?`, id);
}

/**
 * Save a notification and send it to the user's phone in real time.
 * `extra` (e.g. the kaki check) travels with the socket event so the pop-up can show it.
 */
export function notify(io, { userId, type, level, actorId = null, refId = null, body = null, extra = null }) {
  const s = getSettings(userId);
  const pushed = shouldPush(s, level, actorId);
  const id = run(`INSERT INTO notifications (user_id, type, level, actor_id, ref_id, body, pushed)
    VALUES (?,?,?,?,?,?,?)`, userId, type, level, actorId, refId, body, pushed ? 1 : 0).lastInsertRowid;
  const n = notificationById(id);
  io.to(`user:${userId}`).emit('notif:new', { notification: n, push: pushed, extra });
  return n;
}

// Weekly family summary: replaces a stream of pings with one calm card
export function weeklySummary(userId) {
  const circle = one('SELECT c.id, c.name FROM circles c JOIN circle_members m ON m.circle_id = c.id WHERE m.user_id = ? ORDER BY c.id LIMIT 1', userId);
  if (!circle) return null;
  const people = all(`SELECT u.id, u.name, u.color,
      (SELECT COUNT(*) FROM checks k WHERE k.user_id = u.id AND k.created_at > datetime('now','-7 days')) AS checks,
      (SELECT COUNT(*) FROM checks k WHERE k.user_id = u.id AND k.level = 'high' AND k.created_at > datetime('now','-7 days')) AS high,
      (SELECT k.top_flag FROM checks k WHERE k.user_id = u.id AND k.top_flag IS NOT NULL AND k.created_at > datetime('now','-7 days')
        GROUP BY k.top_flag ORDER BY COUNT(*) DESC LIMIT 1) AS top_flag
    FROM circle_members m JOIN users u ON u.id = m.user_id
    WHERE m.circle_id = ? AND u.id != ? ORDER BY u.id`, circle.id, userId);
  const quiet = one(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND pushed = 0 AND created_at > datetime('now','-7 days')`, userId).n;
  return { circle: circle.name, people, quiet };
}
