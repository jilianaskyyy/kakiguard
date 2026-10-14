// Login tokens (JWT) + middleware that protects API routes.
import jwt from 'jsonwebtoken';
import { one } from './db.js';

const SECRET = process.env.JWT_SECRET || 'kakiguard-dev-secret-change-me';

export const signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });

export function userFromToken(token) {
  try {
    const { id } = jwt.verify(token, SECRET);
    return one('SELECT id, name, username, role, lang, points, color, ui_mode FROM users WHERE id = ?', id) || null;
  } catch { return null; }
}

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Please log in' });
  req.user = user;
  next();
}

export function requireModerator(req, res, next) {
  if (req.user?.role !== 'moderator') return res.status(403).json({ error: 'Moderators only' });
  next();
}
