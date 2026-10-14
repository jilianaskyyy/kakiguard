// /api/check  — the "Is this a scam?" checker
// Privacy: the message text is NEVER saved. Only the score goes into the weekly summary.
// Cost: the free rule engine runs first; the paid AI is only asked when the engine is unsure,
//       and answers are cached so the same viral scam is only explained once.
import { Router } from 'express';
import crypto from 'node:crypto';
import { analyse, recommendedActions, similarity } from '../../shared/scamEngine.js';
import { explainWithAI, aiEnabled } from '../ai.js';
import { all, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { familyBlockedHits } from './safety.js';
import { redact } from '../../shared/privacy.js';

const r = Router();
const AI_ALWAYS = process.env.AI_ALWAYS === '1';
const aiCache = new Map(); // hash(text+lang) -> explanation (keeps the newest 500)

// Find community reports that look like this message
export function findSimilar(text, result) {
  const hosts = new Set(result.links.map((l) => l.host));
  const reports = all(`SELECT r.id, r.title, r.content, r.scam_type, r.created_at,
      (SELECT COUNT(*) FROM seen_too s WHERE s.report_id = r.id) AS seen
    FROM reports r WHERE r.status = 'verified'`);
  const matches = reports
    .map((rep) => {
      let sim = similarity(text, rep.content);
      if ([...hosts].some((h) => h && rep.content.toLowerCase().includes(h))) sim = Math.max(sim, 0.9);
      return { ...rep, sim };
    })
    .filter((m) => m.sim >= 0.2)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3);
  const people = matches.reduce((sum, m) => sum + m.seen + 1, 0);
  return { people, reports: matches.map(({ content, ...m }) => ({ ...m, sim: Math.round(m.sim * 100) })) };
}

async function cachedAI(text, result, lang) {
  if (!aiEnabled()) return null;
  const unsure = result.score >= 20 && result.score <= 75;
  if (!AI_ALWAYS && !unsure) return null;
  const key = crypto.createHash('sha256').update(`${lang}|${text.trim().toLowerCase()}`).digest('hex');
  if (aiCache.has(key)) return aiCache.get(key);
  // Personal numbers are removed before the text leaves our server (PDPA transfer limitation)
  const ai = await explainWithAI(redact(text), result, lang);
  if (ai) {
    aiCache.set(key, ai);
    if (aiCache.size > 500) aiCache.delete(aiCache.keys().next().value);
  }
  return ai;
}

r.post('/check', requireAuth, async (req, res) => {
  const text = String(req.body.text || '').slice(0, 5000);
  if (!text.trim()) return res.status(400).json({ error: 'empty' });
  const lang = req.body.lang || req.user.lang;

  const result = analyse(text);

  // Safety Circle: a number someone in my family already blocked
  const hits = familyBlockedHits(req.user.id, text);
  if (hits.length) {
    result.flags.unshift({ flag: 'family_blocked', weight: 50, matches: hits.map((h) => h.raw), by: hits[0].block.added_by_name });
    result.spans = [...result.spans.filter((s) => !hits.some((h) => s.start < h.end && h.start < s.end)),
      ...hits.map((h) => ({ start: h.start, end: h.end, flag: 'family_blocked' }))].sort((a, b) => a.start - b.start);
    result.score = Math.max(result.score, 90);
    result.level = 'high';
  }

  const similar = findSimilar(text, result);
  if (similar.reports.some((m) => m.sim >= 60)) {
    result.score = Math.max(result.score, 85);
    result.level = 'high';
  }
  const ai = await cachedAI(text, result, lang);
  run('UPDATE users SET points = points + 2 WHERE id = ?', req.user.id);
  run('INSERT INTO checks (user_id, score, level, top_flag) VALUES (?,?,?,?)', req.user.id, result.score, result.level, result.flags[0]?.flag || null);

  const actions = recommendedActions(result);
  if (hits.length) actions.unshift('act_family_blocked');
  res.json({ ...result, actions, similar, ai, aiEnabled: aiEnabled(), blockedBy: hits[0]?.block.added_by_name || null });
});

export default r;
