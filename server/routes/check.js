// /api/check — the "Is this a scam?" checker
import { Router } from 'express';
import crypto from 'node:crypto';
import { analyse, recommendedActions, similarity } from '../../shared/scamEngine.js';
import { explainWithAI, aiEnabled } from '../ai.js';
import { all, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { familyBlockedHits } from './safety.js';
import { redact } from '../../shared/privacy.js';

const r = Router();
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
  
  const key = crypto.createHash('sha256').update(`${lang}|${text.trim().toLowerCase()}`).digest('hex');
  if (aiCache.has(key)) return aiCache.get(key);

  // Redact personal numbers before text leaves server
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
  const lang = req.body.lang || req.user?.lang || 'en';

  const result = analyse(text);

  // Safety Circle: check if family member blocked this number
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

  // 🤖 Always fetch local Ollama evaluation
  const ai = await cachedAI(text, result, lang);

  // Merge Ollama AI score if available
  const finalScore = ai?.score ?? result.score;
  const finalLevel = finalScore >= 70 ? 'high' : finalScore >= 30 ? 'medium' : 'low';

  run('UPDATE users SET points = points + 2 WHERE id = ?', req.user.id);
  run('INSERT INTO checks (user_id, score, level, top_flag) VALUES (?,?,?,?)', req.user.id, finalScore, finalLevel, result.flags[0]?.flag || null);

  const actions = recommendedActions(result);
  if (hits.length) actions.unshift('act_family_blocked');

  res.json({
    ...result,
    score: finalScore,
    level: finalLevel,
    actions,
    similar,
    ai,
    aiEnabled: true,
    blockedBy: hits[0]?.block.added_by_name || null
  });
});

export default r;