// =============================================================
// KakiGuard API server
//   - REST API under /api
//   - Real-time alerts with Socket.io (family + community alerts)
//   - In production, also serves the built React app (client/dist)
// Run:  npm run dev   (from the project root)
// =============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import './db.js';
import { userFromToken } from './auth.js';
import { markOnline, markOffline } from './presence.js';
import { aiEnabled } from './ai.js';
import authRoutes from './routes/auth.js';
import checkRoutes from './routes/check.js';
import reportRoutes from './routes/reports.js';
import circleRoutes, { circleIdsFor } from './routes/circles.js';
import learnModRoutes from './routes/learn_mod.js';
import notificationRoutes from './routes/notifications.js';
import safetyRoutes from './routes/safety.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { analyse } from '../shared/scamEngine.js';
import { explainWithAI } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

const router = express.Router();
router.post('/check', async (req, res) => {
  const { text, lang = 'en' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text_required' });
  }

  // Local rule engine fallback
  const ruleResult = analyse(text);

  // Call Gemini AI
  const aiResult = await explainWithAI(text, ruleResult, lang);

  // Return merged response (prioritizes AI score & verdict when available)
  return res.json({
    score: aiResult?.score ?? ruleResult.score,
    verdict: aiResult?.verdict ?? 'probably_safe',
    summary: aiResult?.summary || '',
    flags: aiResult?.extra_red_flags || ruleResult.flags.map(f => f.flag) || [],
    next_step: aiResult?.next_step || '',
    ruleScore: ruleResult.score // optional reference
  });
});

export default router;

// Safer: security headers, a body size limit, and rate limits on the routes people could abuse
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '200kb' }));
app.set('trust proxy', 1);
const limit = (windowMin, max) => rateLimit({ windowMs: windowMin * 60 * 1000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many' } });
app.use('/api/auth', limit(15, 100));   // 100 login/sign-up attempts per 15 min per IP (venue Wi-Fi shares one IP)
app.use('/api/check', limit(1, 60));    // 60 checks per minute per IP
app.use('/api/verify', limit(1, 10));

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiEnabled() }));
app.use('/api', authRoutes);
app.use('/api', checkRoutes);
app.use('/api', reportRoutes);
app.use('/api', circleRoutes);
app.use('/api', learnModRoutes);
app.use('/api', notificationRoutes);
app.use('/api', safetyRoutes);

// ---------- Real-time ----------
// Every phone joins: its own room, each of its Safety Circles, and 'mods' if a moderator.
io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth?.token);
  if (!user) return next(new Error('unauthorised'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const { user } = socket.data;
  const circles = circleIdsFor(user.id);
  socket.join(`user:${user.id}`);
  circles.forEach((c) => socket.join(`circle:${c}`));
  if (user.role === 'moderator') socket.join('mods');

  markOnline(user.id);
  circles.forEach((c) => io.to(`circle:${c}`).emit('presence', { userId: user.id, online: true }));

  // After joining a new circle, the app asks to refresh its rooms
  socket.on('rejoin', () => circleIdsFor(user.id).forEach((c) => socket.join(`circle:${c}`)));

  // Live Call Guard: stream the risk level to family while a call is happening.
  // Only after the caller's phone has decided to share (auto countdown finished, or they tapped "Tell my family").
  socket.on('call:risk', (payload) => {
    if (!payload?.shared) return;
    circleIdsFor(user.id).forEach((c) => socket.to(`circle:${c}`).emit('call:risk', { ...payload, userId: user.id, name: user.name }));
  });

  socket.on('disconnect', () => {
    markOffline(user.id);
    circles.forEach((c) => io.to(`circle:${c}`).emit('presence', { userId: user.id, online: false }));
  });
});

// ---------- Serve the built React app (after `npm run build`) ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  KakiGuard API running on http://localhost:${PORT}`);
  console.log(aiEnabled() ? '🤖 AI explanations: ON (Gemini)' : '🤖 AI explanations: OFF (rule engine only — add GEMINI_API_KEY to server/.env)');
});